import { describe, it, expect, beforeAll, beforeEach } from 'vitest';

describe('Connection Operations', () => {
    beforeAll(async () => {
        // Load app.js to expose __cbdiag__
        await import('../../js/app.js');
    });

    beforeEach(() => {
        // Reset state before each test
        window.__cbdiag__.resetState();
        // Create a diagram for testing (don't call init() as it requires full DOM)
        window.__cbdiag__.createDiagram('Test Diagram');
        const state = window.__cbdiag__.getState();
        if (state.diagrams.length > 0) {
            window.__cbdiag__.switchDiagram(state.diagrams[0].id);
        }
    });

    describe('createConnection', () => {
        it('should create connection between two blocks', () => {
            const block1 = window.__cbdiag__.createBlock(100, 100);
            const block2 = window.__cbdiag__.createBlock(300, 100);

            const conn = window.__cbdiag__.createConnection(block1.id, block2.id);

            expect(conn).toBeDefined();
            expect(conn.id).toMatch(/^conn-\d+$/);
            expect(conn.from).toBe(block1.id);
            expect(conn.to).toBe(block2.id);
        });

        it('should automatically determine best anchor sides', () => {
            const block1 = window.__cbdiag__.createBlock(100, 100);
            const block2 = window.__cbdiag__.createBlock(300, 100);

            const conn = window.__cbdiag__.createConnection(block1.id, block2.id);

            expect(conn.fromSide).toBe('right');
            expect(conn.toSide).toBe('left');
        });

        it('should add connection to state', () => {
            const block1 = window.__cbdiag__.createBlock(100, 100);
            const block2 = window.__cbdiag__.createBlock(300, 100);
            const initialCount = window.__cbdiag__.getState().connections.length;

            window.__cbdiag__.createConnection(block1.id, block2.id);

            const newCount = window.__cbdiag__.getState().connections.length;
            expect(newCount).toBe(initialCount + 1);
        });

        it('should prevent duplicate connections', () => {
            const block1 = window.__cbdiag__.createBlock(100, 100);
            const block2 = window.__cbdiag__.createBlock(300, 100);

            window.__cbdiag__.createConnection(block1.id, block2.id);
            const initialCount = window.__cbdiag__.getState().connections.length;

            window.__cbdiag__.createConnection(block1.id, block2.id);

            const newCount = window.__cbdiag__.getState().connections.length;
            expect(newCount).toBe(initialCount);
        });

        it('should prevent self-connections', () => {
            const block = window.__cbdiag__.createBlock(100, 100);
            const initialCount = window.__cbdiag__.getState().connections.length;

            window.__cbdiag__.createConnection(block.id, block.id);

            const newCount = window.__cbdiag__.getState().connections.length;
            expect(newCount).toBe(initialCount);
        });

        it('should handle vertical connections', () => {
            const block1 = window.__cbdiag__.createBlock(100, 100);
            const block2 = window.__cbdiag__.createBlock(100, 300);

            const conn = window.__cbdiag__.createConnection(block1.id, block2.id);

            expect(conn.fromSide).toBe('bottom');
            expect(conn.toSide).toBe('top');
        });
    });

    describe('deleteConnection', () => {
        it('should remove connection from state', () => {
            const block1 = window.__cbdiag__.createBlock(100, 100);
            const block2 = window.__cbdiag__.createBlock(300, 100);
            const conn = window.__cbdiag__.createConnection(block1.id, block2.id);
            const initialCount = window.__cbdiag__.getState().connections.length;

            window.__cbdiag__.deleteConnection(conn.id);

            const newCount = window.__cbdiag__.getState().connections.length;
            expect(newCount).toBe(initialCount - 1);
        });

        it('should not throw error when deleting non-existent connection', () => {
            expect(() => {
                window.__cbdiag__.deleteConnection('non-existent-id');
            }).not.toThrow();
        });
    });

    describe('connection updates on block move', () => {
        it('should update connection when source block moves', () => {
            const block1 = window.__cbdiag__.createBlock(100, 100);
            const block2 = window.__cbdiag__.createBlock(300, 100);
            window.__cbdiag__.createConnection(block1.id, block2.id);

            // Move block1 to a new position
            window.__cbdiag__.updateBlock(block1.id, { x: 150, y: 150 });

            // Connection should still exist
            const state = window.__cbdiag__.getState();
            expect(state.connections.length).toBeGreaterThan(0);
        });

        it('should update connection when target block moves', () => {
            const block1 = window.__cbdiag__.createBlock(100, 100);
            const block2 = window.__cbdiag__.createBlock(300, 100);
            window.__cbdiag__.createConnection(block1.id, block2.id);

            // Move block2 to a new position
            window.__cbdiag__.updateBlock(block2.id, { x: 400, y: 200 });

            // Connection should still exist
            const state = window.__cbdiag__.getState();
            expect(state.connections.length).toBeGreaterThan(0);
        });
    });

    describe('connection cascade delete', () => {
        it('should delete connections when source block is deleted', () => {
            const block1 = window.__cbdiag__.createBlock(100, 100);
            const block2 = window.__cbdiag__.createBlock(300, 100);
            const conn = window.__cbdiag__.createConnection(block1.id, block2.id);

            window.__cbdiag__.deleteBlock(block1.id);

            const state = window.__cbdiag__.getState();
            const hasConnection = state.connections.some(c => c.id === conn.id);
            expect(hasConnection).toBe(false);
        });

        it('should delete connections when target block is deleted', () => {
            const block1 = window.__cbdiag__.createBlock(100, 100);
            const block2 = window.__cbdiag__.createBlock(300, 100);
            const conn = window.__cbdiag__.createConnection(block1.id, block2.id);

            window.__cbdiag__.deleteBlock(block2.id);

            const state = window.__cbdiag__.getState();
            const hasConnection = state.connections.some(c => c.id === conn.id);
            expect(hasConnection).toBe(false);
        });

        it('should delete multiple connections from same block', () => {
            const block1 = window.__cbdiag__.createBlock(100, 100);
            const block2 = window.__cbdiag__.createBlock(300, 100);
            const block3 = window.__cbdiag__.createBlock(300, 300);

            window.__cbdiag__.createConnection(block1.id, block2.id);
            window.__cbdiag__.createConnection(block1.id, block3.id);

            window.__cbdiag__.deleteBlock(block1.id);

            const state = window.__cbdiag__.getState();
            expect(state.connections.length).toBe(0);
        });
    });
});
