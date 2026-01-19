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

        // Navigation history for proxy drill-down
        navigationStack: [], // Array of { diagramId, fromProxyBlockId }

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
    const propertiesTitle = document.getElementById('properties-title');
    const blockPropertiesDiv = document.getElementById('block-properties');
    const proxyPropertiesDiv = document.getElementById('proxy-properties');
    const diagramList = document.getElementById('diagram-list');
    const diagramNameInput = document.getElementById('diagram-name');
    const saveStatus = document.getElementById('save-status');
    const breadcrumb = document.getElementById('breadcrumb');

    // Toolbar buttons
    const newDiagramBtn = document.getElementById('new-diagram-btn');
    const addBlockBtn = document.getElementById('add-block-btn');
    const addProxyBtn = document.getElementById('add-proxy-btn');
    const addConnectionBtn = document.getElementById('add-connection-btn');
    const deleteBtn = document.getElementById('delete-btn');

    // Property inputs
    const blockLabel = document.getElementById('block-label');
    const blockColor = document.getElementById('block-color');
    const blockWidth = document.getElementById('block-width');
    const blockHeight = document.getElementById('block-height');
    const blockZIndex = document.getElementById('block-zindex');
    const bringToFrontBtn = document.getElementById('bring-to-front');
    const sendToBackBtn = document.getElementById('send-to-back');
    const proxyDiagramSelect = document.getElementById('proxy-diagram-select');

    // Modal elements
    const proxyModal = document.getElementById('proxy-modal');
    const proxyModalSelect = document.getElementById('proxy-modal-select');
    const proxyModalCancel = document.getElementById('proxy-modal-cancel');
    const proxyModalCreate = document.getElementById('proxy-modal-create');

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
        // Clear navigation when creating/switching to new diagram from sidebar
        state.navigationStack = [];
        switchDiagram(diagram.id);
        renderDiagramList();
        renderBreadcrumb();
        scheduleAutoSave();
        return diagram;
    }

    function switchDiagram(diagramId, addToHistory = false, fromProxyBlockId = null, skipBrowserHistory = false) {
        // Save current diagram state before switching
        if (state.currentDiagramId) {
            saveCurrentDiagramState();
        }

        const diagram = state.diagrams.find(d => d.id === diagramId);
        if (!diagram) return;

        // Add to navigation stack if drilling into a proxy
        if (addToHistory && state.currentDiagramId) {
            state.navigationStack.push({
                diagramId: state.currentDiagramId,
                fromProxyBlockId: fromProxyBlockId
            });
        }

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
        renderBreadcrumb();

        // Update browser history if not skipping
        if (!skipBrowserHistory) {
            const historyState = {
                diagramId: diagramId,
                navigationStack: [...state.navigationStack]
            };
            if (addToHistory) {
                history.pushState(historyState, '', `#diagram-${diagramId}`);
            } else {
                history.replaceState(historyState, '', `#diagram-${diagramId}`);
            }
        }
    }

    function navigateBack(toIndex) {
        if (state.navigationStack.length === 0) return;

        saveCurrentDiagramState();

        // If toIndex is provided, go back to that point
        if (typeof toIndex === 'number') {
            const target = state.navigationStack[toIndex];
            state.navigationStack = state.navigationStack.slice(0, toIndex);
            switchDiagram(target.diagramId);
            // Select the proxy block that was clicked to enter the diagram
            if (target.fromProxyBlockId) {
                selectBlock(target.fromProxyBlockId);
            }
        } else {
            // Go back one level
            const prev = state.navigationStack.pop();
            switchDiagram(prev.diagramId);
            // Select the proxy block that was clicked to enter the diagram
            if (prev.fromProxyBlockId) {
                selectBlock(prev.fromProxyBlockId);
            }
        }
    }

    function navigateIntoDiagram(diagramId, fromProxyBlockId) {
        switchDiagram(diagramId, true, fromProxyBlockId);
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

        // Clear navigation stack entries pointing to deleted diagram
        state.navigationStack = state.navigationStack.filter(n => n.diagramId !== diagramId);

        // If deleting current diagram, switch to another
        if (state.currentDiagramId === diagramId) {
            state.navigationStack = [];
            const newCurrent = state.diagrams[Math.min(index, state.diagrams.length - 1)];
            switchDiagram(newCurrent.id);
        }

        renderDiagramList();
        renderBreadcrumb();
        scheduleAutoSave();
    }

    function renameDiagram(diagramId, newName) {
        const diagram = state.diagrams.find(d => d.id === diagramId);
        if (!diagram) return;

        diagram.name = newName || 'Untitled Diagram';
        diagram.updatedAt = Date.now();
        renderDiagramList();
        renderBreadcrumb();
        scheduleAutoSave();
    }

    function getDiagramName(diagramId) {
        const diagram = state.diagrams.find(d => d.id === diagramId);
        return diagram ? diagram.name : 'Unknown';
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
                    // Clear navigation stack when switching via sidebar
                    state.navigationStack = [];
                    switchDiagram(diagram.id);
                }
            });

            diagramList.appendChild(item);
        });
    }

    function renderBreadcrumb() {
        breadcrumb.innerHTML = '';

        if (state.navigationStack.length === 0) {
            breadcrumb.classList.add('hidden');
            return;
        }

        breadcrumb.classList.remove('hidden');

        // Add each item in the navigation stack
        state.navigationStack.forEach((nav, index) => {
            const item = document.createElement('span');
            item.className = 'breadcrumb-item';
            item.textContent = getDiagramName(nav.diagramId);
            item.addEventListener('click', () => navigateBack(index));
            breadcrumb.appendChild(item);

            const sep = document.createElement('span');
            sep.className = 'breadcrumb-separator';
            sep.textContent = '>';
            breadcrumb.appendChild(sep);
        });

        // Add current diagram
        const current = document.createElement('span');
        current.className = 'breadcrumb-item current';
        current.textContent = getDiagramName(state.currentDiagramId);
        breadcrumb.appendChild(current);
    }

    function renderCanvas() {
        blocksLayer.innerHTML = '';
        connectionsLayer.innerHTML = '';

        // Sort blocks by zIndex before rendering (lower values first)
        const sortedBlocks = [...state.blocks].sort((a, b) => {
            const aZ = a.zIndex || 0;
            const bZ = b.zIndex || 0;
            // Use stable sort: if zIndex is equal, preserve array order
            return aZ - bZ || state.blocks.indexOf(a) - state.blocks.indexOf(b);
        });

        sortedBlocks.forEach(renderBlock);
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

    // Z-ordering utility functions
    function getMaxZIndex() {
        return state.blocks.reduce((max, block) => {
            const z = block.zIndex || 0;
            return Math.max(max, z);
        }, 0);
    }

    function getMinZIndex() {
        return state.blocks.reduce((min, block) => {
            const z = block.zIndex || 0;
            return Math.min(min, z);
        }, 0);
    }

    function bringToFront(blockId) {
        const maxZ = getMaxZIndex();
        updateBlock(blockId, { zIndex: maxZ + 1 });
    }

    function sendToBack(blockId) {
        const minZ = getMinZIndex();
        updateBlock(blockId, { zIndex: minZ - 1 });
    }

    // ============================================
    // Block Functions
    // ============================================
    function createBlock(x, y) {
        const block = {
            id: generateId('block'),
            type: 'block',
            x: x - 60,
            y: y - 30,
            width: 120,
            height: 60,
            label: 'Block',
            color: '#4a90d9',
            zIndex: getMaxZIndex() + 1
        };
        state.blocks.push(block);
        renderBlock(block);
        selectBlock(block.id);
        scheduleAutoSave();
        return block;
    }

    function createProxyBlock(x, y, linkedDiagramId) {
        const linkedDiagram = state.diagrams.find(d => d.id === linkedDiagramId);
        if (!linkedDiagram) return null;

        const block = {
            id: generateId('block'),
            type: 'proxy',
            x: x - 70,
            y: y - 35,
            width: 140,
            height: 70,
            label: linkedDiagram.name,
            color: '#8e44ad',
            linkedDiagramId: linkedDiagramId,
            zIndex: getMaxZIndex() + 1
        };
        state.blocks.push(block);
        renderBlock(block);
        selectBlock(block.id);
        scheduleAutoSave();
        return block;
    }

    function renderBlock(block) {
        // In test mode, blocksLayer might be null if not initialized
        if (!blocksLayer) return;

        const existing = document.getElementById(block.id);
        if (existing) existing.remove();

        const isProxy = block.type === 'proxy';

        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('id', block.id);
        g.setAttribute('class', 'block' + (isProxy ? ' proxy' : ''));
        g.setAttribute('data-block-id', block.id);
        if (isProxy) {
            g.setAttribute('data-proxy', 'true');
            g.setAttribute('data-linked-diagram', block.linkedDiagramId);
        }

        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', block.x);
        rect.setAttribute('y', block.y);
        rect.setAttribute('width', block.width);
        rect.setAttribute('height', block.height);
        rect.setAttribute('rx', isProxy ? 8 : 4);
        rect.setAttribute('fill', block.color);
        rect.setAttribute('stroke', darkenColor(block.color, 20));

        // For proxy blocks, update label from linked diagram name
        let labelText = block.label;
        if (isProxy && block.linkedDiagramId) {
            const linkedDiagram = state.diagrams.find(d => d.id === block.linkedDiagramId);
            if (linkedDiagram) {
                labelText = linkedDiagram.name;
                block.label = labelText;
            } else {
                labelText = '(Missing)';
            }
        }

        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', block.x + block.width / 2);
        text.setAttribute('y', block.y + block.height / 2 + (isProxy ? 0 : 5));
        text.setAttribute('text-anchor', 'middle');
        text.textContent = labelText;

        g.appendChild(rect);
        g.appendChild(text);

        // Add proxy indicator icon
        if (isProxy) {
            const icon = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            icon.setAttribute('class', 'proxy-icon');
            icon.setAttribute('x', block.x + block.width / 2);
            icon.setAttribute('y', block.y + block.height / 2 + 18);
            icon.setAttribute('text-anchor', 'middle');
            icon.setAttribute('font-size', '10');
            icon.setAttribute('fill', 'rgba(255,255,255,0.7)');
            icon.textContent = '[ click to enter ]';
            g.appendChild(icon);
        }

        const resizeHandle = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        resizeHandle.setAttribute('class', 'resize-handle');
        resizeHandle.setAttribute('x', block.x + block.width - 10);
        resizeHandle.setAttribute('y', block.y + block.height - 10);
        resizeHandle.setAttribute('width', 10);
        resizeHandle.setAttribute('height', 10);
        resizeHandle.setAttribute('data-resize', 'true');

        g.appendChild(resizeHandle);

        // Insert block at correct position based on z-index
        const currentZ = block.zIndex || 0;
        const existingBlocks = Array.from(blocksLayer.children);
        let insertBefore = null;

        for (const existingG of existingBlocks) {
            const existingBlockId = existingG.getAttribute('data-block-id');
            const existingBlock = state.blocks.find(b => b.id === existingBlockId);
            if (existingBlock) {
                const existingZ = existingBlock.zIndex || 0;
                if (existingZ > currentZ) {
                    insertBefore = existingG;
                    break;
                }
            }
        }

        if (insertBefore) {
            blocksLayer.insertBefore(g, insertBefore);
        } else {
            blocksLayer.appendChild(g);
        }
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
        const isProxy = block.type === 'proxy';

        propertiesTitle.textContent = isProxy ? 'Proxy Properties' : 'Block Properties';

        if (isProxy) {
            blockPropertiesDiv.classList.add('hidden');
            proxyPropertiesDiv.classList.remove('hidden');
            populateProxyDiagramSelect(proxyDiagramSelect, block.linkedDiagramId);
        } else {
            blockPropertiesDiv.classList.remove('hidden');
            proxyPropertiesDiv.classList.add('hidden');
            blockLabel.value = block.label;
            blockColor.value = block.color;
        }

        blockWidth.value = block.width;
        blockHeight.value = block.height;
        blockZIndex.value = block.zIndex || 0;
        propertiesPanel.classList.remove('hidden');
    }

    function hideProperties() {
        propertiesPanel.classList.add('hidden');
    }

    function populateProxyDiagramSelect(selectEl, selectedId = null) {
        selectEl.innerHTML = '<option value="">Select a diagram...</option>';

        state.diagrams.forEach(diagram => {
            // Don't allow linking to current diagram
            if (diagram.id === state.currentDiagramId) return;

            const option = document.createElement('option');
            option.value = diagram.id;
            option.textContent = diagram.name;
            if (diagram.id === selectedId) {
                option.selected = true;
            }
            selectEl.appendChild(option);
        });
    }

    // ============================================
    // Proxy Modal
    // ============================================
    function showProxyModal() {
        populateProxyDiagramSelect(proxyModalSelect);
        proxyModal.classList.remove('hidden');
    }

    function hideProxyModal() {
        proxyModal.classList.add('hidden');
        proxyModalSelect.value = '';
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

        addProxyBtn.addEventListener('click', () => {
            if (state.diagrams.length < 2) {
                alert('Create at least one other diagram first to link to.');
                return;
            }
            showProxyModal();
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

        // Proxy modal
        proxyModalCancel.addEventListener('click', hideProxyModal);
        proxyModalCreate.addEventListener('click', () => {
            const selectedDiagramId = proxyModalSelect.value;
            if (!selectedDiagramId) {
                alert('Please select a diagram.');
                return;
            }
            const center = {
                x: state.viewBox.x + state.viewBox.width / 2,
                y: state.viewBox.y + state.viewBox.height / 2
            };
            createProxyBlock(center.x, center.y, selectedDiagramId);
            hideProxyModal();
        });

        // Close modal on backdrop click
        proxyModal.addEventListener('click', (e) => {
            if (e.target === proxyModal) {
                hideProxyModal();
            }
        });

        // Properties panel - block properties
        blockLabel.addEventListener('input', (e) => {
            if (state.selectedBlockId) {
                const block = state.blocks.find(b => b.id === state.selectedBlockId);
                if (block && block.type !== 'proxy') {
                    updateBlock(state.selectedBlockId, { label: e.target.value });
                }
            }
        });

        blockColor.addEventListener('input', (e) => {
            if (state.selectedBlockId) {
                const block = state.blocks.find(b => b.id === state.selectedBlockId);
                if (block && block.type !== 'proxy') {
                    updateBlock(state.selectedBlockId, { color: e.target.value });
                }
            }
        });

        // Properties panel - proxy properties
        proxyDiagramSelect.addEventListener('change', (e) => {
            if (state.selectedBlockId) {
                const block = state.blocks.find(b => b.id === state.selectedBlockId);
                if (block && block.type === 'proxy' && e.target.value) {
                    updateBlock(state.selectedBlockId, { linkedDiagramId: e.target.value });
                }
            }
        });

        // Properties panel - common properties
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

        blockZIndex.addEventListener('change', (e) => {
            if (state.selectedBlockId) {
                updateBlock(state.selectedBlockId, { zIndex: parseInt(e.target.value) || 0 });
            }
        });

        bringToFrontBtn.addEventListener('click', () => {
            if (state.selectedBlockId) {
                bringToFront(state.selectedBlockId);
            }
        });

        sendToBackBtn.addEventListener('click', () => {
            if (state.selectedBlockId) {
                sendToBack(state.selectedBlockId);
            }
        });

        // Canvas mouse events
        canvas.addEventListener('mousedown', handleMouseDown);
        canvas.addEventListener('mousemove', handleMouseMove);
        canvas.addEventListener('mouseup', handleMouseUp);
        canvas.addEventListener('dblclick', handleDoubleClick);
        canvas.addEventListener('wheel', handleWheel, { passive: false });

        // Keyboard
        document.addEventListener('keydown', handleKeyDown);

        // Save before leaving
        window.addEventListener('beforeunload', () => {
            if (state.isDirty) {
                saveAllDiagrams();
            }
        });

        // Browser back/forward button support
        window.addEventListener('popstate', (e) => {
            if (e.state) {
                const { diagramId, navigationStack } = e.state;
                state.navigationStack = navigationStack || [];
                switchDiagram(diagramId, false, null, true);
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

    function handleDoubleClick(e) {
        const target = e.target;
        const blockGroup = target.closest('.block');

        if (blockGroup && blockGroup.getAttribute('data-proxy') === 'true') {
            const linkedDiagramId = blockGroup.getAttribute('data-linked-diagram');
            const blockId = blockGroup.getAttribute('data-block-id');
            if (linkedDiagramId) {
                const diagram = state.diagrams.find(d => d.id === linkedDiagramId);
                if (diagram) {
                    navigateIntoDiagram(linkedDiagramId, blockId);
                } else {
                    alert('Linked diagram not found. It may have been deleted.');
                }
            }
        }
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
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

            if (state.selectedBlockId) {
                deleteBlock(state.selectedBlockId);
            } else if (state.selectedConnectionId) {
                deleteConnection(state.selectedConnectionId);
            }
        }

        if (e.key === 'Escape') {
            if (proxyModal && !proxyModal.classList.contains('hidden')) {
                hideProxyModal();
            } else if (state.mode === 'connecting') {
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

        const loaded = loadAllDiagrams();
        if (!loaded || state.diagrams.length === 0) {
            createDiagram('My First Diagram');
        }

        renderDiagramList();
        renderBreadcrumb();

        // Set initial browser history state
        if (state.currentDiagramId) {
            history.replaceState({
                diagramId: state.currentDiagramId,
                navigationStack: [...state.navigationStack]
            }, '', `#diagram-${state.currentDiagramId}`);
        }
    }

    // Don't auto-init in test mode
    if (typeof window === 'undefined' || !window.__TEST_MODE__) {
        init();
    }

    // ============================================
    // Test Mode Exports
    // ============================================
    // Expose internal functions for testing
    if (typeof window !== 'undefined' && window.__TEST_MODE__) {
        window.__cbdiag__ = {
            // Core operations
            createBlock,
            updateBlock,
            deleteBlock,
            selectBlock,
            renderBlock,
            createConnection,
            renderConnection,
            deleteConnection,
            updateConnectionsForBlock,
            createDiagram,
            switchDiagram,
            deleteDiagram,
            renameDiagram,
            createProxyBlock,
            navigateIntoDiagram,
            navigateBack,

            // Utilities
            screenToSvg,
            getBlockCenter,
            getAnchorPoint,
            getBestSides,
            darkenColor,
            generateId,
            getMaxZIndex,
            getMinZIndex,
            bringToFront,
            sendToBack,

            // Persistence
            saveAllDiagrams,
            loadAllDiagrams,
            scheduleAutoSave,

            // Initialization
            init,
            initEventHandlers,

            // State management (use carefully in tests)
            getState: () => ({
                diagrams: [...state.diagrams],
                currentDiagramId: state.currentDiagramId,
                blocks: [...state.blocks],
                connections: [...state.connections],
                selectedBlockId: state.selectedBlockId,
                selectedConnectionId: state.selectedConnectionId,
                navigationStack: [...state.navigationStack]
            }),
            resetState: () => {
                state.diagrams = [];
                state.currentDiagramId = null;
                state.blocks = [];
                state.connections = [];
                state.nextBlockId = 1;
                state.nextConnectionId = 1;
                state.navigationStack = [];
                state.selectedBlockId = null;
                state.selectedConnectionId = null;
                state.mode = 'select';
                state.connectionStart = null;
                // Safely clear DOM (elements might be null in tests)
                if (blocksLayer) blocksLayer.innerHTML = '';
                if (connectionsLayer) connectionsLayer.innerHTML = '';
                if (diagramList) diagramList.innerHTML = '';
                if (propertiesPanel) hideProperties();
            }
        };
    }
})();
