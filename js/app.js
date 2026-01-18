// cbdiag - Block Diagram Tool
// Main Application

(function() {
    'use strict';

    // ============================================
    // State
    // ============================================
    const state = {
        blocks: [],
        connections: [],
        selectedBlockId: null,
        selectedConnectionId: null,
        mode: 'select', // 'select', 'connecting'
        connectionStart: null,
        nextBlockId: 1,
        nextConnectionId: 1,

        // Pan/zoom state
        viewBox: { x: 0, y: 0, width: 1200, height: 800 },
        isPanning: false,
        panStart: { x: 0, y: 0 },

        // Drag state
        isDragging: false,
        dragOffset: { x: 0, y: 0 },

        // Resize state
        isResizing: false,
        resizeStart: { x: 0, y: 0, width: 0, height: 0 }
    };

    // ============================================
    // DOM Elements
    // ============================================
    const canvas = document.getElementById('canvas');
    const canvasContent = document.getElementById('canvas-content');
    const blocksLayer = document.getElementById('blocks-layer');
    const connectionsLayer = document.getElementById('connections-layer');
    const propertiesPanel = document.getElementById('properties-panel');

    // Toolbar buttons
    const addBlockBtn = document.getElementById('add-block-btn');
    const addConnectionBtn = document.getElementById('add-connection-btn');
    const deleteBtn = document.getElementById('delete-btn');
    const saveBtn = document.getElementById('save-btn');
    const loadBtn = document.getElementById('load-btn');
    const clearBtn = document.getElementById('clear-btn');

    // Property inputs
    const blockLabel = document.getElementById('block-label');
    const blockColor = document.getElementById('block-color');
    const blockWidth = document.getElementById('block-width');
    const blockHeight = document.getElementById('block-height');

    // ============================================
    // Utility Functions
    // ============================================
    function generateId(prefix) {
        if (prefix === 'block') return `block-${state.nextBlockId++}`;
        if (prefix === 'conn') return `conn-${state.nextConnectionId++}`;
        return `${prefix}-${Date.now()}`;
    }

    function screenToSvg(screenX, screenY) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = state.viewBox.width / rect.width;
        const scaleY = state.viewBox.height / rect.height;
        return {
            x: state.viewBox.x + (screenX - rect.left) * scaleX,
            y: state.viewBox.y + (screenY - rect.top) * scaleY
        };
    }

    function getBlockCenter(block) {
        return {
            x: block.x + block.width / 2,
            y: block.y + block.height / 2
        };
    }

    function updateViewBox() {
        const { x, y, width, height } = state.viewBox;
        canvas.setAttribute('viewBox', `${x} ${y} ${width} ${height}`);
    }

    // ============================================
    // Block Functions
    // ============================================
    function createBlock(x, y) {
        const block = {
            id: generateId('block'),
            x: x - 60,
            y: y - 30,
            width: 120,
            height: 60,
            label: 'Block',
            color: '#4a90d9'
        };
        state.blocks.push(block);
        renderBlock(block);
        selectBlock(block.id);
        return block;
    }

    function renderBlock(block) {
        // Remove existing if present
        const existing = document.getElementById(block.id);
        if (existing) existing.remove();

        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('id', block.id);
        g.setAttribute('class', 'block');
        g.setAttribute('data-block-id', block.id);

        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', block.x);
        rect.setAttribute('y', block.y);
        rect.setAttribute('width', block.width);
        rect.setAttribute('height', block.height);
        rect.setAttribute('rx', 4);
        rect.setAttribute('fill', block.color);
        rect.setAttribute('stroke', darkenColor(block.color, 20));

        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', block.x + block.width / 2);
        text.setAttribute('y', block.y + block.height / 2 + 5);
        text.setAttribute('text-anchor', 'middle');
        text.textContent = block.label;

        const resizeHandle = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        resizeHandle.setAttribute('class', 'resize-handle');
        resizeHandle.setAttribute('x', block.x + block.width - 10);
        resizeHandle.setAttribute('y', block.y + block.height - 10);
        resizeHandle.setAttribute('width', 10);
        resizeHandle.setAttribute('height', 10);
        resizeHandle.setAttribute('data-resize', 'true');

        g.appendChild(rect);
        g.appendChild(text);
        g.appendChild(resizeHandle);
        blocksLayer.appendChild(g);
    }

    function darkenColor(hex, percent) {
        const num = parseInt(hex.slice(1), 16);
        const amt = Math.round(2.55 * percent);
        const R = Math.max(0, (num >> 16) - amt);
        const G = Math.max(0, ((num >> 8) & 0x00FF) - amt);
        const B = Math.max(0, (num & 0x0000FF) - amt);
        return `#${(1 << 24 | R << 16 | G << 8 | B).toString(16).slice(1)}`;
    }

    function selectBlock(blockId) {
        // Deselect previous
        if (state.selectedBlockId) {
            const prev = document.getElementById(state.selectedBlockId);
            if (prev) prev.classList.remove('selected');
        }
        state.selectedConnectionId = null;
        document.querySelectorAll('.connection.selected').forEach(el => el.classList.remove('selected'));

        state.selectedBlockId = blockId;

        if (blockId) {
            const el = document.getElementById(blockId);
            if (el) el.classList.add('selected');

            const block = state.blocks.find(b => b.id === blockId);
            if (block) {
                showProperties(block);
            }
        } else {
            hideProperties();
        }
    }

    function updateBlock(blockId, updates) {
        const block = state.blocks.find(b => b.id === blockId);
        if (!block) return;

        Object.assign(block, updates);
        renderBlock(block);
        if (state.selectedBlockId === blockId) {
            selectBlock(blockId);
        }

        // Update connections
        updateConnectionsForBlock(blockId);
    }

    function deleteBlock(blockId) {
        // Remove connections involving this block
        state.connections = state.connections.filter(conn => {
            if (conn.fromBlockId === blockId || conn.toBlockId === blockId) {
                const connEl = document.getElementById(conn.id);
                if (connEl) connEl.remove();
                return false;
            }
            return true;
        });

        // Remove block
        state.blocks = state.blocks.filter(b => b.id !== blockId);
        const el = document.getElementById(blockId);
        if (el) el.remove();

        if (state.selectedBlockId === blockId) {
            selectBlock(null);
        }
    }

    // ============================================
    // Connection Functions
    // ============================================
    function createConnection(fromBlockId, toBlockId) {
        if (fromBlockId === toBlockId) return null;

        // Check if connection already exists
        const exists = state.connections.some(
            c => (c.fromBlockId === fromBlockId && c.toBlockId === toBlockId) ||
                 (c.fromBlockId === toBlockId && c.toBlockId === fromBlockId)
        );
        if (exists) return null;

        const conn = {
            id: generateId('conn'),
            fromBlockId,
            toBlockId
        };
        state.connections.push(conn);
        renderConnection(conn);
        return conn;
    }

    function renderConnection(conn) {
        const existing = document.getElementById(conn.id);
        if (existing) existing.remove();

        const fromBlock = state.blocks.find(b => b.id === conn.fromBlockId);
        const toBlock = state.blocks.find(b => b.id === conn.toBlockId);
        if (!fromBlock || !toBlock) return;

        const from = getBlockCenter(fromBlock);
        const to = getBlockCenter(toBlock);

        // Calculate edge intersection points
        const fromEdge = getEdgePoint(fromBlock, to);
        const toEdge = getEdgePoint(toBlock, from);

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('id', conn.id);
        path.setAttribute('class', 'connection');
        path.setAttribute('d', `M ${fromEdge.x} ${fromEdge.y} L ${toEdge.x} ${toEdge.y}`);
        path.setAttribute('marker-end', 'url(#arrowhead)');
        path.setAttribute('data-conn-id', conn.id);

        connectionsLayer.appendChild(path);
    }

    function getEdgePoint(block, target) {
        const center = getBlockCenter(block);
        const dx = target.x - center.x;
        const dy = target.y - center.y;

        const halfWidth = block.width / 2;
        const halfHeight = block.height / 2;

        let x, y;

        if (Math.abs(dx) * halfHeight > Math.abs(dy) * halfWidth) {
            // Intersects left or right edge
            x = center.x + Math.sign(dx) * halfWidth;
            y = center.y + (dy * halfWidth) / Math.abs(dx);
        } else {
            // Intersects top or bottom edge
            x = center.x + (dx * halfHeight) / Math.abs(dy);
            y = center.y + Math.sign(dy) * halfHeight;
        }

        return { x, y };
    }

    function updateConnectionsForBlock(blockId) {
        state.connections.forEach(conn => {
            if (conn.fromBlockId === blockId || conn.toBlockId === blockId) {
                renderConnection(conn);
            }
        });
    }

    function selectConnection(connId) {
        // Deselect block
        selectBlock(null);

        // Deselect previous connection
        document.querySelectorAll('.connection.selected').forEach(el => el.classList.remove('selected'));

        state.selectedConnectionId = connId;
        if (connId) {
            const el = document.getElementById(connId);
            if (el) el.classList.add('selected');
        }
        hideProperties();
    }

    function deleteConnection(connId) {
        state.connections = state.connections.filter(c => c.id !== connId);
        const el = document.getElementById(connId);
        if (el) el.remove();

        if (state.selectedConnectionId === connId) {
            state.selectedConnectionId = null;
        }
    }

    // ============================================
    // Properties Panel
    // ============================================
    function showProperties(block) {
        blockLabel.value = block.label;
        blockColor.value = block.color;
        blockWidth.value = block.width;
        blockHeight.value = block.height;
        propertiesPanel.classList.remove('hidden');
    }

    function hideProperties() {
        propertiesPanel.classList.add('hidden');
    }

    // ============================================
    // Save/Load
    // ============================================
    function saveDiagram() {
        const data = {
            version: 1,
            blocks: state.blocks,
            connections: state.connections,
            nextBlockId: state.nextBlockId,
            nextConnectionId: state.nextConnectionId,
            viewBox: state.viewBox
        };
        localStorage.setItem('cbdiag-diagram', JSON.stringify(data));
        alert('Diagram saved!');
    }

    function loadDiagram() {
        const saved = localStorage.getItem('cbdiag-diagram');
        if (!saved) {
            alert('No saved diagram found.');
            return;
        }

        try {
            const data = JSON.parse(saved);
            clearDiagram(false);

            state.blocks = data.blocks || [];
            state.connections = data.connections || [];
            state.nextBlockId = data.nextBlockId || 1;
            state.nextConnectionId = data.nextConnectionId || 1;
            state.viewBox = data.viewBox || { x: 0, y: 0, width: 1200, height: 800 };

            updateViewBox();
            state.blocks.forEach(renderBlock);
            state.connections.forEach(renderConnection);

            alert('Diagram loaded!');
        } catch (e) {
            alert('Error loading diagram: ' + e.message);
        }
    }

    function clearDiagram(confirm = true) {
        if (confirm && !window.confirm('Clear the diagram? This cannot be undone.')) {
            return;
        }

        blocksLayer.innerHTML = '';
        connectionsLayer.innerHTML = '';

        state.blocks = [];
        state.connections = [];
        state.selectedBlockId = null;
        state.selectedConnectionId = null;
        state.nextBlockId = 1;
        state.nextConnectionId = 1;

        hideProperties();
    }

    // ============================================
    // Connection Mode
    // ============================================
    let tempLine = null;

    function enterConnectionMode() {
        state.mode = 'connecting';
        addConnectionBtn.classList.add('active');
        canvas.classList.add('connecting');
    }

    function exitConnectionMode() {
        state.mode = 'select';
        addConnectionBtn.classList.remove('active');
        canvas.classList.remove('connecting');
        state.connectionStart = null;
        if (tempLine) {
            tempLine.remove();
            tempLine = null;
        }
    }

    function updateTempLine(fromBlock, toPoint) {
        if (!tempLine) {
            tempLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            tempLine.setAttribute('class', 'connection-temp');
            connectionsLayer.appendChild(tempLine);
        }

        const from = getBlockCenter(fromBlock);
        const fromEdge = getEdgePoint(fromBlock, toPoint);
        tempLine.setAttribute('d', `M ${fromEdge.x} ${fromEdge.y} L ${toPoint.x} ${toPoint.y}`);
    }

    // ============================================
    // Event Handlers
    // ============================================
    function initEventHandlers() {
        // Toolbar
        addBlockBtn.addEventListener('click', () => {
            const center = {
                x: state.viewBox.x + state.viewBox.width / 2,
                y: state.viewBox.y + state.viewBox.height / 2
            };
            createBlock(center.x, center.y);
        });

        addConnectionBtn.addEventListener('click', () => {
            if (state.mode === 'connecting') {
                exitConnectionMode();
            } else {
                enterConnectionMode();
            }
        });

        deleteBtn.addEventListener('click', () => {
            if (state.selectedBlockId) {
                deleteBlock(state.selectedBlockId);
            } else if (state.selectedConnectionId) {
                deleteConnection(state.selectedConnectionId);
            }
        });

        saveBtn.addEventListener('click', saveDiagram);
        loadBtn.addEventListener('click', loadDiagram);
        clearBtn.addEventListener('click', () => clearDiagram(true));

        // Properties panel
        blockLabel.addEventListener('input', (e) => {
            if (state.selectedBlockId) {
                updateBlock(state.selectedBlockId, { label: e.target.value });
            }
        });

        blockColor.addEventListener('input', (e) => {
            if (state.selectedBlockId) {
                updateBlock(state.selectedBlockId, { color: e.target.value });
            }
        });

        blockWidth.addEventListener('change', (e) => {
            if (state.selectedBlockId) {
                updateBlock(state.selectedBlockId, { width: parseInt(e.target.value) || 120 });
            }
        });

        blockHeight.addEventListener('change', (e) => {
            if (state.selectedBlockId) {
                updateBlock(state.selectedBlockId, { height: parseInt(e.target.value) || 60 });
            }
        });

        // Canvas mouse events
        canvas.addEventListener('mousedown', handleMouseDown);
        canvas.addEventListener('mousemove', handleMouseMove);
        canvas.addEventListener('mouseup', handleMouseUp);
        canvas.addEventListener('wheel', handleWheel, { passive: false });

        // Keyboard
        document.addEventListener('keydown', handleKeyDown);
    }

    function handleMouseDown(e) {
        const point = screenToSvg(e.clientX, e.clientY);
        const target = e.target;
        const blockGroup = target.closest('.block');
        const connPath = target.closest('.connection');

        // Connection mode
        if (state.mode === 'connecting') {
            if (blockGroup) {
                const blockId = blockGroup.getAttribute('data-block-id');
                if (!state.connectionStart) {
                    state.connectionStart = blockId;
                } else if (state.connectionStart !== blockId) {
                    createConnection(state.connectionStart, blockId);
                    exitConnectionMode();
                }
            }
            return;
        }

        // Resize handle
        if (target.getAttribute('data-resize') === 'true') {
            const blockId = target.closest('.block').getAttribute('data-block-id');
            const block = state.blocks.find(b => b.id === blockId);
            if (block) {
                state.isResizing = true;
                state.selectedBlockId = blockId;
                state.resizeStart = {
                    x: point.x,
                    y: point.y,
                    width: block.width,
                    height: block.height
                };
                selectBlock(blockId);
            }
            e.preventDefault();
            return;
        }

        // Block click
        if (blockGroup) {
            const blockId = blockGroup.getAttribute('data-block-id');
            const block = state.blocks.find(b => b.id === blockId);

            selectBlock(blockId);

            if (block) {
                state.isDragging = true;
                state.dragOffset = {
                    x: point.x - block.x,
                    y: point.y - block.y
                };
            }
            e.preventDefault();
            return;
        }

        // Connection click
        if (connPath) {
            const connId = connPath.getAttribute('data-conn-id');
            selectConnection(connId);
            e.preventDefault();
            return;
        }

        // Canvas click - start panning or deselect
        selectBlock(null);
        state.selectedConnectionId = null;
        document.querySelectorAll('.connection.selected').forEach(el => el.classList.remove('selected'));

        state.isPanning = true;
        state.panStart = { x: e.clientX, y: e.clientY };
        canvas.classList.add('panning');
    }

    function handleMouseMove(e) {
        const point = screenToSvg(e.clientX, e.clientY);

        // Connection mode - draw temp line
        if (state.mode === 'connecting' && state.connectionStart) {
            const fromBlock = state.blocks.find(b => b.id === state.connectionStart);
            if (fromBlock) {
                updateTempLine(fromBlock, point);
            }
        }

        // Resizing
        if (state.isResizing && state.selectedBlockId) {
            const block = state.blocks.find(b => b.id === state.selectedBlockId);
            if (block) {
                const newWidth = Math.max(50, state.resizeStart.width + (point.x - state.resizeStart.x));
                const newHeight = Math.max(30, state.resizeStart.height + (point.y - state.resizeStart.y));
                updateBlock(state.selectedBlockId, { width: newWidth, height: newHeight });
            }
            return;
        }

        // Dragging block
        if (state.isDragging && state.selectedBlockId) {
            const newX = point.x - state.dragOffset.x;
            const newY = point.y - state.dragOffset.y;
            updateBlock(state.selectedBlockId, { x: newX, y: newY });
            return;
        }

        // Panning
        if (state.isPanning) {
            const rect = canvas.getBoundingClientRect();
            const scaleX = state.viewBox.width / rect.width;
            const scaleY = state.viewBox.height / rect.height;

            const dx = (e.clientX - state.panStart.x) * scaleX;
            const dy = (e.clientY - state.panStart.y) * scaleY;

            state.viewBox.x -= dx;
            state.viewBox.y -= dy;
            updateViewBox();

            state.panStart = { x: e.clientX, y: e.clientY };
        }
    }

    function handleMouseUp(e) {
        state.isDragging = false;
        state.isResizing = false;
        state.isPanning = false;
        canvas.classList.remove('panning');
    }

    function handleWheel(e) {
        e.preventDefault();

        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9;

        // Calculate mouse position in SVG coordinates before zoom
        const svgX = state.viewBox.x + (mouseX / rect.width) * state.viewBox.width;
        const svgY = state.viewBox.y + (mouseY / rect.height) * state.viewBox.height;

        // Apply zoom
        const newWidth = state.viewBox.width * zoomFactor;
        const newHeight = state.viewBox.height * zoomFactor;

        // Clamp zoom
        if (newWidth < 200 || newWidth > 5000) return;

        // Adjust viewBox to zoom toward mouse position
        state.viewBox.width = newWidth;
        state.viewBox.height = newHeight;
        state.viewBox.x = svgX - (mouseX / rect.width) * newWidth;
        state.viewBox.y = svgY - (mouseY / rect.height) * newHeight;

        updateViewBox();
    }

    function handleKeyDown(e) {
        // Delete key
        if (e.key === 'Delete' || e.key === 'Backspace') {
            // Don't delete if typing in input
            if (e.target.tagName === 'INPUT') return;

            if (state.selectedBlockId) {
                deleteBlock(state.selectedBlockId);
            } else if (state.selectedConnectionId) {
                deleteConnection(state.selectedConnectionId);
            }
        }

        // Escape to exit connection mode
        if (e.key === 'Escape') {
            if (state.mode === 'connecting') {
                exitConnectionMode();
            } else {
                selectBlock(null);
            }
        }
    }

    // ============================================
    // Initialize
    // ============================================
    function init() {
        updateViewBox();
        initEventHandlers();

        // Create a sample block to start
        createBlock(600, 400);
    }

    init();
})();
