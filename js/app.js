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
        resizeCorner: null, // 'nw', 'ne', 'sw', 'se'
        resizeStart: { x: 0, y: 0, width: 0, height: 0, blockX: 0, blockY: 0 },

        // Auto-save
        saveTimeout: null,
        isDirty: false,

        // Nesting state
        isParentingPreview: false,
        parentingTarget: null,
        parentingTimer: null,
        isUnparentingPreview: false,

        // Undo/Redo state
        undoStack: [],
        redoStack: [],
        maxUndoDepth: 50,
        dragStartPos: null,
        resizeStartSize: null,

        // Transparency during drag state (for making higher z-index blocks transparent)
        dragTransparentBlocks: [] // Array of { blockId, originalOpacity }
    };

    // ============================================
    // Nesting Constants
    // ============================================
    const NESTING_CONSTANTS = {
        PARENT_PADDING: 20,           // Min padding between parent edge and children
        PARENTING_HOLD_DELAY: 500,    // ms to hold before parenting activates
        MIN_PARENT_SIZE_BUFFER: 40    // Extra buffer when auto-resizing parent
    };

    // ============================================
    // Block Colors
    // ============================================
    const BLOCK_COLORS = [
        '#4a90d9', // Blue
        '#50c878', // Emerald
        '#f5a623', // Orange
        '#9b59b6', // Purple
        '#e74c3c', // Red
        '#1abc9c', // Teal
        '#f39c12', // Yellow
        '#3498db', // Light Blue
        '#e91e63', // Pink
        '#00bcd4'  // Cyan
    ];

    function getRandomColor() {
        return BLOCK_COLORS[Math.floor(Math.random() * BLOCK_COLORS.length)];
    }

    // ============================================
    // Command Classes for Undo/Redo
    // ============================================
    function deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    class CreateBlockCommand {
        constructor(x, y, parentBlockId, blockData) {
            this.x = x;
            this.y = y;
            this.parentBlockId = parentBlockId;
            this.blockSnapshot = blockData ? deepClone(blockData) : null;
            this.createdBlockId = blockData ? blockData.id : null;
        }
        execute() {
            if (this.blockSnapshot) {
                restoreBlock(this.blockSnapshot);
                this.createdBlockId = this.blockSnapshot.id;
            }
        }
        undo() {
            deleteBlockInternal(this.createdBlockId, false);
        }
    }

    class DeleteBlockCommand {
        constructor(blockId) {
            this.blockId = blockId;
            this.blockSnapshot = null;
            this.childSnapshots = [];
            this.connectionSnapshots = [];
            this.parentId = null;
        }
        execute() {
            const block = state.blocks.find(b => b.id === this.blockId);
            if (!block) return;

            // Capture state before deleting
            this.blockSnapshot = deepClone(block);
            this.parentId = block.parentBlockId;

            // Capture all descendants
            const descendants = getDescendants(this.blockId);
            this.childSnapshots = descendants.map(deepClone);

            // Capture all connections involving this block or its descendants
            const allBlockIds = [this.blockId, ...descendants.map(d => d.id)];
            this.connectionSnapshots = state.connections
                .filter(c => allBlockIds.includes(c.fromBlockId) || allBlockIds.includes(c.toBlockId))
                .map(deepClone);

            deleteBlockInternal(this.blockId, true);
        }
        undo() {
            // Restore block first
            restoreBlock(this.blockSnapshot);

            // Restore children in order
            this.childSnapshots.forEach(snapshot => restoreBlock(snapshot));

            // Restore connections
            this.connectionSnapshots.forEach(snapshot => restoreConnection(snapshot));
        }
    }

    class UpdateBlockCommand {
        constructor(blockId, updates, previousValues) {
            this.blockId = blockId;
            this.updates = deepClone(updates);
            this.previousValues = deepClone(previousValues);
        }
        execute() {
            updateBlockInternal(this.blockId, this.updates, false);
        }
        undo() {
            updateBlockInternal(this.blockId, this.previousValues, false);
        }
    }

    class MoveBlockCommand {
        constructor(blockId, oldX, oldY, newX, newY) {
            this.blockId = blockId;
            this.oldX = oldX;
            this.oldY = oldY;
            this.newX = newX;
            this.newY = newY;
        }
        execute() {
            updateBlockInternal(this.blockId, { x: this.newX, y: this.newY }, false);
        }
        undo() {
            updateBlockInternal(this.blockId, { x: this.oldX, y: this.oldY }, false);
        }
    }

    class ResizeBlockCommand {
        constructor(blockId, oldX, oldY, oldW, oldH, newX, newY, newW, newH) {
            this.blockId = blockId;
            this.oldX = oldX;
            this.oldY = oldY;
            this.oldW = oldW;
            this.oldH = oldH;
            this.newX = newX;
            this.newY = newY;
            this.newW = newW;
            this.newH = newH;
        }
        execute() {
            updateBlockInternal(this.blockId, { x: this.newX, y: this.newY, width: this.newW, height: this.newH }, false);
        }
        undo() {
            updateBlockInternal(this.blockId, { x: this.oldX, y: this.oldY, width: this.oldW, height: this.oldH }, false);
        }
    }

    class CreateConnectionCommand {
        constructor(fromBlockId, toBlockId, connectionData) {
            this.fromBlockId = fromBlockId;
            this.toBlockId = toBlockId;
            this.connectionSnapshot = connectionData ? deepClone(connectionData) : null;
            this.createdConnId = connectionData ? connectionData.id : null;
        }
        execute() {
            if (this.connectionSnapshot) {
                restoreConnection(this.connectionSnapshot);
                this.createdConnId = this.connectionSnapshot.id;
            }
        }
        undo() {
            deleteConnectionInternal(this.createdConnId);
        }
    }

    class DeleteConnectionCommand {
        constructor(connId) {
            this.connId = connId;
            this.connectionSnapshot = null;
        }
        execute() {
            const conn = state.connections.find(c => c.id === this.connId);
            if (conn) {
                this.connectionSnapshot = deepClone(conn);
            }
            deleteConnectionInternal(this.connId);
        }
        undo() {
            if (this.connectionSnapshot) {
                restoreConnection(this.connectionSnapshot);
            }
        }
    }

    class UpdateConnectionCommand {
        constructor(connId, updates, previousValues) {
            this.connId = connId;
            this.updates = deepClone(updates);
            this.previousValues = deepClone(previousValues);
        }
        execute() {
            updateConnectionInternal(this.connId, this.updates, false);
        }
        undo() {
            updateConnectionInternal(this.connId, this.previousValues, false);
        }
    }

    class ParentBlockCommand {
        constructor(childId, newParentId, oldParentId, oldPosition, newPosition) {
            this.childId = childId;
            this.newParentId = newParentId;
            this.oldParentId = oldParentId;
            this.oldPosition = oldPosition;
            this.newPosition = newPosition;
        }
        execute() {
            performParentingInternal(this.childId, this.newParentId);
        }
        undo() {
            if (this.oldParentId) {
                performParentingInternal(this.childId, this.oldParentId);
            } else {
                performUnparentingInternal(this.childId);
            }
            // Restore original position
            updateBlockInternal(this.childId, { x: this.oldPosition.x, y: this.oldPosition.y }, false);
        }
    }

    class UnparentBlockCommand {
        constructor(childId, oldParentId, oldPosition, newPosition) {
            this.childId = childId;
            this.oldParentId = oldParentId;
            this.oldPosition = oldPosition;
            this.newPosition = newPosition;
        }
        execute() {
            performUnparentingInternal(this.childId);
        }
        undo() {
            performParentingInternal(this.childId, this.oldParentId);
            updateBlockInternal(this.childId, { x: this.oldPosition.x, y: this.oldPosition.y }, false);
        }
    }

    // ============================================
    // Command Stack Manager
    // ============================================
    function executeCommand(command) {
        command.execute();
        state.undoStack.push(command);
        state.redoStack = [];
        if (state.undoStack.length > state.maxUndoDepth) {
            state.undoStack.shift();
        }
        updateUndoRedoButtons();
        scheduleAutoSave();
    }

    function pushCommand(command) {
        // Push without executing (for operations already performed like drag/resize)
        state.undoStack.push(command);
        state.redoStack = [];
        if (state.undoStack.length > state.maxUndoDepth) {
            state.undoStack.shift();
        }
        updateUndoRedoButtons();
    }

    function undo() {
        if (state.undoStack.length === 0) return;
        const command = state.undoStack.pop();
        command.undo();
        state.redoStack.push(command);
        updateUndoRedoButtons();
        scheduleAutoSave();
    }

    function redo() {
        if (state.redoStack.length === 0) return;
        const command = state.redoStack.pop();
        command.execute();
        state.undoStack.push(command);
        updateUndoRedoButtons();
        scheduleAutoSave();
    }

    function clearUndoRedo() {
        state.undoStack = [];
        state.redoStack = [];
        updateUndoRedoButtons();
    }

    function updateUndoRedoButtons() {
        const undoBtn = document.getElementById('undo-btn');
        const redoBtn = document.getElementById('redo-btn');
        if (undoBtn) undoBtn.disabled = state.undoStack.length === 0;
        if (redoBtn) redoBtn.disabled = state.redoStack.length === 0;
    }

    function restoreBlock(snapshot) {
        // Add block back to state
        state.blocks.push(deepClone(snapshot));

        // Re-add to parent's childBlockIds if it has a parent
        if (snapshot.parentBlockId) {
            const parent = state.blocks.find(b => b.id === snapshot.parentBlockId);
            if (parent && !parent.childBlockIds.includes(snapshot.id)) {
                parent.childBlockIds.push(snapshot.id);
            }
        }

        renderBlock(snapshot);
        selectBlock(snapshot.id);
    }

    function restoreConnection(snapshot) {
        state.connections.push(deepClone(snapshot));
        renderConnection(snapshot);
    }

    // ============================================
    // DOM Elements
    // ============================================
    const canvas = document.getElementById('canvas');
    const canvasContent = document.getElementById('canvas-content');
    const propertiesPanel = document.getElementById('properties-panel');
    const propertiesTitle = document.getElementById('properties-title');
    const blockPropertiesDiv = document.getElementById('block-properties');
    const proxyPropertiesDiv = document.getElementById('proxy-properties');
    const connectionPropertiesDiv = document.getElementById('connection-properties');
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
    const undoBtn = document.getElementById('undo-btn');
    const redoBtn = document.getElementById('redo-btn');

    // Property inputs
    const blockLabel = document.getElementById('block-label');
    const blockColor = document.getElementById('block-color');
    const blockOpacity = document.getElementById('block-opacity');
    const blockWidth = document.getElementById('block-width');
    const blockHeight = document.getElementById('block-height');
    const blockZIndex = document.getElementById('block-zindex');
    const bringToFrontBtn = document.getElementById('bring-to-front');
    const sendToBackBtn = document.getElementById('send-to-back');
    const proxyDiagramSelect = document.getElementById('proxy-diagram-select');
    const connectionLineStyle = document.getElementById('connection-line-style');
    const connectionColor = document.getElementById('connection-color');

    // Modal elements
    const proxyModal = document.getElementById('proxy-modal');
    const proxyModalSelect = document.getElementById('proxy-modal-select');
    const proxyModalCancel = document.getElementById('proxy-modal-cancel');
    const proxyModalCreate = document.getElementById('proxy-modal-create');

    // ============================================
    // Diagram Management
    // ============================================
    let nextDiagramId = 1;

    function generateDiagramId() {
        return `diagram-${nextDiagramId++}`;
    }

    function createDiagram(name) {
        // Auto-generate name if not provided
        if (!name) {
            const count = state.diagrams.length + 1;
            name = `Diagram ${count}`;
        }

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

        // Clear undo/redo stacks when switching diagrams
        clearUndoRedo();

        // Update UI
        if (diagramNameInput) {
            diagramNameInput.value = diagram.name;
        }
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

    function navigateIntoDiagram(proxyBlockId) {
        const proxy = state.blocks.find(b => b.id === proxyBlockId);
        if (!proxy || proxy.type !== 'proxy') return;

        const targetDiagramId = proxy.linkedDiagramId || proxy.targetDiagramId;
        if (targetDiagramId) {
            switchDiagram(targetDiagramId, true, proxyBlockId);
        }
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
            if (typeof alert === 'function') {
                alert('Cannot delete the last diagram.');
            }
            return;
        }

        if (typeof confirm === 'function' && !confirm('Delete this diagram? This cannot be undone.')) {
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
        // Get diagramList dynamically to support test environment where DOM is recreated
        const currentDiagramList = diagramList || document.getElementById('diagram-list');
        if (!currentDiagramList) return;

        currentDiagramList.innerHTML = '';

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

            currentDiagramList.appendChild(item);
        });
    }

    function renderBreadcrumb() {
        // Get breadcrumb dynamically to support test environment where DOM is recreated
        const currentBreadcrumb = breadcrumb || document.getElementById('breadcrumb');
        if (!currentBreadcrumb) return;

        currentBreadcrumb.innerHTML = '';

        if (state.navigationStack.length === 0) {
            currentBreadcrumb.classList.add('hidden');
            return;
        }

        currentBreadcrumb.classList.remove('hidden');

        // Add each item in the navigation stack
        state.navigationStack.forEach((nav, index) => {
            const item = document.createElement('span');
            item.className = 'breadcrumb-item';
            item.textContent = getDiagramName(nav.diagramId);
            item.addEventListener('click', () => navigateBack(index));
            currentBreadcrumb.appendChild(item);

            const sep = document.createElement('span');
            sep.className = 'breadcrumb-separator';
            sep.textContent = '>';
            currentBreadcrumb.appendChild(sep);
        });

        // Add current diagram
        const current = document.createElement('span');
        current.className = 'breadcrumb-item current';
        current.textContent = getDiagramName(state.currentDiagramId);
        currentBreadcrumb.appendChild(current);
    }

    function renderCanvas() {
        const currentCanvasContent = canvasContent || document.getElementById('canvas-content');
        if (!currentCanvasContent) return;

        // Preserve temp line if it exists (used during connection mode)
        const tempLineData = tempLine ? {
            d: tempLine.getAttribute('d'),
            className: tempLine.getAttribute('class')
        } : null;

        currentCanvasContent.innerHTML = '';

        // Create combined array of blocks and connections with z-index
        const renderableItems = [];

        // Add blocks
        state.blocks.forEach(block => {
            renderableItems.push({
                type: 'block',
                zIndex: block.zIndex || 0,
                data: block,
                arrayIndex: state.blocks.indexOf(block)
            });
        });

        // Add connections with computed z-index
        state.connections.forEach(conn => {
            const fromBlock = state.blocks.find(b => b.id === conn.fromBlockId);
            const toBlock = state.blocks.find(b => b.id === conn.toBlockId);
            const maxZIndex = Math.max(fromBlock?.zIndex || 0, toBlock?.zIndex || 0);
            const effectiveZIndex = conn.zIndex !== null ? conn.zIndex : maxZIndex;

            renderableItems.push({
                type: 'connection',
                zIndex: effectiveZIndex,
                data: conn,
                arrayIndex: state.connections.indexOf(conn)
            });
        });

        // Sort by z-index, then by type (connections before blocks at same z), then by array index
        renderableItems.sort((a, b) => {
            if (a.zIndex !== b.zIndex) return a.zIndex - b.zIndex;
            // At same z-index, connections render before blocks (to appear behind)
            if (a.type !== b.type) return a.type === 'connection' ? -1 : 1;
            return a.arrayIndex - b.arrayIndex;
        });

        // Render in sorted order
        renderableItems.forEach(item => {
            if (item.type === 'block') {
                renderBlock(item.data);
            } else {
                renderConnection(item.data);
            }
        });

        // Restore temp line if it was preserved
        if (tempLineData) {
            tempLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            tempLine.setAttribute('class', tempLineData.className);
            tempLine.setAttribute('d', tempLineData.d);
            currentCanvasContent.appendChild(tempLine);
        }
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

        localStorage.setItem('cbdiag_diagrams', JSON.stringify(data));
        state.isDirty = false;
        updateSaveStatus('Saved');
    }

    function loadAllDiagrams() {
        const saved = localStorage.getItem('cbdiag_diagrams');
        if (saved) {
            try {
                const data = JSON.parse(saved);
                if (data.version === 2 && data.diagrams) {
                    state.diagrams = data.diagrams;
                    // Update nextDiagramId to be higher than any existing diagram ID
                    data.diagrams.forEach(d => {
                        const match = d.id.match(/diagram-(\d+)/);
                        if (match) {
                            nextDiagramId = Math.max(nextDiagramId, parseInt(match[1], 10) + 1);
                        }
                        // Migrate: add nesting fields to blocks that don't have them
                        if (d.blocks) {
                            d.blocks.forEach(block => {
                                if (block.parentBlockId === undefined) {
                                    block.parentBlockId = null;
                                }
                                if (block.childBlockIds === undefined) {
                                    block.childBlockIds = [];
                                }
                            });
                        }
                    });
                    const currentId = data.currentDiagramId || (data.diagrams[0] && data.diagrams[0].id);
                    if (currentId) {
                        switchDiagram(currentId);
                    }
                    return true;
                } else if (data.version === 1 && data.diagrams) {
                    // Migrate v1 to v2: add zIndex to blocks that don't have it
                    data.diagrams.forEach(diagram => {
                        if (diagram.blocks) {
                            diagram.blocks.forEach((block, index) => {
                                if (block.zIndex === undefined) {
                                    block.zIndex = index;
                                }
                            });
                        }
                    });
                    state.diagrams = data.diagrams;
                    // Update nextDiagramId to be higher than any existing diagram ID
                    data.diagrams.forEach(d => {
                        const match = d.id.match(/diagram-(\d+)/);
                        if (match) {
                            nextDiagramId = Math.max(nextDiagramId, parseInt(match[1], 10) + 1);
                        }
                    });
                    const currentId = data.currentDiagramId || (data.diagrams[0] && data.diagrams[0].id);
                    if (currentId) {
                        switchDiagram(currentId);
                    }
                    // Save as v2
                    saveAllDiagrams();
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
        if (saveStatus) {
            saveStatus.textContent = text;
        }
    }

    // ============================================
    // Utility Functions
    // ============================================
    function generateId(prefix) {
        if (prefix === 'block') return `block-${state.nextBlockId++}`;
        if (prefix === 'conn') return `conn-${state.nextConnectionId++}`;
        return `${prefix}-${Date.now()}`;
    }

    function screenToSvg(screenX, screenY, canvasEl = canvas) {
        if (!canvasEl) return { x: screenX, y: screenY };
        const rect = canvasEl.getBoundingClientRect();
        const viewBox = canvasEl.viewBox ? canvasEl.viewBox.baseVal : state.viewBox;
        const scaleX = viewBox.width / rect.width;
        const scaleY = viewBox.height / rect.height;
        return {
            x: viewBox.x + (screenX - rect.left) * scaleX,
            y: viewBox.y + (screenY - rect.top) * scaleY
        };
    }

    function getBlockCenter(block) {
        return {
            x: block.x + block.width / 2,
            y: block.y + block.height / 2
        };
    }

    function updateViewBox() {
        if (!canvas) return;
        const { x, y, width, height } = state.viewBox;
        canvas.setAttribute('viewBox', `${x} ${y} ${width} ${height}`);
    }

    // Z-ordering utility functions
    function getMaxZIndex() {
        if (state.blocks.length === 0) return 0;
        return state.blocks.reduce((max, block) => {
            const z = block.zIndex || 0;
            return Math.max(max, z);
        }, -Infinity);
    }

    function getMinZIndex() {
        if (state.blocks.length === 0) return 0;
        return state.blocks.reduce((min, block) => {
            const z = block.zIndex || 0;
            return Math.min(min, z);
        }, Infinity);
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
    // Nesting - Coordinate Transformations
    // ============================================

    // Convert local coordinates to global SVG coordinates
    function localToGlobal(block) {
        let globalX = block.x;
        let globalY = block.y;
        let currentParentId = block.parentBlockId;

        while (currentParentId) {
            const parent = state.blocks.find(b => b.id === currentParentId);
            if (!parent) break;
            globalX += parent.x;
            globalY += parent.y;
            currentParentId = parent.parentBlockId;
        }

        return { x: globalX, y: globalY };
    }

    // Convert global SVG coordinates to local coordinates relative to parent
    function globalToLocal(globalX, globalY, parentBlockId) {
        if (!parentBlockId) {
            return { x: globalX, y: globalY };
        }

        let localX = globalX;
        let localY = globalY;
        let currentParentId = parentBlockId;

        // Build parent chain
        const parents = [];
        while (currentParentId) {
            const parent = state.blocks.find(b => b.id === currentParentId);
            if (!parent) break;
            parents.push(parent);
            currentParentId = parent.parentBlockId;
        }

        // Subtract parent positions from outermost to innermost
        for (let i = parents.length - 1; i >= 0; i--) {
            localX -= parents[i].x;
            localY -= parents[i].y;
        }

        return { x: localX, y: localY };
    }

    // Get block's global bounding box
    function getGlobalBounds(block) {
        const globalPos = localToGlobal(block);
        return {
            x: globalPos.x,
            y: globalPos.y,
            width: block.width,
            height: block.height,
            right: globalPos.x + block.width,
            bottom: globalPos.y + block.height
        };
    }

    // Check if two blocks overlap in global coordinates
    function blocksOverlap(block1, block2) {
        const bounds1 = getGlobalBounds(block1);
        const bounds2 = getGlobalBounds(block2);

        return !(bounds1.right < bounds2.x ||
                 bounds1.x > bounds2.right ||
                 bounds1.bottom < bounds2.y ||
                 bounds1.y > bounds2.bottom);
    }

    // Make higher z-index blocks transparent when dragging a lower z-index block
    function updateTransparencyDuringDrag(draggingBlock) {
        if (!draggingBlock) return;

        const draggingZIndex = draggingBlock.zIndex || 0;
        const newTransparentBlocks = [];

        // Find all blocks with HIGHER z-index that overlap with dragging block
        state.blocks.forEach(block => {
            if (block.id === draggingBlock.id) return;

            const blockZIndex = block.zIndex || 0;
            if (blockZIndex > draggingZIndex && blocksOverlap(draggingBlock, block)) {
                // Check if we haven't already cached this block
                const existing = state.dragTransparentBlocks.find(item => item.blockId === block.id);
                if (!existing) {
                    newTransparentBlocks.push({
                        blockId: block.id,
                        originalOpacity: block.opacity
                    });
                    // Set to fully transparent (opacity 1 means fully transparent in our system)
                    updateBlockInternal(block.id, { opacity: 1 }, false);
                }
            }
        });

        // Restore blocks that are no longer overlapping
        state.dragTransparentBlocks.forEach(cached => {
            const block = state.blocks.find(b => b.id === cached.blockId);
            if (block) {
                const blockZIndex = block.zIndex || 0;
                const stillOverlapping = blockZIndex > draggingZIndex && blocksOverlap(draggingBlock, block);

                if (!stillOverlapping) {
                    // Restore original opacity
                    updateBlockInternal(cached.blockId, { opacity: cached.originalOpacity }, false);
                }
            }
        });

        // Update cache: keep only still-overlapping blocks
        state.dragTransparentBlocks = state.dragTransparentBlocks.filter(cached => {
            const block = state.blocks.find(b => b.id === cached.blockId);
            if (!block) return false;
            const blockZIndex = block.zIndex || 0;
            return blockZIndex > draggingZIndex && blocksOverlap(draggingBlock, block);
        });

        // Add new transparent blocks to cache
        newTransparentBlocks.forEach(item => {
            state.dragTransparentBlocks.push(item);
        });
    }

    // Restore all blocks to their original opacity after drag
    function restoreTransparencyAfterDrag() {
        state.dragTransparentBlocks.forEach(cached => {
            updateBlockInternal(cached.blockId, { opacity: cached.originalOpacity }, false);
        });
        state.dragTransparentBlocks = [];
    }

    // Get all ancestors (parent, grandparent, etc.)
    function getAncestors(blockId) {
        const ancestors = [];
        const block = state.blocks.find(b => b.id === blockId);
        if (!block) return ancestors;

        let currentParentId = block.parentBlockId;
        while (currentParentId) {
            const parent = state.blocks.find(b => b.id === currentParentId);
            if (!parent) break;
            ancestors.push(parent);
            currentParentId = parent.parentBlockId;
        }

        return ancestors;
    }

    // Get all descendants recursively
    function getDescendants(blockId) {
        const descendants = [];
        const block = state.blocks.find(b => b.id === blockId);
        if (!block) return descendants;

        function collectChildren(parentId) {
            const parent = state.blocks.find(b => b.id === parentId);
            if (!parent || !parent.childBlockIds) return;

            for (const childId of parent.childBlockIds) {
                const child = state.blocks.find(b => b.id === childId);
                if (child) {
                    descendants.push(child);
                    collectChildren(childId);
                }
            }
        }

        collectChildren(blockId);
        return descendants;
    }

    // Check if ancestorId is an ancestor of descendantId
    function isAncestorOf(ancestorId, descendantId) {
        const ancestors = getAncestors(descendantId);
        return ancestors.some(a => a.id === ancestorId);
    }

    // ============================================
    // Nesting - Parenting Operations
    // ============================================

    // Find the deepest potential parent block at the given point
    function findPotentialParent(draggedBlock, point) {
        const draggedBounds = getGlobalBounds(draggedBlock);
        const draggedAncestors = getAncestors(draggedBlock.id);
        const draggedDescendants = getDescendants(draggedBlock.id);

        let bestParent = null;
        let bestDepth = -1;

        for (const block of state.blocks) {
            // Skip self, ancestors, and descendants
            if (block.id === draggedBlock.id) continue;
            if (draggedAncestors.some(a => a.id === block.id)) continue;
            if (draggedDescendants.some(d => d.id === block.id)) continue;

            const bounds = getGlobalBounds(block);

            // Check if point is inside this block
            if (point.x >= bounds.x && point.x <= bounds.right &&
                point.y >= bounds.y && point.y <= bounds.bottom) {

                // Check if dragged block center is inside
                const draggedCenterX = draggedBounds.x + draggedBounds.width / 2;
                const draggedCenterY = draggedBounds.y + draggedBounds.height / 2;

                if (draggedCenterX >= bounds.x && draggedCenterX <= bounds.right &&
                    draggedCenterY >= bounds.y && draggedCenterY <= bounds.bottom) {

                    // Calculate depth (number of ancestors)
                    const depth = getAncestors(block.id).length;

                    // Prefer deeper (more nested) blocks
                    if (depth > bestDepth) {
                        bestDepth = depth;
                        bestParent = block;
                    }
                }
            }
        }

        return bestParent;
    }

    // Perform parenting: make childId a child of parentId
    function performParentingInternal(childId, parentId) {
        const child = state.blocks.find(b => b.id === childId);
        const parent = state.blocks.find(b => b.id === parentId);
        if (!child || !parent) return;

        // Prevent cycles
        if (isAncestorOf(childId, parentId)) return;

        // Save child's global position before reparenting
        const globalPos = getGlobalBounds(child);

        // Remove from old parent if any
        if (child.parentBlockId) {
            const oldParent = state.blocks.find(b => b.id === child.parentBlockId);
            if (oldParent && oldParent.childBlockIds) {
                oldParent.childBlockIds = oldParent.childBlockIds.filter(id => id !== childId);
            }
        }

        // Set new parent relationship
        child.parentBlockId = parentId;
        if (!parent.childBlockIds) parent.childBlockIds = [];
        if (!parent.childBlockIds.includes(childId)) {
            parent.childBlockIds.push(childId);
        }

        // Convert global position to local coordinates relative to new parent
        const localPos = globalToLocal(globalPos.x, globalPos.y, parentId);
        child.x = localPos.x;
        child.y = localPos.y;

        // Inherit z-order from parent (child should render above parent)
        child.zIndex = parent.zIndex + 1;

        // Auto-resize parent if needed
        autoResizeParent(parent);

        // Re-render
        renderCanvas();
    }

    function performParenting(childId, parentId) {
        const child = state.blocks.find(b => b.id === childId);
        if (!child) return;

        const oldParentId = child.parentBlockId;
        const oldPosition = { x: child.x, y: child.y };

        performParentingInternal(childId, parentId);

        // Capture new position after parenting
        const childAfter = state.blocks.find(b => b.id === childId);
        const newPosition = { x: childAfter.x, y: childAfter.y };

        const cmd = new ParentBlockCommand(childId, parentId, oldParentId, oldPosition, newPosition);
        pushCommand(cmd);
        scheduleAutoSave();
    }

    // Perform unparenting: remove child from its parent (internal version)
    function performUnparentingInternal(childId) {
        const child = state.blocks.find(b => b.id === childId);
        if (!child || !child.parentBlockId) return;

        // Save child's global position before unparenting
        const globalPos = getGlobalBounds(child);

        // Remove from parent's childBlockIds
        const parent = state.blocks.find(b => b.id === child.parentBlockId);
        if (parent && parent.childBlockIds) {
            parent.childBlockIds = parent.childBlockIds.filter(id => id !== childId);
        }

        // Clear parent reference
        child.parentBlockId = null;

        // Set position to global coordinates
        child.x = globalPos.x;
        child.y = globalPos.y;

        // Move to top of z-order
        child.zIndex = getMaxZIndex() + 1;

        // Re-render
        renderCanvas();
    }

    function performUnparenting(childId) {
        const child = state.blocks.find(b => b.id === childId);
        if (!child || !child.parentBlockId) return;

        const oldParentId = child.parentBlockId;
        const oldPosition = { x: child.x, y: child.y };

        performUnparentingInternal(childId);

        // Capture new position after unparenting
        const childAfter = state.blocks.find(b => b.id === childId);
        const newPosition = { x: childAfter.x, y: childAfter.y };

        const cmd = new UnparentBlockCommand(childId, oldParentId, oldPosition, newPosition);
        pushCommand(cmd);
        scheduleAutoSave();
    }

    // Auto-resize parent to fit all children
    function autoResizeParent(parent) {
        if (!parent || !parent.childBlockIds || parent.childBlockIds.length === 0) return;

        const padding = NESTING_CONSTANTS.PARENT_PADDING;
        const buffer = NESTING_CONSTANTS.MIN_PARENT_SIZE_BUFFER;

        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;

        for (const childId of parent.childBlockIds) {
            const child = state.blocks.find(b => b.id === childId);
            if (!child) continue;

            minX = Math.min(minX, child.x);
            minY = Math.min(minY, child.y);
            maxX = Math.max(maxX, child.x + child.width);
            maxY = Math.max(maxY, child.y + child.height);
        }

        // Calculate required size
        const requiredWidth = maxX + padding + buffer;
        const requiredHeight = maxY + padding + buffer;

        // Only enlarge, never shrink below minimum
        let needsResize = false;
        if (requiredWidth > parent.width) {
            parent.width = requiredWidth;
            needsResize = true;
        }
        if (requiredHeight > parent.height) {
            parent.height = requiredHeight;
            needsResize = true;
        }

        // Ensure children aren't at negative positions
        if (minX < padding) {
            const shift = padding - minX;
            for (const childId of parent.childBlockIds) {
                const child = state.blocks.find(b => b.id === childId);
                if (child) child.x += shift;
            }
            parent.width += shift;
            needsResize = true;
        }
        if (minY < padding) {
            const shift = padding - minY;
            for (const childId of parent.childBlockIds) {
                const child = state.blocks.find(b => b.id === childId);
                if (child) child.y += shift;
            }
            parent.height += shift;
            needsResize = true;
        }

        // Recursively check if grandparent needs resizing
        if (needsResize && parent.parentBlockId) {
            const grandparent = state.blocks.find(b => b.id === parent.parentBlockId);
            if (grandparent) {
                autoResizeParent(grandparent);
            }
        }
    }

    // Get minimum size for a parent to contain its children
    function getMinSizeForChildren(parentBlock) {
        if (!parentBlock || !parentBlock.childBlockIds || parentBlock.childBlockIds.length === 0) {
            return { minWidth: 50, minHeight: 30 }; // Default minimums
        }

        const padding = NESTING_CONSTANTS.PARENT_PADDING;
        let maxRight = 0, maxBottom = 0;

        for (const childId of parentBlock.childBlockIds) {
            const child = state.blocks.find(b => b.id === childId);
            if (!child) continue;
            maxRight = Math.max(maxRight, child.x + child.width + padding);
            maxBottom = Math.max(maxBottom, child.y + child.height + padding);
        }

        return {
            minWidth: Math.max(50, maxRight),
            minHeight: Math.max(30, maxBottom)
        };
    }

    // Handle parenting detection during drag
    function handleParentingDuringDrag(draggedBlock, mousePoint) {
        // Check if we're dragging outside current parent (unparenting)
        if (draggedBlock.parentBlockId) {
            const parent = state.blocks.find(b => b.id === draggedBlock.parentBlockId);
            if (parent) {
                const parentBounds = getGlobalBounds(parent);
                const childBounds = getGlobalBounds(draggedBlock);
                const centerX = childBounds.x + childBounds.width / 2;
                const centerY = childBounds.y + childBounds.height / 2;

                // If center is outside parent, show unparenting preview
                if (centerX < parentBounds.x || centerX > parentBounds.right ||
                    centerY < parentBounds.y || centerY > parentBounds.bottom) {
                    if (!state.isUnparentingPreview) {
                        state.isUnparentingPreview = true;
                        const blockEl = document.getElementById(draggedBlock.id);
                        if (blockEl) blockEl.classList.add('unparenting-preview');
                    }
                    clearParentingTimer();
                    return;
                } else if (state.isUnparentingPreview) {
                    state.isUnparentingPreview = false;
                    const blockEl = document.getElementById(draggedBlock.id);
                    if (blockEl) blockEl.classList.remove('unparenting-preview');
                }
            }
        }

        // Find potential new parent
        const potentialParent = findPotentialParent(draggedBlock, mousePoint);

        if (potentialParent && potentialParent.id !== draggedBlock.parentBlockId) {
            if (state.parentingTarget !== potentialParent.id) {
                // Clear previous target
                clearParentingPreview();

                // Start timer for new target
                state.parentingTarget = potentialParent.id;
                state.parentingTimer = setTimeout(() => {
                    state.isParentingPreview = true;
                    const targetEl = document.getElementById(potentialParent.id);
                    if (targetEl) targetEl.classList.add('parenting-target');
                }, NESTING_CONSTANTS.PARENTING_HOLD_DELAY);
            }
        } else if (!potentialParent || potentialParent.id === draggedBlock.parentBlockId) {
            clearParentingPreview();
        }
    }

    // Clear parenting preview state
    function clearParentingPreview() {
        clearParentingTimer();
        if (state.parentingTarget) {
            const targetEl = document.getElementById(state.parentingTarget);
            if (targetEl) targetEl.classList.remove('parenting-target');
        }
        state.isParentingPreview = false;
        state.parentingTarget = null;
    }

    // Clear just the timer
    function clearParentingTimer() {
        if (state.parentingTimer) {
            clearTimeout(state.parentingTimer);
            state.parentingTimer = null;
        }
    }

    // Clear unparenting preview
    function clearUnparentingPreview(block) {
        if (state.isUnparentingPreview) {
            state.isUnparentingPreview = false;
            if (block) {
                const blockEl = document.getElementById(block.id);
                if (blockEl) blockEl.classList.remove('unparenting-preview');
            }
        }
    }

    // ============================================
    // Block Functions
    // ============================================
    function findNonOverlappingPosition(centerX, centerY, width, height) {
        const padding = 20;
        const maxAttempts = 50;

        // Get top-level blocks only (not nested inside parents)
        const topLevelBlocks = state.blocks.filter(b => !b.parentBlockId);

        function overlaps(x, y) {
            for (const block of topLevelBlocks) {
                const globalPos = localToGlobal(block);
                if (x < globalPos.x + block.width + padding &&
                    x + width + padding > globalPos.x &&
                    y < globalPos.y + block.height + padding &&
                    y + height + padding > globalPos.y) {
                    return true;
                }
            }
            return false;
        }

        // Try the center position first
        let x = centerX - width / 2;
        let y = centerY - height / 2;
        if (!overlaps(x, y)) {
            return { x: x + width / 2, y: y + height / 2 };
        }

        // Spiral outward to find a free spot
        const step = 80;
        for (let ring = 1; ring <= maxAttempts; ring++) {
            for (let dx = -ring; dx <= ring; dx++) {
                for (let dy = -ring; dy <= ring; dy++) {
                    if (Math.abs(dx) !== ring && Math.abs(dy) !== ring) continue;
                    x = centerX - width / 2 + dx * step;
                    y = centerY - height / 2 + dy * step;
                    if (!overlaps(x, y)) {
                        return { x: x + width / 2, y: y + height / 2 };
                    }
                }
            }
        }

        // Fallback: offset from center
        return { x: centerX + topLevelBlocks.length * 30, y: centerY + topLevelBlocks.length * 30 };
    }

    function createBlockInternal(x, y, parentBlockId = null) {
        const blockNum = state.nextBlockId;
        const block = {
            id: generateId('block'),
            type: 'block',
            x: x - 60,
            y: y - 30,
            width: 120,
            height: 60,
            label: `Block ${blockNum}`,
            color: getRandomColor(),
            opacity: 0,
            zIndex: getMaxZIndex() + 1,
            parentBlockId: parentBlockId,
            childBlockIds: []
        };
        state.blocks.push(block);

        // Re-render entire canvas to maintain proper z-ordering
        renderCanvas();

        selectBlock(block.id);
        return block;
    }

    function createBlock(x, y, parentBlockId = null) {
        const block = createBlockInternal(x, y, parentBlockId);
        const cmd = new CreateBlockCommand(x, y, parentBlockId, block);
        pushCommand(cmd);
        scheduleAutoSave();
        return block;
    }

    function createProxyBlock(x, y, linkedDiagramId, parentBlockId = null) {
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
            color: '#9b59b6',
            opacity: 0,
            linkedDiagramId: linkedDiagramId,
            targetDiagramId: linkedDiagramId, // Alias for compatibility
            zIndex: getMaxZIndex() + 1,
            parentBlockId: parentBlockId,
            childBlockIds: []
        };
        state.blocks.push(block);

        // Re-render entire canvas to maintain proper z-ordering
        renderCanvas();

        selectBlock(block.id);
        scheduleAutoSave();
        return block;
    }

    function renderBlock(block) {
        // Get canvasContent dynamically to support test environment where DOM is recreated
        const currentCanvasContent = canvasContent || document.getElementById('canvas-content');
        if (!currentCanvasContent) return;

        const existing = document.getElementById(block.id);
        if (existing) existing.remove();

        const isProxy = block.type === 'proxy';

        // Get global coordinates for rendering
        const globalPos = localToGlobal(block);
        const gx = globalPos.x;
        const gy = globalPos.y;

        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('id', block.id);
        g.setAttribute('class', 'block' + (isProxy ? ' proxy' : ''));
        g.setAttribute('data-block-id', block.id);
        if (isProxy) {
            g.setAttribute('data-proxy', 'true');
            g.setAttribute('data-linked-diagram', block.linkedDiagramId);
        }
        if (block.parentBlockId) {
            g.setAttribute('data-parent-id', block.parentBlockId);
        }

        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', gx);
        rect.setAttribute('y', gy);
        rect.setAttribute('width', block.width);
        rect.setAttribute('height', block.height);
        rect.setAttribute('rx', isProxy ? 8 : 4);
        rect.setAttribute('fill', block.color);
        rect.setAttribute('fill-opacity', block.opacity !== undefined ? 1 - block.opacity : 1);
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
        text.setAttribute('x', gx + block.width / 2);
        text.setAttribute('y', gy + block.height / 2 + (isProxy ? 0 : 5));
        text.setAttribute('text-anchor', 'middle');
        text.textContent = labelText;

        g.appendChild(rect);
        g.appendChild(text);

        // Add proxy indicator icon
        if (isProxy) {
            const icon = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            icon.setAttribute('class', 'proxy-icon');
            icon.setAttribute('x', gx + block.width / 2);
            icon.setAttribute('y', gy + block.height / 2 + 18);
            icon.setAttribute('text-anchor', 'middle');
            icon.setAttribute('font-size', '10');
            icon.setAttribute('fill', 'rgba(255,255,255,0.7)');
            icon.textContent = '[ click to enter ]';
            g.appendChild(icon);
        }

        // Create resize handles for all four corners
        const handleSize = 10;
        const corners = [
            { corner: 'nw', x: gx, y: gy },
            { corner: 'ne', x: gx + block.width - handleSize, y: gy },
            { corner: 'sw', x: gx, y: gy + block.height - handleSize },
            { corner: 'se', x: gx + block.width - handleSize, y: gy + block.height - handleSize }
        ];

        for (const { corner, x, y } of corners) {
            const resizeHandle = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            resizeHandle.setAttribute('class', `resize-handle resize-${corner}`);
            resizeHandle.setAttribute('x', x);
            resizeHandle.setAttribute('y', y);
            resizeHandle.setAttribute('width', handleSize);
            resizeHandle.setAttribute('height', handleSize);
            resizeHandle.setAttribute('data-resize', corner);
            g.appendChild(resizeHandle);
        }

        // Append block (renderCanvas handles z-order via unified layer)
        if (currentCanvasContent) {
            currentCanvasContent.appendChild(g);
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

    function updateBlockInternal(blockId, updates, triggerSave = true) {
        const block = state.blocks.find(b => b.id === blockId);
        if (!block) return;

        // Handle z-index constraints
        if (updates.zIndex !== undefined) {
            // If block has a parent, ensure zIndex >= parent's zIndex
            if (block.parentBlockId) {
                const parent = state.blocks.find(b => b.id === block.parentBlockId);
                if (parent && updates.zIndex < parent.zIndex) {
                    updates.zIndex = parent.zIndex + 1;
                }
            }

            // If block has children and zIndex is changing, propagate to children
            const oldZIndex = block.zIndex || 0;
            const newZIndex = updates.zIndex;
            const zDelta = newZIndex - oldZIndex;

            if (zDelta !== 0 && block.childBlockIds && block.childBlockIds.length > 0) {
                const descendants = getDescendants(blockId);
                for (const descendant of descendants) {
                    descendant.zIndex = (descendant.zIndex || 0) + zDelta;
                }
            }
        }

        Object.assign(block, updates);

        // Re-render entire canvas to maintain proper z-ordering
        // Individual renderBlock() calls would append elements, breaking z-order
        renderCanvas();

        if (state.selectedBlockId === blockId) {
            selectBlock(blockId);
        }

        if (triggerSave) scheduleAutoSave();
    }

    function updateBlock(blockId, updates, triggerSave = true) {
        const block = state.blocks.find(b => b.id === blockId);
        if (!block) return;

        // Capture previous values for undo
        const previousValues = {};
        for (const key of Object.keys(updates)) {
            previousValues[key] = block[key];
        }

        updateBlockInternal(blockId, updates, triggerSave);

        // Create command for undo
        const cmd = new UpdateBlockCommand(blockId, updates, previousValues);
        pushCommand(cmd);
    }

    function deleteBlockInternal(blockId, recursive = true) {
        const block = state.blocks.find(b => b.id === blockId);
        if (!block) return;

        // Recursively delete all children first
        if (recursive && block.childBlockIds && block.childBlockIds.length > 0) {
            const childIds = [...block.childBlockIds];
            for (const childId of childIds) {
                deleteBlockInternal(childId, true);
            }
        }

        // Remove from parent's childBlockIds if this block has a parent
        if (block.parentBlockId) {
            const parent = state.blocks.find(b => b.id === block.parentBlockId);
            if (parent && parent.childBlockIds) {
                parent.childBlockIds = parent.childBlockIds.filter(id => id !== blockId);
            }
        }

        // Delete connections to/from this block
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
    }

    function deleteBlock(blockId) {
        const cmd = new DeleteBlockCommand(blockId);
        executeCommand(cmd);
    }

    // ============================================
    // Connection Functions
    // ============================================
    function getAnchorPoint(block, side) {
        // Use global coordinates for connection anchor points
        const globalPos = localToGlobal(block);
        const centerX = globalPos.x + block.width / 2;
        const centerY = globalPos.y + block.height / 2;

        switch (side) {
            case 'top':
                return { x: centerX, y: globalPos.y };
            case 'bottom':
                return { x: centerX, y: globalPos.y + block.height };
            case 'left':
                return { x: globalPos.x, y: centerY };
            case 'right':
                return { x: globalPos.x + block.width, y: centerY };
            default:
                return { x: centerX, y: centerY };
        }
    }

    function getBestSides(fromBlock, toBlock) {
        // Use global coordinates for determining best sides
        const fromGlobal = localToGlobal(fromBlock);
        const toGlobal = localToGlobal(toBlock);
        const fromCenterX = fromGlobal.x + fromBlock.width / 2;
        const fromCenterY = fromGlobal.y + fromBlock.height / 2;
        const toCenterX = toGlobal.x + toBlock.width / 2;
        const toCenterY = toGlobal.y + toBlock.height / 2;

        const dx = toCenterX - fromCenterX;
        const dy = toCenterY - fromCenterY;

        let sideA, sideB;

        if (Math.abs(dx) >= Math.abs(dy)) {
            if (dx >= 0) {
                sideA = 'right';
                sideB = 'left';
            } else {
                sideA = 'left';
                sideB = 'right';
            }
        } else {
            if (dy > 0) {
                sideA = 'bottom';
                sideB = 'top';
            } else {
                sideA = 'top';
                sideB = 'bottom';
            }
        }

        return { sideA, sideB };
    }

    function createConnectionInternal(fromBlockId, toBlockId) {
        if (fromBlockId === toBlockId) return null;

        const exists = state.connections.some(
            c => (c.fromBlockId === fromBlockId && c.toBlockId === toBlockId) ||
                 (c.fromBlockId === toBlockId && c.toBlockId === fromBlockId)
        );
        if (exists) return null;

        const fromBlock = state.blocks.find(b => b.id === fromBlockId);
        const toBlock = state.blocks.find(b => b.id === toBlockId);
        if (!fromBlock || !toBlock) return null;

        const { sideA: fromSide, sideB: toSide } = getBestSides(fromBlock, toBlock);

        const conn = {
            id: generateId('conn'),
            fromBlockId,
            toBlockId,
            from: fromBlockId, // Alias for compatibility
            to: toBlockId, // Alias for compatibility
            fromSide,
            toSide,
            lineStyle: 'solid',
            color: null, // null means use CSS default
            zIndex: null // Will be calculated from connected blocks if not set
        };
        state.connections.push(conn);

        // Re-render entire canvas to maintain proper z-ordering
        renderCanvas();

        return conn;
    }

    function createConnection(fromBlockId, toBlockId) {
        const conn = createConnectionInternal(fromBlockId, toBlockId);
        if (conn) {
            const cmd = new CreateConnectionCommand(fromBlockId, toBlockId, conn);
            pushCommand(cmd);
            scheduleAutoSave();
        }
        return conn;
    }

    function renderConnection(conn) {
        const existing = document.getElementById(conn.id);
        if (existing) existing.remove();
        const existingHitbox = document.getElementById(`${conn.id}-hitbox`);
        if (existingHitbox) existingHitbox.remove();

        const fromBlock = state.blocks.find(b => b.id === conn.fromBlockId);
        const toBlock = state.blocks.find(b => b.id === conn.toBlockId);
        if (!fromBlock || !toBlock) return;

        let fromSide = conn.fromSide;
        let toSide = conn.toSide;
        if (!fromSide || !toSide) {
            const sides = getBestSides(fromBlock, toBlock);
            fromSide = sides.sideA;
            toSide = sides.sideB;
        }

        const fromPoint = getAnchorPoint(fromBlock, fromSide);
        const toPoint = getAnchorPoint(toBlock, toSide);

        // Create path data for reuse
        const pathData = `M ${fromPoint.x} ${fromPoint.y} L ${toPoint.x} ${toPoint.y}`;

        // Create invisible hitbox for easier clicking
        const hitbox = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        hitbox.setAttribute('id', `${conn.id}-hitbox`);
        hitbox.setAttribute('class', 'connection-hitbox');
        hitbox.setAttribute('d', pathData);
        hitbox.setAttribute('data-conn-id', conn.id);

        // Apply line style to hitbox for consistent hit area
        const lineStyle = conn.lineStyle || 'solid';
        if (lineStyle === 'dashed') {
            hitbox.setAttribute('stroke-dasharray', '10,5');
        } else if (lineStyle === 'dotted') {
            hitbox.setAttribute('stroke-dasharray', '2,5');
        }

        // Create visible path
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('id', conn.id);
        path.setAttribute('class', 'connection');
        path.setAttribute('d', pathData);
        path.setAttribute('marker-end', 'url(#arrowhead)');
        path.setAttribute('data-conn-id', conn.id);
        path.style.pointerEvents = 'none';  // Hitbox handles clicks

        // Set z-index: use conn.zIndex if set, otherwise max of the two connected blocks
        const maxZIndex = Math.max(fromBlock.zIndex || 0, toBlock.zIndex || 0);
        path.style.zIndex = conn.zIndex !== null ? conn.zIndex : maxZIndex;

        // Apply line style to visible path
        if (lineStyle === 'dashed') {
            path.setAttribute('stroke-dasharray', '10,5');
        } else if (lineStyle === 'dotted') {
            path.setAttribute('stroke-dasharray', '2,5');
        } else {
            path.setAttribute('stroke-dasharray', 'none');
        }

        // Apply color - use inline style with !important to override CSS selection color
        const color = conn.color;
        if (color && color !== '#000000' && color !== '#666666' && color !== '#666') {
            path.style.setProperty('stroke', color, 'important');
        } else {
            path.style.removeProperty('stroke');
        }

        // Get canvasContent dynamically to support test environment where DOM is recreated
        const currentCanvasContent = canvasContent || document.getElementById('canvas-content');
        if (currentCanvasContent) {
            currentCanvasContent.appendChild(hitbox);  // Behind
            currentCanvasContent.appendChild(path);    // In front
        }
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
            const conn = state.connections.find(c => c.id === connId);
            if (conn) {
                showConnectionProperties(conn);
            }
        } else {
            hideProperties();
        }
    }

    function updateConnectionInternal(connId, updates, triggerSave = true) {
        const conn = state.connections.find(c => c.id === connId);
        if (!conn) return;

        Object.assign(conn, updates);

        // Re-render entire canvas to maintain proper z-ordering
        // Individual renderConnection() calls would append elements, breaking z-order
        renderCanvas();

        if (state.selectedConnectionId === connId) {
            showConnectionProperties(conn);
        }

        if (triggerSave) scheduleAutoSave();
    }

    function updateConnection(connId, updates, triggerSave = true) {
        const conn = state.connections.find(c => c.id === connId);
        if (!conn) return;

        // Capture previous values for undo
        const previousValues = {};
        for (const key of Object.keys(updates)) {
            previousValues[key] = conn[key];
        }

        updateConnectionInternal(connId, updates, triggerSave);

        // Create command for undo
        const cmd = new UpdateConnectionCommand(connId, updates, previousValues);
        pushCommand(cmd);
    }

    function deleteConnectionInternal(connId) {
        state.connections = state.connections.filter(c => c.id !== connId);
        const el = document.getElementById(connId);
        if (el) el.remove();

        if (state.selectedConnectionId === connId) {
            state.selectedConnectionId = null;
        }
    }

    function deleteConnection(connId) {
        const cmd = new DeleteConnectionCommand(connId);
        executeCommand(cmd);
    }

    // ============================================
    // Properties Panel
    // ============================================
    function showProperties(block) {
        if (!propertiesPanel) return;

        const isProxy = block.type === 'proxy';

        if (propertiesTitle) {
            propertiesTitle.textContent = isProxy ? 'Proxy Properties' : 'Block Properties';
        }

        // Hide connection properties, show common properties
        if (connectionPropertiesDiv) connectionPropertiesDiv.classList.add('hidden');
        const commonPropertiesDiv = document.getElementById('common-properties');
        if (commonPropertiesDiv) commonPropertiesDiv.classList.remove('hidden');

        // Show z-order properties
        const zOrderPropertiesDiv = document.getElementById('z-order-properties');
        if (zOrderPropertiesDiv) zOrderPropertiesDiv.classList.remove('hidden');

        if (isProxy) {
            if (blockPropertiesDiv) blockPropertiesDiv.classList.add('hidden');
            if (proxyPropertiesDiv) proxyPropertiesDiv.classList.remove('hidden');
            if (proxyDiagramSelect) populateProxyDiagramSelect(proxyDiagramSelect, block.linkedDiagramId);
        } else {
            if (blockPropertiesDiv) blockPropertiesDiv.classList.remove('hidden');
            if (proxyPropertiesDiv) proxyPropertiesDiv.classList.add('hidden');
            if (blockLabel) blockLabel.value = block.label;
            if (blockColor) blockColor.value = block.color;
        }

        if (blockOpacity) blockOpacity.value = block.opacity !== undefined ? block.opacity : 1;
        if (blockWidth) blockWidth.value = block.width;
        if (blockHeight) blockHeight.value = block.height;
        if (blockZIndex) blockZIndex.value = block.zIndex || 0;

        // Update parent info section
        const parentInfoDiv = document.getElementById('parent-info');
        const unparentBtn = document.getElementById('unparent-btn');
        if (parentInfoDiv && unparentBtn) {
            if (block.parentBlockId) {
                const parent = state.blocks.find(b => b.id === block.parentBlockId);
                const parentName = parent ? parent.label : 'Unknown';
                parentInfoDiv.classList.remove('hidden');
                const parentNameSpan = document.getElementById('parent-name');
                if (parentNameSpan) {
                    parentNameSpan.textContent = parentName;
                }
            } else {
                parentInfoDiv.classList.add('hidden');
            }
        }

        propertiesPanel.classList.remove('hidden');
    }

    function hideProperties() {
        if (propertiesPanel) {
            propertiesPanel.classList.add('hidden');
        }
    }

    function showConnectionProperties(conn) {
        if (!propertiesPanel) return;

        if (propertiesTitle) {
            propertiesTitle.textContent = 'Connection Properties';
        }

        // Hide block and proxy properties, show connection properties
        if (blockPropertiesDiv) blockPropertiesDiv.classList.add('hidden');
        if (proxyPropertiesDiv) proxyPropertiesDiv.classList.add('hidden');
        if (connectionPropertiesDiv) connectionPropertiesDiv.classList.remove('hidden');
        const commonPropertiesDiv = document.getElementById('common-properties');
        if (commonPropertiesDiv) commonPropertiesDiv.classList.add('hidden');
        const parentInfoDiv = document.getElementById('parent-info');
        if (parentInfoDiv) parentInfoDiv.classList.add('hidden');

        // Show z-order properties
        const zOrderPropertiesDiv = document.getElementById('z-order-properties');
        if (zOrderPropertiesDiv) zOrderPropertiesDiv.classList.remove('hidden');

        // Populate connection properties
        if (connectionLineStyle) connectionLineStyle.value = conn.lineStyle || 'solid';
        if (connectionColor) connectionColor.value = conn.color || '#666666';

        // Calculate display z-index (actual or computed from blocks)
        const fromBlock = state.blocks.find(b => b.id === conn.fromBlockId);
        const toBlock = state.blocks.find(b => b.id === conn.toBlockId);
        const maxZIndex = Math.max(fromBlock?.zIndex || 0, toBlock?.zIndex || 0);
        const displayZIndex = conn.zIndex !== null ? conn.zIndex : maxZIndex;
        if (blockZIndex) blockZIndex.value = displayZIndex;

        propertiesPanel.classList.remove('hidden');
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
        if (addConnectionBtn) addConnectionBtn.classList.add('active');
        if (canvas) canvas.classList.add('connecting');
    }

    function exitConnectionMode() {
        state.mode = 'select';
        if (addConnectionBtn) addConnectionBtn.classList.remove('active');
        if (canvas) canvas.classList.remove('connecting');
        state.connectionStart = null;
        if (tempLine) {
            tempLine.remove();
            tempLine = null;
        }
    }

    function updateTempLine(fromBlock, toPoint) {
        // Get canvasContent dynamically to support test environment where DOM is recreated
        const currentCanvasContent = canvasContent || document.getElementById('canvas-content');
        if (!currentCanvasContent) return;

        if (!tempLine) {
            tempLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            tempLine.setAttribute('class', 'connection-temp');
            currentCanvasContent.appendChild(tempLine);
        }

        const tempBlock = { x: toPoint.x, y: toPoint.y, width: 0, height: 0 };
        const { sideA: fromSide } = getBestSides(fromBlock, tempBlock);
        const fromEdge = getAnchorPoint(fromBlock, fromSide);
        tempLine.setAttribute('d', `M ${fromEdge.x} ${fromEdge.y} L ${toPoint.x} ${toPoint.y}`);
    }

    // ============================================
    // Event Handlers
    // ============================================
    function initEventHandlers() {
        // New diagram button
        if (newDiagramBtn) {
            newDiagramBtn.addEventListener('click', () => {
                createDiagram();
            });
        }

        // Diagram name input
        if (diagramNameInput) {
            diagramNameInput.addEventListener('input', (e) => {
                if (state.currentDiagramId) {
                    renameDiagram(state.currentDiagramId, e.target.value);
                }
            });
        }

        // Toolbar
        if (addBlockBtn) {
            addBlockBtn.addEventListener('click', () => {
                const center = {
                    x: state.viewBox.x + state.viewBox.width / 2,
                    y: state.viewBox.y + state.viewBox.height / 2
                };
                const pos = findNonOverlappingPosition(center.x, center.y, 120, 60);
                createBlock(pos.x, pos.y);
            });
        }

        if (addProxyBtn) {
            addProxyBtn.addEventListener('click', () => {
                if (state.diagrams.length < 2) {
                    alert('Create at least one other diagram first to link to.');
                    return;
                }
                showProxyModal();
            });
        }

        if (addConnectionBtn) {
            addConnectionBtn.addEventListener('click', () => {
                if (state.mode === 'connecting') {
                    exitConnectionMode();
                } else {
                    enterConnectionMode();
                }
            });
        }

        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                if (state.selectedBlockId) {
                    deleteBlock(state.selectedBlockId);
                } else if (state.selectedConnectionId) {
                    deleteConnection(state.selectedConnectionId);
                }
            });
        }

        if (undoBtn) {
            undoBtn.addEventListener('click', () => {
                undo();
            });
        }

        if (redoBtn) {
            redoBtn.addEventListener('click', () => {
                redo();
            });
        }

        // Proxy modal
        if (proxyModalCancel) proxyModalCancel.addEventListener('click', hideProxyModal);
        if (proxyModalCreate) {
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
        }

        // Close modal on backdrop click
        if (proxyModal) {
            proxyModal.addEventListener('click', (e) => {
                if (e.target === proxyModal) {
                    hideProxyModal();
                }
            });
        }

        // Properties panel - block properties
        if (blockLabel) {
            blockLabel.addEventListener('input', (e) => {
                if (state.selectedBlockId) {
                    const block = state.blocks.find(b => b.id === state.selectedBlockId);
                    if (block && block.type !== 'proxy') {
                        updateBlock(state.selectedBlockId, { label: e.target.value });
                    }
                }
            });
        }

        if (blockColor) {
            blockColor.addEventListener('input', (e) => {
                if (state.selectedBlockId) {
                    const block = state.blocks.find(b => b.id === state.selectedBlockId);
                    if (block && block.type !== 'proxy') {
                        updateBlock(state.selectedBlockId, { color: e.target.value });
                    }
                }
            });
        }

        // Properties panel - proxy properties
        if (proxyDiagramSelect) {
            proxyDiagramSelect.addEventListener('change', (e) => {
                if (state.selectedBlockId) {
                    const block = state.blocks.find(b => b.id === state.selectedBlockId);
                    if (block && block.type === 'proxy' && e.target.value) {
                        updateBlock(state.selectedBlockId, { linkedDiagramId: e.target.value });
                    }
                }
            });
        }

        // Properties panel - common properties
        if (blockOpacity) {
            blockOpacity.addEventListener('input', (e) => {
                if (state.selectedBlockId) {
                    updateBlock(state.selectedBlockId, { opacity: parseFloat(e.target.value) });
                }
            });
        }

        if (blockWidth) {
            blockWidth.addEventListener('change', (e) => {
                if (state.selectedBlockId) {
                    updateBlock(state.selectedBlockId, { width: parseInt(e.target.value) || 120 });
                }
            });
        }

        if (blockHeight) {
            blockHeight.addEventListener('change', (e) => {
                if (state.selectedBlockId) {
                    updateBlock(state.selectedBlockId, { height: parseInt(e.target.value) || 60 });
                }
            });
        }

        if (blockZIndex) {
            blockZIndex.addEventListener('change', (e) => {
                if (state.selectedBlockId) {
                    updateBlock(state.selectedBlockId, { zIndex: parseInt(e.target.value) || 0 });
                } else if (state.selectedConnectionId) {
                    updateConnection(state.selectedConnectionId, { zIndex: parseInt(e.target.value) || 0 });
                }
            });
        }

        if (bringToFrontBtn) {
            bringToFrontBtn.addEventListener('click', () => {
                if (state.selectedBlockId) {
                    bringToFront(state.selectedBlockId);
                } else if (state.selectedConnectionId) {
                    const maxZ = getMaxZIndex();
                    updateConnection(state.selectedConnectionId, { zIndex: maxZ + 1 });
                }
            });
        }

        if (sendToBackBtn) {
            sendToBackBtn.addEventListener('click', () => {
                if (state.selectedBlockId) {
                    sendToBack(state.selectedBlockId);
                } else if (state.selectedConnectionId) {
                    const minZ = getMinZIndex();
                    updateConnection(state.selectedConnectionId, { zIndex: minZ - 1 });
                }
            });
        }

        // Unparent button
        const unparentBtn = document.getElementById('unparent-btn');
        if (unparentBtn) {
            unparentBtn.addEventListener('click', () => {
                if (state.selectedBlockId) {
                    const block = state.blocks.find(b => b.id === state.selectedBlockId);
                    if (block && block.parentBlockId) {
                        performUnparenting(state.selectedBlockId);
                        showProperties(block);
                    }
                }
            });
        }

        // Connection properties
        if (connectionLineStyle) {
            connectionLineStyle.addEventListener('change', (e) => {
                if (state.selectedConnectionId) {
                    updateConnection(state.selectedConnectionId, { lineStyle: e.target.value });
                }
            });
        }

        if (connectionColor) {
            connectionColor.addEventListener('input', (e) => {
                if (state.selectedConnectionId) {
                    updateConnection(state.selectedConnectionId, { color: e.target.value });
                }
            });
        }

        // Canvas mouse events
        if (canvas) {
            canvas.addEventListener('mousedown', handleMouseDown);
            canvas.addEventListener('mousemove', handleMouseMove);
            canvas.addEventListener('mouseup', handleMouseUp);
            canvas.addEventListener('dblclick', handleDoubleClick);
            canvas.addEventListener('wheel', handleWheel, { passive: false });
        }

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
        const connPath = target.closest('.connection') || target.closest('.connection-hitbox');

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

        const resizeCorner = target.getAttribute('data-resize');
        if (resizeCorner) {
            const blockId = target.closest('.block').getAttribute('data-block-id');
            const block = state.blocks.find(b => b.id === blockId);
            if (block) {
                state.isResizing = true;
                state.resizeCorner = resizeCorner;
                state.selectedBlockId = blockId;
                state.resizeStart = {
                    x: point.x,
                    y: point.y,
                    width: block.width,
                    height: block.height,
                    blockX: block.x,
                    blockY: block.y
                };
                // Capture start size for undo command
                state.resizeStartSize = { width: block.width, height: block.height, x: block.x, y: block.y };
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
                // Use global coordinates for drag offset calculation
                const globalPos = localToGlobal(block);
                state.dragOffset = {
                    x: point.x - globalPos.x,
                    y: point.y - globalPos.y
                };
                // Capture start position for undo command
                state.dragStartPos = { x: block.x, y: block.y };
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
                // Get minimum size based on children
                const minSize = getMinSizeForChildren(block);
                const deltaX = point.x - state.resizeStart.x;
                const deltaY = point.y - state.resizeStart.y;

                let newX = state.resizeStart.blockX;
                let newY = state.resizeStart.blockY;
                let newWidth = state.resizeStart.width;
                let newHeight = state.resizeStart.height;

                switch (state.resizeCorner) {
                    case 'se': // bottom-right
                        newWidth = state.resizeStart.width + deltaX;
                        newHeight = state.resizeStart.height + deltaY;
                        break;
                    case 'sw': // bottom-left
                        newX = state.resizeStart.blockX + deltaX;
                        newWidth = state.resizeStart.width - deltaX;
                        newHeight = state.resizeStart.height + deltaY;
                        break;
                    case 'ne': // top-right
                        newY = state.resizeStart.blockY + deltaY;
                        newWidth = state.resizeStart.width + deltaX;
                        newHeight = state.resizeStart.height - deltaY;
                        break;
                    case 'nw': // top-left
                        newX = state.resizeStart.blockX + deltaX;
                        newY = state.resizeStart.blockY + deltaY;
                        newWidth = state.resizeStart.width - deltaX;
                        newHeight = state.resizeStart.height - deltaY;
                        break;
                }

                // Enforce minimum size
                newWidth = Math.max(minSize.minWidth, newWidth);
                newHeight = Math.max(minSize.minHeight, newHeight);

                // Adjust position if width/height was clamped (for corners that move origin)
                if (state.resizeCorner === 'sw' || state.resizeCorner === 'nw') {
                    newX = state.resizeStart.blockX + state.resizeStart.width - newWidth;
                }
                if (state.resizeCorner === 'ne' || state.resizeCorner === 'nw') {
                    newY = state.resizeStart.blockY + state.resizeStart.height - newHeight;
                }

                // Use internal version - command created on mouseup
                updateBlockInternal(state.selectedBlockId, { x: newX, y: newY, width: newWidth, height: newHeight }, false);
            }
            return;
        }

        if (state.isDragging && state.selectedBlockId) {
            const block = state.blocks.find(b => b.id === state.selectedBlockId);
            if (block) {
                // Convert mouse position to local coordinates if block has parent
                let newX, newY;
                if (block.parentBlockId) {
                    const localPos = globalToLocal(point.x - state.dragOffset.x, point.y - state.dragOffset.y, block.parentBlockId);
                    newX = localPos.x;
                    newY = localPos.y;
                } else {
                    newX = point.x - state.dragOffset.x;
                    newY = point.y - state.dragOffset.y;
                }
                // Use internal version - command created on mouseup
                updateBlockInternal(state.selectedBlockId, { x: newX, y: newY }, false);

                // Make higher z-index overlapping blocks transparent
                updateTransparencyDuringDrag(block);

                // Handle parenting detection
                handleParentingDuringDrag(block, point);
            }
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
        if (state.isDragging && state.selectedBlockId) {
            const block = state.blocks.find(b => b.id === state.selectedBlockId);

            // Handle unparenting
            if (state.isUnparentingPreview && block && block.parentBlockId) {
                performUnparenting(block.id);
            }
            // Handle parenting
            else if (state.isParentingPreview && state.parentingTarget) {
                performParenting(state.selectedBlockId, state.parentingTarget);
            }
            // Create move command if position changed (and no parenting/unparenting happened)
            else if (block && state.dragStartPos) {
                if (block.x !== state.dragStartPos.x || block.y !== state.dragStartPos.y) {
                    const cmd = new MoveBlockCommand(
                        block.id,
                        state.dragStartPos.x, state.dragStartPos.y,
                        block.x, block.y
                    );
                    pushCommand(cmd);
                }
            }

            // Clear all preview states
            clearParentingPreview();
            if (block) {
                clearUnparentingPreview(block);
            }

            // Restore transparency of blocks that were made transparent during drag
            restoreTransparencyAfterDrag();

            state.dragStartPos = null;
            scheduleAutoSave();
        } else if (state.isResizing && state.selectedBlockId) {
            const block = state.blocks.find(b => b.id === state.selectedBlockId);
            // Create resize command if size or position changed
            if (block && state.resizeStartSize) {
                if (block.width !== state.resizeStartSize.width || block.height !== state.resizeStartSize.height ||
                    block.x !== state.resizeStartSize.x || block.y !== state.resizeStartSize.y) {
                    const cmd = new ResizeBlockCommand(
                        block.id,
                        state.resizeStartSize.x, state.resizeStartSize.y,
                        state.resizeStartSize.width, state.resizeStartSize.height,
                        block.x, block.y,
                        block.width, block.height
                    );
                    pushCommand(cmd);
                }
            }
            state.resizeStartSize = null;
            scheduleAutoSave();
        }

        state.isDragging = false;
        state.isResizing = false;
        state.resizeCorner = null;
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
                    navigateIntoDiagram(blockId);
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
        // Undo: Ctrl+Z (or Cmd+Z on Mac)
        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
            e.preventDefault();
            undo();
            return;
        }

        // Redo: Ctrl+Y or Ctrl+Shift+Z (or Cmd+Y / Cmd+Shift+Z on Mac)
        if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey) || (e.key === 'Z' && e.shiftKey))) {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
            e.preventDefault();
            redo();
            return;
        }

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
            selectConnection,
            renderBlock,
            renderConnection,
            renderCanvas,
            renderDiagramList,
            renderBreadcrumb,
            createConnection,
            deleteConnection,
            updateConnectionsForBlock,
            createDiagram,
            switchDiagram,
            deleteDiagram,
            renameDiagram,
            createProxyBlock,
            navigateIntoDiagram,
            navigateBack,

            // Connection mode
            enterConnectionMode,
            exitConnectionMode,
            updateTempLine,

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

            // Nesting functions
            localToGlobal,
            globalToLocal,
            getGlobalBounds,
            getAncestors,
            getDescendants,
            isAncestorOf,
            findPotentialParent,
            performParenting,
            performUnparenting,
            performParentingInternal,
            performUnparentingInternal,
            autoResizeParent,
            getMinSizeForChildren,
            handleParentingDuringDrag,
            clearParentingPreview,
            clearParentingTimer,
            clearUnparentingPreview,
            NESTING_CONSTANTS: NESTING_CONSTANTS,

            // Undo/Redo functions
            undo,
            redo,
            executeCommand,
            pushCommand,
            clearUndoRedo,
            updateUndoRedoButtons,
            deepClone,
            restoreBlock,
            restoreConnection,
            createBlockInternal,
            deleteBlockInternal,
            updateBlockInternal,
            createConnectionInternal,
            deleteConnectionInternal,

            // Command classes
            CreateBlockCommand,
            DeleteBlockCommand,
            UpdateBlockCommand,
            MoveBlockCommand,
            ResizeBlockCommand,
            CreateConnectionCommand,
            DeleteConnectionCommand,
            ParentBlockCommand,
            UnparentBlockCommand,

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
                navigationStack: [...state.navigationStack],
                mode: state.mode,
                connectionStart: state.connectionStart,
                isPanning: state.isPanning,
                panStart: state.panStart,
                isDragging: state.isDragging,
                dragOffset: state.dragOffset,
                isResizing: state.isResizing,
                resizeStart: state.resizeStart,
                viewBox: { ...state.viewBox },
                isDirty: state.isDirty,
                isParentingPreview: state.isParentingPreview,
                parentingTarget: state.parentingTarget,
                isUnparentingPreview: state.isUnparentingPreview,
                undoStack: [...state.undoStack],
                redoStack: [...state.redoStack],
                maxUndoDepth: state.maxUndoDepth
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
                state.isParentingPreview = false;
                state.parentingTarget = null;
                state.parentingTimer = null;
                state.isUnparentingPreview = false;
                nextDiagramId = 1; // Reset diagram ID counter
                // Safely clear DOM (elements might be null in tests)
                if (canvasContent) canvasContent.innerHTML = '';
                if (diagramList) diagramList.innerHTML = '';
                if (propertiesPanel) hideProperties();
            }
        };
    }
})();
