import { describe, it, expect, beforeAll, beforeEach } from 'vitest';

describe('Diagram Operations', () => {
    beforeAll(async () => {
        // Load app.js to expose __cbdiag__
        await import('../../js/app.js');
    });

    beforeEach(() => {
        // Reset state before each test
        window.__cbdiag__.resetState();
    });

    describe('createDiagram', () => {
        it('should create a new diagram', () => {
            const diagram = window.__cbdiag__.createDiagram();

            expect(diagram).toBeDefined();
            expect(diagram.id).toMatch(/^diagram-\d+$/);
            expect(diagram.name).toMatch(/^Diagram \d+$/);
            expect(diagram.blocks).toEqual([]);
            expect(diagram.connections).toEqual([]);
        });

        it('should add diagram to state', () => {
            const initialCount = window.__cbdiag__.getState().diagrams.length;

            window.__cbdiag__.createDiagram();

            const newCount = window.__cbdiag__.getState().diagrams.length;
            expect(newCount).toBe(initialCount + 1);
        });

        it('should create diagrams with unique IDs', () => {
            const diagram1 = window.__cbdiag__.createDiagram();
            const diagram2 = window.__cbdiag__.createDiagram();

            expect(diagram1.id).not.toBe(diagram2.id);
        });

        it('should auto-increment diagram names', () => {
            const diagram1 = window.__cbdiag__.createDiagram();
            const diagram2 = window.__cbdiag__.createDiagram();

            expect(diagram1.name).toBe('Diagram 1');
            expect(diagram2.name).toBe('Diagram 2');
        });
    });

    describe('switchDiagram', () => {
        it('should switch to a different diagram', () => {
            const diagram1 = window.__cbdiag__.createDiagram();
            const diagram2 = window.__cbdiag__.createDiagram();

            // Initialize sets current diagram to first one
            window.__cbdiag__.init();
            window.__cbdiag__.switchDiagram(diagram2.id);

            const state = window.__cbdiag__.getState();
            expect(state.currentDiagramId).toBe(diagram2.id);
        });

        it('should clear blocks and connections from previous diagram', () => {
            const diagram1 = window.__cbdiag__.createDiagram();
            const diagram2 = window.__cbdiag__.createDiagram();

            window.__cbdiag__.init();
            window.__cbdiag__.switchDiagram(diagram1.id);

            // Add blocks to diagram1
            window.__cbdiag__.createBlock(100, 100);
            window.__cbdiag__.createBlock(200, 200);

            // Switch to diagram2
            window.__cbdiag__.switchDiagram(diagram2.id);

            const state = window.__cbdiag__.getState();
            expect(state.blocks.length).toBe(0);
            expect(state.connections.length).toBe(0);
        });

        it('should load blocks from new diagram', () => {
            const diagram1 = window.__cbdiag__.createDiagram();
            const diagram2 = window.__cbdiag__.createDiagram();

            window.__cbdiag__.init();
            window.__cbdiag__.switchDiagram(diagram1.id);

            // Add blocks to diagram1
            window.__cbdiag__.createBlock(100, 100);
            window.__cbdiag__.createBlock(200, 200);

            // Save and switch to diagram2
            window.__cbdiag__.saveAllDiagrams();
            window.__cbdiag__.switchDiagram(diagram2.id);

            // Add block to diagram2
            window.__cbdiag__.createBlock(300, 300);

            // Switch back to diagram1
            window.__cbdiag__.switchDiagram(diagram1.id);

            const state = window.__cbdiag__.getState();
            expect(state.blocks.length).toBe(2);
        });

        it('should do nothing when switching to non-existent diagram', () => {
            const diagram1 = window.__cbdiag__.createDiagram();

            window.__cbdiag__.init();
            window.__cbdiag__.switchDiagram(diagram1.id);

            // Try to switch to non-existent diagram
            window.__cbdiag__.switchDiagram('non-existent-diagram-id');

            const state = window.__cbdiag__.getState();
            expect(state.currentDiagramId).toBe(diagram1.id);
        });

        it('should clear selection when switching diagrams', () => {
            const diagram1 = window.__cbdiag__.createDiagram();
            const diagram2 = window.__cbdiag__.createDiagram();

            window.__cbdiag__.init();
            window.__cbdiag__.switchDiagram(diagram1.id);

            const block = window.__cbdiag__.createBlock(100, 100);
            window.__cbdiag__.selectBlock(block.id);

            window.__cbdiag__.switchDiagram(diagram2.id);

            const state = window.__cbdiag__.getState();
            expect(state.selectedBlockId).toBeNull();
        });
    });

    describe('deleteDiagram', () => {
        it('should delete a diagram', () => {
            const diagram1 = window.__cbdiag__.createDiagram();
            const diagram2 = window.__cbdiag__.createDiagram();
            const initialCount = window.__cbdiag__.getState().diagrams.length;

            window.__cbdiag__.deleteDiagram(diagram1.id);

            const newCount = window.__cbdiag__.getState().diagrams.length;
            expect(newCount).toBe(initialCount - 1);
        });

        it('should not delete the last diagram', () => {
            const diagram = window.__cbdiag__.createDiagram();

            window.__cbdiag__.deleteDiagram(diagram.id);

            const state = window.__cbdiag__.getState();
            expect(state.diagrams.length).toBeGreaterThan(0);
        });

        it('should switch to another diagram after deletion', () => {
            const diagram1 = window.__cbdiag__.createDiagram();
            const diagram2 = window.__cbdiag__.createDiagram();

            window.__cbdiag__.init();
            window.__cbdiag__.switchDiagram(diagram1.id);
            window.__cbdiag__.deleteDiagram(diagram1.id);

            const state = window.__cbdiag__.getState();
            expect(state.currentDiagramId).not.toBe(diagram1.id);
        });

        it('should remove diagram from localStorage', () => {
            const diagram = window.__cbdiag__.createDiagram();
            window.__cbdiag__.init();

            window.__cbdiag__.saveAllDiagrams();
            window.__cbdiag__.deleteDiagram(diagram.id);
            window.__cbdiag__.saveAllDiagrams();

            const state = window.__cbdiag__.getState();
            const hasDeletedDiagram = state.diagrams.some(d => d.id === diagram.id);
            expect(hasDeletedDiagram).toBe(false);
        });
    });

    describe('navigateIntoDiagram', () => {
        it('should navigate into a proxy block target diagram', () => {
            const diagram1 = window.__cbdiag__.createDiagram();
            const diagram2 = window.__cbdiag__.createDiagram();

            window.__cbdiag__.init();
            window.__cbdiag__.switchDiagram(diagram1.id);

            const proxy = window.__cbdiag__.createProxyBlock(100, 100, diagram2.id);

            window.__cbdiag__.navigateIntoDiagram(proxy.id);

            const state = window.__cbdiag__.getState();
            expect(state.currentDiagramId).toBe(diagram2.id);
        });

        it('should push to navigation stack', () => {
            const diagram1 = window.__cbdiag__.createDiagram();
            const diagram2 = window.__cbdiag__.createDiagram();

            window.__cbdiag__.init();
            window.__cbdiag__.switchDiagram(diagram1.id);

            const proxy = window.__cbdiag__.createProxyBlock(100, 100, diagram2.id);
            const initialStackLength = window.__cbdiag__.getState().navigationStack.length;

            window.__cbdiag__.navigateIntoDiagram(proxy.id);

            const newStackLength = window.__cbdiag__.getState().navigationStack.length;
            expect(newStackLength).toBe(initialStackLength + 1);
        });
    });

    describe('navigateBack', () => {
        it('should navigate back to previous diagram', () => {
            const diagram1 = window.__cbdiag__.createDiagram();
            const diagram2 = window.__cbdiag__.createDiagram();

            window.__cbdiag__.init();
            window.__cbdiag__.switchDiagram(diagram1.id);

            const proxy = window.__cbdiag__.createProxyBlock(100, 100, diagram2.id);
            window.__cbdiag__.navigateIntoDiagram(proxy.id);
            window.__cbdiag__.navigateBack();

            const state = window.__cbdiag__.getState();
            expect(state.currentDiagramId).toBe(diagram1.id);
        });

        it('should pop from navigation stack', () => {
            const diagram1 = window.__cbdiag__.createDiagram();
            const diagram2 = window.__cbdiag__.createDiagram();

            window.__cbdiag__.init();
            window.__cbdiag__.switchDiagram(diagram1.id);

            const proxy = window.__cbdiag__.createProxyBlock(100, 100, diagram2.id);
            window.__cbdiag__.navigateIntoDiagram(proxy.id);
            const stackLength = window.__cbdiag__.getState().navigationStack.length;

            window.__cbdiag__.navigateBack();

            const newStackLength = window.__cbdiag__.getState().navigationStack.length;
            expect(newStackLength).toBe(stackLength - 1);
        });

        it('should not navigate back when stack is empty', () => {
            window.__cbdiag__.init();
            const diagram1 = window.__cbdiag__.createDiagram();
            window.__cbdiag__.switchDiagram(diagram1.id);

            const currentId = window.__cbdiag__.getState().currentDiagramId;
            window.__cbdiag__.navigateBack();

            const newId = window.__cbdiag__.getState().currentDiagramId;
            expect(newId).toBe(currentId);
        });

        it('should navigate back to specific index in navigation stack', () => {
            const diagram1 = window.__cbdiag__.createDiagram();
            const diagram2 = window.__cbdiag__.createDiagram();
            const diagram3 = window.__cbdiag__.createDiagram();

            window.__cbdiag__.init();
            window.__cbdiag__.switchDiagram(diagram1.id);

            // Create proxy to diagram2
            const proxy1 = window.__cbdiag__.createProxyBlock(100, 100, diagram2.id);
            window.__cbdiag__.navigateIntoDiagram(proxy1.id);

            // Create proxy to diagram3
            const proxy2 = window.__cbdiag__.createProxyBlock(100, 100, diagram3.id);
            window.__cbdiag__.navigateIntoDiagram(proxy2.id);

            // Now we're in diagram3 with stack [diagram1->proxy1, diagram2->proxy2]
            expect(window.__cbdiag__.getState().navigationStack.length).toBe(2);

            // Navigate back to index 0 (should go to diagram1)
            window.__cbdiag__.navigateBack(0);

            const state = window.__cbdiag__.getState();
            expect(state.currentDiagramId).toBe(diagram1.id);
            expect(state.navigationStack.length).toBe(0);
        });

        it('should select proxy block after navigating back', () => {
            const diagram1 = window.__cbdiag__.createDiagram();
            const diagram2 = window.__cbdiag__.createDiagram();

            window.__cbdiag__.init();
            window.__cbdiag__.switchDiagram(diagram1.id);

            const proxy = window.__cbdiag__.createProxyBlock(100, 100, diagram2.id);
            window.__cbdiag__.navigateIntoDiagram(proxy.id);
            window.__cbdiag__.navigateBack();

            const state = window.__cbdiag__.getState();
            expect(state.selectedBlockId).toBe(proxy.id);
        });
    });
});
