// cbdiag - Block Diagram Tool
// Main Application

(function() {
    'use strict';

    // ============================================
    // State
    // ============================================
    const state = {
        // All diagrams
        diagrams: [],
        currentDiagramId: null,

        // Current diagram data (references for convenience)
        blocks: [],
        connections: [],
        nextBlockId: 1,
        nextConnectionId: 1,
        viewBox: { x: 0, y: 0, width: 1200, height: 800 },

        // UI state
        selectedBlockId: null,
        selectedConnectionId: null,
        mode: 'select', // 'select', 'connecting'
        connectionStart: null,

        // Pan/zoom state
        isPanning: false,
        panStart: { x: 0, y: 0 },

        // Drag state
        isDragging: false,
        dragOffset: { x: 0, y: 0 },

        // Resize state
        isResizing: false,
        resizeStart: { x: 0, y: 0, width: 0, height: 0 },

        // Auto-save
        saveTimeout: null,
        isDirty: false
    };

    // ============================================
    // DOM Elements
    // ============================================
    const canvas = document.getElementById('canvas');
    const blocksLayer = document.getElementById('blocks-layer');
    const connectionsLayer = document.getElementById('connections-layer');
    const propertiesPanel = document.getElementById('properties-panel');
    const diagramList = document.getElementById('diagram-list');
    const diagramNameInput = document.getElementById('diagram-name');
    const saveStatus = document.getElementById('save-status');

    // Toolbar buttons
    const newDiagramBtn = document.getElementById('new-diagram-btn');
    const addBlockBtn = document.getElementById('add-block-btn');
    const addConnectionBtn = document.getElementById('add-connection-btn');
    const deleteBtn = document.getElementById('delete-btn');

    // Property inputs
    const blockLabel = document.getElementById('block-label');
    const blockColor = document.getElementById('block-color');
    const blockWidth = document.getElementById('block-width');
    const blockHeight = document.getElementById('block-height');

    // ============================================
    // Diagram Management
    // ============================================
    function generateDiagramId() {
        return 'diagram-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    }

    function createDiagram(name = 'Untitled Diagram') {
        const diagram = {
            id: generateDiagramId(),
            name: name,
            blocks: [],
            connections: [],
            nextBlockId: 1,
            nextConnectionId: 1,
            viewBox: { x: 0, y: 0, width: 1200, height: 800 },
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        state.diagrams.push(diagram);
        switchDiagram(diagram.id);
        renderDiagramList();
        scheduleAutoSave();
        return diagram;
    }

    function switchDiagram(diagramId) {
        // Save current diagram state before switching
        if (state.currentDiagramId) {
            saveCurrentDiagramState();
        }

        const diagram = state.diagrams.find(d => d.id === diagramId);
        if (!diagram) return;

        state.currentDiagramId = diagramId;

        // Load diagram data into state
        state.blocks = diagram.blocks;
        state.connections = diagram.connections;
        state.nextBlockId = diagram.nextBlockId;
        state.nextConnectionId = diagram.nextConnectionId;
        state.viewBox = diagram.viewBox;

        // Clear selection
        state.selectedBlockId = null;
        state.selectedConnectionId = null;
        hideProperties();

        // Update UI
        diagramNameInput.value = diagram.name;
        updateViewBox();
        renderCanvas();
        renderDiagramList();
    }

    function saveCurrentDiagramState() {
        const diagram = state.diagrams.find(d => d.id === state.currentDiagramId);
        if (!diagram) return;

        diagram.blocks = state.blocks;
        diagram.connections = state.connections;
        diagram.nextBlockId = state.nextBlockId;
        diagram.nextConnectionId = state.nextConnectionId;
        diagram.viewBox = { ...state.viewBox };
        diagram.updatedAt = Date.now();
    }

    function deleteDiagram(diagramId) {
        if (state.diagrams.length <= 1) {
            alert('Cannot delete the last diagram.');
            return;
        }

        if (!confirm('Delete this diagram? This cannot be undone.')) {
            return;
        }

        const index = state.diagrams.findIndex(d => d.id === diagramId);
        if (index === -1) return;

        state.diagrams.splice(index, 1);

        // If deleting current diagram, switch to another
        if (state.currentDiagramId === diagramId) {
            const newCurrent = state.diagrams[Math.min(index, state.diagrams.length - 1)];
            switchDiagram(newCurrent.id);
        }

        renderDiagramList();
        scheduleAutoSave();
    }

    function renameDiagram(diagramId, newName) {
        const diagram = state.diagrams.find(d => d.id === diagramId);
        if (!diagram) return;

        diagram.name = newName || 'Untitled Diagram';
        diagram.updatedAt = Date.now();
        renderDiagramList();
        scheduleAutoSave();
    }

    function renderDiagramList() {
        diagramList.innerHTML = '';

        state.diagrams.forEach(diagram => {
            const item = document.createElement('div');
            item.className = 'diagram-item' + (diagram.id === state.currentDiagramId ? ' active' : '');
            item.setAttribute('data-diagram-id', diagram.id);

            const name = document.createElement('span');
            name.className = 'diagram-item-name';
            name.textContent = diagram.name;

            const deleteButton = document.createElement('button');
            deleteButton.className = 'diagram-item-delete';
            deleteButton.textContent = '\u00d7';
            deleteButton.title = 'Delete diagram';
            deleteButton.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteDiagram(diagram.id);
            });

            item.appendChild(name);
            item.appendChild(deleteButton);

            item.addEventListener('click', () => {
                if (diagram.id !== state.currentDiagramId) {
                    switchDiagram(diagram.id);
                }
            });

            diagramList.appendChild(item);
        });
    }

    function renderCanvas() {
        blocksLayer.innerHTML = '';
        connectionsLayer.innerHTML = '';

        state.blocks.forEach(renderBlock);
        state.connections.forEach(renderConnection);
    }

    // ============================================
    // Persistence
    // ============================================
    function saveAllDiagrams() {
        saveCurrentDiagramState();

        const data = {
            version: 2,
            diagrams: state.diagrams,
            currentDiagramId: state.currentDiagramId
        };

        localStorage.setItem('cbdiag-data', JSON.stringify(data));
        state.isDirty = false;
        updateSaveStatus('Saved');
    }

    function loadAllDiagrams() {
        // Try new format first
        const saved = localStorage.getItem('cbdiag-data');
        if (saved) {
            try {
                const data = JSON.parse(saved);
                if (data.version === 2 && data.diagrams) {
                    state.diagrams = data.diagrams;
                    const currentId = data.currentDiagramId || (data.diagrams[0] && data.diagrams[0].id);
                    if (currentId) {
                        switchDiagram(currentId);
                    }
                    return true;
                }
            } catch (e) {
                console.error('Error loading diagrams:', e);
            }
        }

        // Try migrating old format
        const oldSaved = localStorage.getItem('cbdiag-diagram');
        if (oldSaved) {
            try {
                const oldData = JSON.parse(oldSaved);
                const migrated = {
                    id: generateDiagramId(),
                    name: 'Migrated Diagram',
                    blocks: oldData.blocks || [],
                    connections: oldData.connections || [],
                    nextBlockId: oldData.nextBlockId || 1,
                    nextConnectionId: oldData.nextConnectionId || 1,
                    viewBox: oldData.viewBox || { x: 0, y: 0, width: 1200, height: 800 },
                    createdAt: Date.now(),
                    updatedAt: Date.now()
                };
                state.diagrams = [migrated];
                switchDiagram(migrated.id);
                // Remove old format
                localStorage.removeItem('cbdiag-diagram');
                saveAllDiagrams();
                return true;
            } catch (e) {
                console.error('Error migrating old diagram:', e);
            }
        }

        return false;
    }

    function scheduleAutoSave() {
        state.isDirty = true;
        updateSaveStatus('Saving...');

        if (state.saveTimeout) {
            clearTimeout(state.saveTimeout);
        }

        state.saveTimeout = setTimeout(() => {
            saveAllDiagrams();
        }, 1000);
    }

    function updateSaveStatus(text) {
        saveStatus.textContent = text;
    }

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
        scheduleAutoSave();
        return block;
    }

    function renderBlock(block) {
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

    function updateBlock(blockId, updates, triggerSave = true) {
        const block = state.blocks.find(b => b.id === blockId);
        if (!block) return;

        Object.assign(block, updates);
        renderBlock(block);
        if (state.selectedBlockId === blockId) {
            selectBlock(blockId);
        }

        updateConnectionsForBlock(blockId);
        if (triggerSave) scheduleAutoSave();
    }

    function deleteBlock(blockId) {
        state.connections = state.connections.filter(conn => {
            if (conn.fromBlockId === blockId || conn.toBlockId === blockId) {
                const connEl = document.getElementById(conn.id);
                if (connEl) connEl.remove();
                return false;
            }
            return true;
        });

        state.blocks = state.blocks.filter(b => b.id !== blockId);
        const el = document.getElementById(blockId);
        if (el) el.remove();

        if (state.selectedBlockId === blockId) {
            selectBlock(null);
        }
        scheduleAutoSave();
    }

    // ============================================
    // Connection Functions
    // ============================================
    function getAnchorPoint(block, side) {
        const center = getBlockCenter(block);
        switch (side) {
            case 'top':
                return { x: center.x, y: block.y };
            case 'bottom':
                return { x: center.x, y: block.y + block.height };
            case 'left':
                return { x: block.x, y: center.y };
            case 'right':
                return { x: block.x + block.width, y: center.y };
            default:
                return center;
        }
    }

    function getBestSides(fromBlock, toBlock) {
        const fromCenter = getBlockCenter(fromBlock);
        const toCenter = getBlockCenter(toBlock);

        const dx = toCenter.x - fromCenter.x;
        const dy = toCenter.y - fromCenter.y;

        let fromSide, toSide;

        if (Math.abs(dx) >= Math.abs(dy)) {
            if (dx >= 0) {
                fromSide = 'right';
                toSide = 'left';
            } else {
                fromSide = 'left';
                toSide = 'right';
            }
        } else {
            if (dy > 0) {
                fromSide = 'bottom';
                toSide = 'top';
            } else {
                fromSide = 'top';
                toSide = 'bottom';
            }
        }

        return { fromSide, toSide };
    }

    function createConnection(fromBlockId, toBlockId) {
        if (fromBlockId === toBlockId) return null;

        const exists = state.connections.some(
            c => (c.fromBlockId === fromBlockId && c.toBlockId === toBlockId) ||
                 (c.fromBlockId === toBlockId && c.toBlockId === fromBlockId)
        );
        if (exists) return null;

        const fromBlock = state.blocks.find(b => b.id === fromBlockId);
        const toBlock = state.blocks.find(b => b.id === toBlockId);
        if (!fromBlock || !toBlock) return null;

        const { fromSide, toSide } = getBestSides(fromBlock, toBlock);

        const conn = {
            id: generateId('conn'),
            fromBlockId,
            toBlockId,
            fromSide,
            toSide
        };
        state.connections.push(conn);
        renderConnection(conn);
        scheduleAutoSave();
        return conn;
    }

    function renderConnection(conn) {
        const existing = document.getElementById(conn.id);
        if (existing) existing.remove();

        const fromBlock = state.blocks.find(b => b.id === conn.fromBlockId);
        const toBlock = state.blocks.find(b => b.id === conn.toBlockId);
        if (!fromBlock || !toBlock) return;

        let fromSide = conn.fromSide;
        let toSide = conn.toSide;
        if (!fromSide || !toSide) {
            const sides = getBestSides(fromBlock, toBlock);
            fromSide = sides.fromSide;
            toSide = sides.toSide;
        }

        const fromPoint = getAnchorPoint(fromBlock, fromSide);
        const toPoint = getAnchorPoint(toBlock, toSide);

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('id', conn.id);
        path.setAttribute('class', 'connection');
        path.setAttribute('d', `M ${fromPoint.x} ${fromPoint.y} L ${toPoint.x} ${toPoint.y}`);
        path.setAttribute('marker-end', 'url(#arrowhead)');
        path.setAttribute('data-conn-id', conn.id);

        connectionsLayer.appendChild(path);
    }

    function updateConnectionsForBlock(blockId) {
        state.connections.forEach(conn => {
            if (conn.fromBlockId === blockId || conn.toBlockId === blockId) {
                renderConnection(conn);
            }
        });
    }

    function selectConnection(connId) {
        selectBlock(null);
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
        scheduleAutoSave();
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

        const tempBlock = { x: toPoint.x, y: toPoint.y, width: 0, height: 0 };
        const { fromSide } = getBestSides(fromBlock, tempBlock);
        const fromEdge = getAnchorPoint(fromBlock, fromSide);
        tempLine.setAttribute('d', `M ${fromEdge.x} ${fromEdge.y} L ${toPoint.x} ${toPoint.y}`);
    }

    // ============================================
    // Event Handlers
    // ============================================
    function initEventHandlers() {
        // New diagram button
        newDiagramBtn.addEventListener('click', () => {
            createDiagram();
        });

        // Diagram name input
        diagramNameInput.addEventListener('input', (e) => {
            if (state.currentDiagramId) {
                renameDiagram(state.currentDiagramId, e.target.value);
            }
        });

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

        // Save before leaving
        window.addEventListener('beforeunload', () => {
            if (state.isDirty) {
                saveAllDiagrams();
            }
        });
    }

    function handleMouseDown(e) {
        const point = screenToSvg(e.clientX, e.clientY);
        const target = e.target;
        const blockGroup = target.closest('.block');
        const connPath = target.closest('.connection');

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

        if (connPath) {
            const connId = connPath.getAttribute('data-conn-id');
            selectConnection(connId);
            e.preventDefault();
            return;
        }

        selectBlock(null);
        state.selectedConnectionId = null;
        document.querySelectorAll('.connection.selected').forEach(el => el.classList.remove('selected'));

        state.isPanning = true;
        state.panStart = { x: e.clientX, y: e.clientY };
        canvas.classList.add('panning');
    }

    function handleMouseMove(e) {
        const point = screenToSvg(e.clientX, e.clientY);

        if (state.mode === 'connecting' && state.connectionStart) {
            const fromBlock = state.blocks.find(b => b.id === state.connectionStart);
            if (fromBlock) {
                updateTempLine(fromBlock, point);
            }
        }

        if (state.isResizing && state.selectedBlockId) {
            const block = state.blocks.find(b => b.id === state.selectedBlockId);
            if (block) {
                const newWidth = Math.max(50, state.resizeStart.width + (point.x - state.resizeStart.x));
                const newHeight = Math.max(30, state.resizeStart.height + (point.y - state.resizeStart.y));
                updateBlock(state.selectedBlockId, { width: newWidth, height: newHeight }, false);
            }
            return;
        }

        if (state.isDragging && state.selectedBlockId) {
            const newX = point.x - state.dragOffset.x;
            const newY = point.y - state.dragOffset.y;
            updateBlock(state.selectedBlockId, { x: newX, y: newY }, false);
            return;
        }

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
        if (state.isDragging || state.isResizing) {
            scheduleAutoSave();
        }
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

        const svgX = state.viewBox.x + (mouseX / rect.width) * state.viewBox.width;
        const svgY = state.viewBox.y + (mouseY / rect.height) * state.viewBox.height;

        const newWidth = state.viewBox.width * zoomFactor;
        const newHeight = state.viewBox.height * zoomFactor;

        if (newWidth < 200 || newWidth > 5000) return;

        state.viewBox.width = newWidth;
        state.viewBox.height = newHeight;
        state.viewBox.x = svgX - (mouseX / rect.width) * newWidth;
        state.viewBox.y = svgY - (mouseY / rect.height) * newHeight;

        updateViewBox();
        scheduleAutoSave();
    }

    function handleKeyDown(e) {
        if (e.key === 'Delete' || e.key === 'Backspace') {
            if (e.target.tagName === 'INPUT') return;

            if (state.selectedBlockId) {
                deleteBlock(state.selectedBlockId);
            } else if (state.selectedConnectionId) {
                deleteConnection(state.selectedConnectionId);
            }
        }

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
        initEventHandlers();

        // Load existing diagrams or create first one
        const loaded = loadAllDiagrams();
        if (!loaded || state.diagrams.length === 0) {
            createDiagram('My First Diagram');
        }

        renderDiagramList();
    }

    init();
})();
