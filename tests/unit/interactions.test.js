import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

describe('Mouse Interaction Handlers', () => {
    let canvas, blocksLayer, connectionsLayer;

    beforeAll(async () => {
        // Load app.js to expose __cbdiag__
        await import('../../js/app.js');
    });

    beforeEach(() => {
        // Reset state before each test
        window.__cbdiag__.resetState();

        // Create a diagram for testing
        window.__cbdiag__.createDiagram('Test Diagram');
        const state = window.__cbdiag__.getState();
        if (state.diagrams.length > 0) {
            window.__cbdiag__.switchDiagram(state.diagrams[0].id);
        }

        // Set up DOM elements
        canvas = document.getElementById('canvas');
        blocksLayer = document.getElementById('blocks-layer');
        connectionsLayer = document.getElementById('connections-layer');

        // Mock canvas.getBoundingClientRect()
        canvas.getBoundingClientRect = vi.fn(() => ({
            left: 0,
            top: 0,
            width: 1200,
            height: 800,
            right: 1200,
            bottom: 800,
            x: 0,
            y: 0
        }));

        // Initialize event handlers for interaction tests
        window.__cbdiag__.initEventHandlers();
    });

    describe('handleMouseDown', () => {
        it('should start dragging when clicking on block', () => {
            const block = window.__cbdiag__.createBlock(100, 100);
            window.__cbdiag__.renderCanvas();

            const blockElement = document.querySelector(`[data-block-id="${block.id}"]`);
            const mouseEvent = new MouseEvent('mousedown', {
                bubbles: true,
                clientX: 100,
                clientY: 100
            });

            // Dispatch on the block element itself so it bubbles to canvas
            blockElement.dispatchEvent(mouseEvent);

            const state = window.__cbdiag__.getState();
            expect(state.isDragging).toBe(true);
            expect(state.selectedBlockId).toBe(block.id);
        });

        it('should start resizing when clicking resize handle', () => {
            const block = window.__cbdiag__.createBlock(100, 100);
            window.__cbdiag__.renderCanvas();

            const blockElement = document.querySelector(`[data-block-id="${block.id}"]`);
            const resizeHandle = blockElement.querySelector('[data-resize="true"]');

            const mouseEvent = new MouseEvent('mousedown', {
                bubbles: true,
                clientX: 160,
                clientY: 130
            });

            // Dispatch on the resize handle so it bubbles to canvas
            resizeHandle.dispatchEvent(mouseEvent);

            const state = window.__cbdiag__.getState();
            expect(state.isResizing).toBe(true);
            expect(state.selectedBlockId).toBe(block.id);
            expect(state.resizeStart).toBeDefined();
        });

        it('should select connection when clicking on connection', () => {
            const block1 = window.__cbdiag__.createBlock(100, 100);
            const block2 = window.__cbdiag__.createBlock(300, 100);
            const conn = window.__cbdiag__.createConnection(block1.id, block2.id);
            window.__cbdiag__.renderCanvas();

            const connElement = document.querySelector(`[data-conn-id="${conn.id}"]`);
            const mouseEvent = new MouseEvent('mousedown', {
                bubbles: true,
                clientX: 200,
                clientY: 100
            });

            // Dispatch on the element so it bubbles to canvas
            connElement.dispatchEvent(mouseEvent);

            const state = window.__cbdiag__.getState();
            expect(state.selectedConnectionId).toBe(conn.id);
            expect(connElement.classList.contains('selected')).toBe(true);
        });

        it('should start panning when clicking canvas (no block or connection)', () => {
            const mouseEvent = new MouseEvent('mousedown', {
                bubbles: true,
                clientX: 500,
                clientY: 500
            });

            canvas.dispatchEvent(mouseEvent);

            const state = window.__cbdiag__.getState();
            expect(state.isPanning).toBe(true);
            expect(state.panStart).toEqual({ x: 500, y: 500 });
            expect(canvas.classList.contains('panning')).toBe(true);
        });

        it('should start connection from block in connection mode', () => {
            const block = window.__cbdiag__.createBlock(100, 100);
            window.__cbdiag__.renderCanvas();
            window.__cbdiag__.enterConnectionMode();

            const blockElement = document.querySelector(`[data-block-id="${block.id}"]`);
            const mouseEvent = new MouseEvent('mousedown', {
                bubbles: true,
                clientX: 100,
                clientY: 100
            });

            // Dispatch on the element so it bubbles to canvas
            blockElement.dispatchEvent(mouseEvent);

            const state = window.__cbdiag__.getState();
            expect(state.connectionStart).toBe(block.id);
        });

        it('should complete connection to block in connection mode', () => {
            const block1 = window.__cbdiag__.createBlock(100, 100);
            const block2 = window.__cbdiag__.createBlock(300, 100);
            window.__cbdiag__.renderCanvas();
            window.__cbdiag__.enterConnectionMode();

            // Start connection from block1
            const block1Element = document.querySelector(`[data-block-id="${block1.id}"]`);
            let mouseEvent = new MouseEvent('mousedown', {
                bubbles: true,
                clientX: 100,
                clientY: 100
            });
            // Dispatch on the element so it bubbles to canvas
            block1Element.dispatchEvent(mouseEvent);

            // Complete connection to block2
            const block2Element = document.querySelector(`[data-block-id="${block2.id}"]`);
            mouseEvent = new MouseEvent('mousedown', {
                bubbles: true,
                clientX: 300,
                clientY: 100
            });
            // Dispatch on the element so it bubbles to canvas
            block2Element.dispatchEvent(mouseEvent);

            const state = window.__cbdiag__.getState();
            expect(state.connections.length).toBe(1);
            expect(state.mode).toBe('select');
        });
    });

    describe('handleMouseMove', () => {
        it('should update temp line during connection mode', () => {
            const block = window.__cbdiag__.createBlock(100, 100);
            window.__cbdiag__.renderCanvas();
            window.__cbdiag__.enterConnectionMode();

            // Start connection
            const blockElement = document.querySelector(`[data-block-id="${block.id}"]`);
            let mouseEvent = new MouseEvent('mousedown', {
                bubbles: true,
                clientX: 100,
                clientY: 100
            });
            // Dispatch on the element so it bubbles to canvas
            blockElement.dispatchEvent(mouseEvent);

            // Move mouse
            mouseEvent = new MouseEvent('mousemove', {
                bubbles: true,
                clientX: 200,
                clientY: 200
            });
            canvas.dispatchEvent(mouseEvent);

            const tempLine = connectionsLayer.querySelector('.connection-temp');
            expect(tempLine).toBeDefined();
            expect(tempLine.getAttribute('d')).toContain('M');
            expect(tempLine.getAttribute('d')).toContain('L');
        });

        it('should resize block with min width constraint (50px)', () => {
            const block = window.__cbdiag__.createBlock(100, 100);
            window.__cbdiag__.renderCanvas();

            const blockElement = document.querySelector(`[data-block-id="${block.id}"]`);
            const resizeHandle = blockElement.querySelector('[data-resize="true"]');

            // Start resize
            let mouseEvent = new MouseEvent('mousedown', {
                bubbles: true,
                clientX: block.x + block.width,
                clientY: block.y + block.height
            });
            // Dispatch on the element so it bubbles to canvas
            resizeHandle.dispatchEvent(mouseEvent);

            // Try to resize smaller than minimum (should be constrained to 50)
            mouseEvent = new MouseEvent('mousemove', {
                bubbles: true,
                clientX: block.x + 20,
                clientY: block.y + block.height
            });
            canvas.dispatchEvent(mouseEvent);

            const state = window.__cbdiag__.getState();
            const updatedBlock = state.blocks.find(b => b.id === block.id);
            expect(updatedBlock.width).toBeGreaterThanOrEqual(50);
        });

        it('should resize block with min height constraint (30px)', () => {
            const block = window.__cbdiag__.createBlock(100, 100);
            window.__cbdiag__.renderCanvas();

            const blockElement = document.querySelector(`[data-block-id="${block.id}"]`);
            const resizeHandle = blockElement.querySelector('[data-resize="true"]');

            // Start resize
            let mouseEvent = new MouseEvent('mousedown', {
                bubbles: true,
                clientX: block.x + block.width,
                clientY: block.y + block.height
            });
            // Dispatch on the element so it bubbles to canvas
            resizeHandle.dispatchEvent(mouseEvent);

            // Try to resize smaller than minimum (should be constrained to 30)
            mouseEvent = new MouseEvent('mousemove', {
                bubbles: true,
                clientX: block.x + block.width,
                clientY: block.y + 10
            });
            canvas.dispatchEvent(mouseEvent);

            const state = window.__cbdiag__.getState();
            const updatedBlock = state.blocks.find(b => b.id === block.id);
            expect(updatedBlock.height).toBeGreaterThanOrEqual(30);
        });

        it.skip('should drag block with offset', () => {
            const block = window.__cbdiag__.createBlock(100, 100);
            window.__cbdiag__.renderCanvas();

            const blockElement = document.querySelector(`[data-block-id="${block.id}"]`);

            // Start drag at block center
            let mouseEvent = new MouseEvent('mousedown', {
                bubbles: true,
                clientX: block.x + block.width / 2,
                clientY: block.y + block.height / 2
            });
            blockElement.dispatchEvent(mouseEvent);

            // Check that dragging state is set
            let state = window.__cbdiag__.getState();
            expect(state.isDragging).toBe(true);
            expect(state.dragOffset).toBeDefined();

            // Move mouse  - dispatch on canvas since mousemove handler is on canvas
            mouseEvent = new MouseEvent('mousemove', {
                bubbles: true,
                clientX: block.x + block.width / 2 + 50,
                clientY: block.y + block.height / 2 + 50
            });
            canvas.dispatchEvent(mouseEvent);

            // Check that block position was updated
            state = window.__cbdiag__.getState();
            const updatedBlock = state.blocks.find(b => b.id === block.id);
            expect(updatedBlock.x).toBeGreaterThan(block.x);
            expect(updatedBlock.y).toBeGreaterThan(block.y);
        });

        it('should pan canvas when panning', () => {
            const state = window.__cbdiag__.getState();
            const originalViewBoxX = state.viewBox.x;
            const originalViewBoxY = state.viewBox.y;

            // Start panning
            let mouseEvent = new MouseEvent('mousedown', {
                bubbles: true,
                clientX: 500,
                clientY: 500
            });
            // Dispatch on the element so it bubbles to canvas
            canvas.dispatchEvent(mouseEvent);

            // Move mouse
            mouseEvent = new MouseEvent('mousemove', {
                bubbles: true,
                clientX: 450,
                clientY: 450
            });
            canvas.dispatchEvent(mouseEvent);

            const updatedState = window.__cbdiag__.getState();
            expect(updatedState.viewBox.x).not.toBe(originalViewBoxX);
            expect(updatedState.viewBox.y).not.toBe(originalViewBoxY);
        });
    });

    describe('handleMouseUp', () => {
        it('should stop dragging', () => {
            const block = window.__cbdiag__.createBlock(100, 100);
            window.__cbdiag__.renderCanvas();

            const blockElement = document.querySelector(`[data-block-id="${block.id}"]`);

            // Start drag
            let mouseEvent = new MouseEvent('mousedown', {
                bubbles: true,
                clientX: 100,
                clientY: 100
            });
            // Dispatch on the element so it bubbles to canvas
            blockElement.dispatchEvent(mouseEvent);

            let state = window.__cbdiag__.getState();
            expect(state.isDragging).toBe(true);

            // Mouse up
            mouseEvent = new MouseEvent('mouseup', {
                bubbles: true
            });
            canvas.dispatchEvent(mouseEvent);

            state = window.__cbdiag__.getState();
            expect(state.isDragging).toBe(false);
        });

        it('should stop resizing', () => {
            const block = window.__cbdiag__.createBlock(100, 100);
            window.__cbdiag__.renderCanvas();

            const blockElement = document.querySelector(`[data-block-id="${block.id}"]`);
            const resizeHandle = blockElement.querySelector('[data-resize="true"]');

            // Start resize
            let mouseEvent = new MouseEvent('mousedown', {
                bubbles: true,
                clientX: block.x + block.width,
                clientY: block.y + block.height
            });
            // Dispatch on the element so it bubbles to canvas
            resizeHandle.dispatchEvent(mouseEvent);

            let state = window.__cbdiag__.getState();
            expect(state.isResizing).toBe(true);

            // Mouse up
            mouseEvent = new MouseEvent('mouseup', {
                bubbles: true
            });
            canvas.dispatchEvent(mouseEvent);

            state = window.__cbdiag__.getState();
            expect(state.isResizing).toBe(false);
        });

        it('should trigger auto-save after drag or resize', () => {
            const block = window.__cbdiag__.createBlock(100, 100);
            window.__cbdiag__.renderCanvas();

            const blockElement = document.querySelector(`[data-block-id="${block.id}"]`);

            // Start drag
            let mouseEvent = new MouseEvent('mousedown', {
                bubbles: true,
                clientX: 100,
                clientY: 100
            });
            // Dispatch on the element so it bubbles to canvas
            blockElement.dispatchEvent(mouseEvent);

            // Mouse up
            mouseEvent = new MouseEvent('mouseup', {
                bubbles: true
            });
            canvas.dispatchEvent(mouseEvent);

            const state = window.__cbdiag__.getState();
            expect(state.isDirty).toBe(true);
        });
    });

    describe('handleDoubleClick', () => {
        it('should navigate into proxy block diagram', () => {
            // Create two diagrams
            const diagram1Id = window.__cbdiag__.getState().currentDiagramId;
            window.__cbdiag__.createDiagram('Target Diagram');
            const state = window.__cbdiag__.getState();
            const diagram2Id = state.diagrams[1].id;

            // Switch back to first diagram and create proxy block
            window.__cbdiag__.switchDiagram(diagram1Id);
            const proxyBlock = window.__cbdiag__.createBlock(100, 100);
            window.__cbdiag__.updateBlock(proxyBlock.id, {
                type: 'proxy',
                linkedDiagramId: diagram2Id
            });
            window.__cbdiag__.renderCanvas();

            const proxyElement = document.querySelector(`[data-block-id="${proxyBlock.id}"]`);
            const mouseEvent = new MouseEvent('dblclick', {
                bubbles: true,
                clientX: 100,
                clientY: 100
            });
            // Dispatch on the element so it bubbles to canvas
            proxyElement.dispatchEvent(mouseEvent);

            const updatedState = window.__cbdiag__.getState();
            expect(updatedState.currentDiagramId).toBe(diagram2Id);
            expect(updatedState.navigationStack.length).toBe(1);
        });

        it('should show alert for missing diagram', () => {
            // Define alert before spying on it (happy-dom doesn't provide it)
            window.alert = window.alert || (() => {});
            const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

            const proxyBlock = window.__cbdiag__.createBlock(100, 100);
            window.__cbdiag__.updateBlock(proxyBlock.id, {
                type: 'proxy',
                linkedDiagramId: 'non-existent-diagram'
            });
            window.__cbdiag__.renderCanvas();

            const proxyElement = document.querySelector(`[data-block-id="${proxyBlock.id}"]`);
            const mouseEvent = new MouseEvent('dblclick', {
                bubbles: true,
                clientX: 100,
                clientY: 100
            });
            // Dispatch on the element so it bubbles to canvas
            proxyElement.dispatchEvent(mouseEvent);

            expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('Linked diagram not found'));
            alertSpy.mockRestore();
        });

        it('should do nothing on regular block double click', () => {
            const block = window.__cbdiag__.createBlock(100, 100);
            const originalDiagramId = window.__cbdiag__.getState().currentDiagramId;
            window.__cbdiag__.renderCanvas();

            const blockElement = document.querySelector(`[data-block-id="${block.id}"]`);
            const mouseEvent = new MouseEvent('dblclick', {
                bubbles: true,
                clientX: 100,
                clientY: 100
            });
            // Dispatch on the element so it bubbles to canvas
            blockElement.dispatchEvent(mouseEvent);

            const state = window.__cbdiag__.getState();
            expect(state.currentDiagramId).toBe(originalDiagramId);
        });
    });

    describe('handleWheel', () => {
        it('should zoom in with positive deltaY', () => {
            const state = window.__cbdiag__.getState();
            const originalWidth = state.viewBox.width;

            const wheelEvent = new WheelEvent('wheel', {
                bubbles: true,
                clientX: 600,
                clientY: 400,
                deltaY: 100
            });

            canvas.dispatchEvent(wheelEvent);

            const updatedState = window.__cbdiag__.getState();
            expect(updatedState.viewBox.width).toBeGreaterThan(originalWidth);
        });

        it('should zoom out with negative deltaY', () => {
            const state = window.__cbdiag__.getState();
            const originalWidth = state.viewBox.width;

            const wheelEvent = new WheelEvent('wheel', {
                bubbles: true,
                clientX: 600,
                clientY: 400,
                deltaY: -100
            });

            canvas.dispatchEvent(wheelEvent);

            const updatedState = window.__cbdiag__.getState();
            expect(updatedState.viewBox.width).toBeLessThan(originalWidth);
        });

        it('should constrain zoom to min viewBox (200)', () => {
            const state = window.__cbdiag__.getState();
            state.viewBox.width = 250;
            state.viewBox.height = 250;

            // Try to zoom in beyond minimum
            const wheelEvent = new WheelEvent('wheel', {
                bubbles: true,
                clientX: 600,
                clientY: 400,
                deltaY: -500
            });

            canvas.dispatchEvent(wheelEvent);

            const updatedState = window.__cbdiag__.getState();
            expect(updatedState.viewBox.width).toBeGreaterThanOrEqual(200);
        });

        it('should constrain zoom to max viewBox (5000)', () => {
            const state = window.__cbdiag__.getState();
            state.viewBox.width = 4800;
            state.viewBox.height = 4800;

            // Try to zoom out beyond maximum
            const wheelEvent = new WheelEvent('wheel', {
                bubbles: true,
                clientX: 600,
                clientY: 400,
                deltaY: 500
            });

            canvas.dispatchEvent(wheelEvent);

            const updatedState = window.__cbdiag__.getState();
            expect(updatedState.viewBox.width).toBeLessThanOrEqual(5000);
        });

        it('should zoom centered on mouse position', () => {
            const state = window.__cbdiag__.getState();
            const originalX = state.viewBox.x;
            const originalY = state.viewBox.y;

            const wheelEvent = new WheelEvent('wheel', {
                bubbles: true,
                clientX: 300,
                clientY: 200,
                deltaY: 100
            });

            canvas.dispatchEvent(wheelEvent);

            const updatedState = window.__cbdiag__.getState();
            // ViewBox position should change to keep zoom centered on mouse
            expect(updatedState.viewBox.x !== originalX || updatedState.viewBox.y !== originalY).toBe(true);
        });
    });

    describe('handleKeyDown', () => {
        it('should delete selected block on Delete key', () => {
            const block = window.__cbdiag__.createBlock(100, 100);
            window.__cbdiag__.selectBlock(block.id);

            const keyEvent = new KeyboardEvent('keydown', {
                key: 'Delete',
                bubbles: true
            });

            document.dispatchEvent(keyEvent);

            const state = window.__cbdiag__.getState();
            expect(state.blocks.find(b => b.id === block.id)).toBeUndefined();
        });

        it('should delete selected connection on Delete key', () => {
            const block1 = window.__cbdiag__.createBlock(100, 100);
            const block2 = window.__cbdiag__.createBlock(300, 100);
            const conn = window.__cbdiag__.createConnection(block1.id, block2.id);
            window.__cbdiag__.renderCanvas();
            window.__cbdiag__.selectConnection(conn.id);

            const keyEvent = new KeyboardEvent('keydown', {
                key: 'Delete',
                bubbles: true
            });

            document.dispatchEvent(keyEvent);

            const state = window.__cbdiag__.getState();
            expect(state.connections.find(c => c.id === conn.id)).toBeUndefined();
        });

        it('should not delete when focused on input element', () => {
            const block = window.__cbdiag__.createBlock(100, 100);
            window.__cbdiag__.selectBlock(block.id);

            const input = document.createElement('input');
            document.body.appendChild(input);
            input.focus();

            const keyEvent = new KeyboardEvent('keydown', {
                key: 'Delete',
                bubbles: true
            });

            // Dispatch on input so it bubbles to document
            input.dispatchEvent(keyEvent);

            const state = window.__cbdiag__.getState();
            expect(state.blocks.find(b => b.id === block.id)).toBeDefined();

            document.body.removeChild(input);
        });

        it('should exit connection mode on Escape', () => {
            window.__cbdiag__.enterConnectionMode();
            expect(window.__cbdiag__.getState().mode).toBe('connecting');

            const keyEvent = new KeyboardEvent('keydown', {
                key: 'Escape',
                bubbles: true
            });

            document.dispatchEvent(keyEvent);

            const state = window.__cbdiag__.getState();
            expect(state.mode).toBe('select');
        });

        it('should deselect block on Escape', () => {
            const block = window.__cbdiag__.createBlock(100, 100);
            window.__cbdiag__.selectBlock(block.id);

            expect(window.__cbdiag__.getState().selectedBlockId).toBe(block.id);

            const keyEvent = new KeyboardEvent('keydown', {
                key: 'Escape',
                bubbles: true
            });

            document.dispatchEvent(keyEvent);

            const state = window.__cbdiag__.getState();
            expect(state.selectedBlockId).toBeNull();
        });

        it('should close proxy modal on Escape when modal is visible', () => {
            const proxyModal = document.getElementById('proxy-modal');
            proxyModal.classList.remove('hidden');

            expect(proxyModal.classList.contains('hidden')).toBe(false);

            const keyEvent = new KeyboardEvent('keydown', {
                key: 'Escape',
                bubbles: true
            });

            document.dispatchEvent(keyEvent);

            expect(proxyModal.classList.contains('hidden')).toBe(true);
        });

        it('should delete connection with Backspace key', () => {
            const block1 = window.__cbdiag__.createBlock(100, 100);
            const block2 = window.__cbdiag__.createBlock(300, 100);
            const connection = window.__cbdiag__.createConnection(block1.id, block2.id);

            window.__cbdiag__.selectConnection(connection.id);
            expect(window.__cbdiag__.getState().selectedConnectionId).toBe(connection.id);

            const keyEvent = new KeyboardEvent('keydown', {
                key: 'Backspace',
                bubbles: true
            });

            document.dispatchEvent(keyEvent);

            const state = window.__cbdiag__.getState();
            expect(state.connections.find(c => c.id === connection.id)).toBeUndefined();
        });
    });

    describe('Connection Mode Functions', () => {
        describe('enterConnectionMode', () => {
            it('should set mode to connecting', () => {
                window.__cbdiag__.enterConnectionMode();

                const state = window.__cbdiag__.getState();
                expect(state.mode).toBe('connecting');
            });

            it('should add CSS class to canvas', () => {
                window.__cbdiag__.enterConnectionMode();

                const canvas = document.getElementById('canvas');
                expect(canvas.classList.contains('connecting')).toBe(true);
            });
        });

        describe('exitConnectionMode', () => {
            it('should reset mode to select', () => {
                window.__cbdiag__.enterConnectionMode();
                window.__cbdiag__.exitConnectionMode();

                const state = window.__cbdiag__.getState();
                expect(state.mode).toBe('select');
            });

            it('should remove temp line', () => {
                const block = window.__cbdiag__.createBlock(100, 100);
                window.__cbdiag__.renderCanvas();
                window.__cbdiag__.enterConnectionMode();

                // Start connection to create temp line
                const blockElement = document.querySelector(`[data-block-id="${block.id}"]`);
                const mouseEvent = new MouseEvent('mousedown', {
                    bubbles: true,
                    clientX: 100,
                    clientY: 100
                });
                // Dispatch on the element so it bubbles to canvas
            blockElement.dispatchEvent(mouseEvent);

                // Move mouse to create temp line
                const moveEvent = new MouseEvent('mousemove', {
                    bubbles: true,
                    clientX: 200,
                    clientY: 200
                });
                canvas.dispatchEvent(moveEvent);

                const connectionsLayer = document.getElementById('connections-layer');
                expect(connectionsLayer.querySelector('.connection-temp')).toBeDefined();

                window.__cbdiag__.exitConnectionMode();

                expect(connectionsLayer.querySelector('.connection-temp')).toBeNull();
            });

            it('should remove CSS class from canvas', () => {
                window.__cbdiag__.enterConnectionMode();
                window.__cbdiag__.exitConnectionMode();

                const canvas = document.getElementById('canvas');
                expect(canvas.classList.contains('connecting')).toBe(false);
            });
        });

        describe('updateTempLine', () => {
            it('should create temp line if not exists', () => {
                const block = window.__cbdiag__.createBlock(100, 100);
                window.__cbdiag__.renderCanvas();
                window.__cbdiag__.enterConnectionMode();

                const blockElement = document.querySelector(`[data-block-id="${block.id}"]`);
                const mouseEvent = new MouseEvent('mousedown', {
                    bubbles: true,
                    clientX: 100,
                    clientY: 100
                });
                // Dispatch on the element so it bubbles to canvas
            blockElement.dispatchEvent(mouseEvent);

                const moveEvent = new MouseEvent('mousemove', {
                    bubbles: true,
                    clientX: 200,
                    clientY: 200
                });
                canvas.dispatchEvent(moveEvent);

                const connectionsLayer = document.getElementById('connections-layer');
                const tempLine = connectionsLayer.querySelector('.connection-temp');
                expect(tempLine).toBeDefined();
                expect(tempLine.tagName).toBe('path');
            });

            it.skip('should update temp line path', () => {
                const block = window.__cbdiag__.createBlock(100, 100);
                window.__cbdiag__.renderCanvas();
                window.__cbdiag__.enterConnectionMode();

                const blockElement = document.querySelector(`[data-block-id="${block.id}"]`);
                const mouseEvent = new MouseEvent('mousedown', {
                    bubbles: true,
                    clientX: 100,
                    clientY: 100
                });
                // Dispatch on the element so it bubbles to canvas
                blockElement.dispatchEvent(mouseEvent);

                // First move
                let moveEvent = new MouseEvent('mousemove', {
                    bubbles: true,
                    clientX: 200,
                    clientY: 200
                });
                canvas.dispatchEvent(moveEvent);

                const connectionsLayer = document.getElementById('connections-layer');
                let tempLine = connectionsLayer.querySelector('.connection-temp');
                expect(tempLine).not.toBeNull();
                const path1 = tempLine.getAttribute('d');

                // Second move
                moveEvent = new MouseEvent('mousemove', {
                    bubbles: true,
                    clientX: 300,
                    clientY: 300
                });
                canvas.dispatchEvent(moveEvent);

                const path2 = tempLine.getAttribute('d');
                expect(path2).not.toBe(path1);
            });

            it.skip('should use correct anchor point from block', () => {
                const block = window.__cbdiag__.createBlock(100, 100);
                window.__cbdiag__.renderCanvas();
                window.__cbdiag__.enterConnectionMode();

                const blockElement = document.querySelector(`[data-block-id="${block.id}"]`);
                const mouseEvent = new MouseEvent('mousedown', {
                    bubbles: true,
                    clientX: 100,
                    clientY: 100
                });
                // Dispatch on the element so it bubbles to canvas
            blockElement.dispatchEvent(mouseEvent);

                const moveEvent = new MouseEvent('mousemove', {
                    bubbles: true,
                    clientX: 300,
                    clientY: 100
                });
                canvas.dispatchEvent(moveEvent);

                const connectionsLayer = document.getElementById('connections-layer');
                const tempLine = connectionsLayer.querySelector('.connection-temp');
                const path = tempLine.getAttribute('d');

                // Path should start with M (move to anchor point)
                expect(path).toMatch(/^M \d+(\.\d+)? \d+(\.\d+)? L \d+(\.\d+)? \d+(\.\d+)?$/);
            });
        });
    });
});
