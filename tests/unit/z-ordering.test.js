import { describe, it, expect, beforeAll, beforeEach } from 'vitest';

describe('Z-Ordering Operations', () => {
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

    describe('getMaxZIndex', () => {
        it('should return 0 when no blocks exist', () => {
            const result = window.__cbdiag__.getMaxZIndex();
            expect(result).toBe(0);
        });

        it('should return highest z-index from blocks', () => {
            const block1 = window.__cbdiag__.createBlock(100, 100);
            const block2 = window.__cbdiag__.createBlock(200, 200);
            const block3 = window.__cbdiag__.createBlock(300, 300);

            const maxZ = window.__cbdiag__.getMaxZIndex();
            expect(maxZ).toBeGreaterThanOrEqual(block1.zIndex);
            expect(maxZ).toBeGreaterThanOrEqual(block2.zIndex);
            expect(maxZ).toBeGreaterThanOrEqual(block3.zIndex);
        });

        it('should handle negative z-index values', () => {
            const block = window.__cbdiag__.createBlock(100, 100);
            window.__cbdiag__.updateBlock(block.id, { zIndex: -5 });

            const maxZ = window.__cbdiag__.getMaxZIndex();
            expect(maxZ).toBe(-5);
        });

        it('should handle mixed positive and negative z-index values', () => {
            const block1 = window.__cbdiag__.createBlock(100, 100);
            const block2 = window.__cbdiag__.createBlock(200, 200);
            window.__cbdiag__.updateBlock(block1.id, { zIndex: -5 });
            window.__cbdiag__.updateBlock(block2.id, { zIndex: 10 });

            const maxZ = window.__cbdiag__.getMaxZIndex();
            expect(maxZ).toBe(10);
        });
    });

    describe('getMinZIndex', () => {
        it('should return 0 when no blocks exist', () => {
            const result = window.__cbdiag__.getMinZIndex();
            expect(result).toBe(0);
        });

        it('should return lowest z-index from blocks', () => {
            const block1 = window.__cbdiag__.createBlock(100, 100);
            const block2 = window.__cbdiag__.createBlock(200, 200);
            const block3 = window.__cbdiag__.createBlock(300, 300);

            const minZ = window.__cbdiag__.getMinZIndex();
            expect(minZ).toBeLessThanOrEqual(block1.zIndex);
            expect(minZ).toBeLessThanOrEqual(block2.zIndex);
            expect(minZ).toBeLessThanOrEqual(block3.zIndex);
        });

        it('should handle negative z-index values', () => {
            const block1 = window.__cbdiag__.createBlock(100, 100);
            const block2 = window.__cbdiag__.createBlock(200, 200);
            window.__cbdiag__.updateBlock(block1.id, { zIndex: -10 });
            window.__cbdiag__.updateBlock(block2.id, { zIndex: -5 });

            const minZ = window.__cbdiag__.getMinZIndex();
            expect(minZ).toBe(-10);
        });

        it('should handle mixed positive and negative z-index values', () => {
            const block1 = window.__cbdiag__.createBlock(100, 100);
            const block2 = window.__cbdiag__.createBlock(200, 200);
            window.__cbdiag__.updateBlock(block1.id, { zIndex: -5 });
            window.__cbdiag__.updateBlock(block2.id, { zIndex: 10 });

            const minZ = window.__cbdiag__.getMinZIndex();
            expect(minZ).toBe(-5);
        });
    });

    describe('bringToFront', () => {
        it('should increase block z-index above all others', () => {
            const block1 = window.__cbdiag__.createBlock(100, 100);
            const block2 = window.__cbdiag__.createBlock(200, 200);
            const block3 = window.__cbdiag__.createBlock(300, 300);

            const maxZBefore = window.__cbdiag__.getMaxZIndex();
            window.__cbdiag__.bringToFront(block1.id);

            const state = window.__cbdiag__.getState();
            const updatedBlock = state.blocks.find(b => b.id === block1.id);

            expect(updatedBlock.zIndex).toBe(maxZBefore + 1);
        });

        it('should work on already front-most block', () => {
            const block1 = window.__cbdiag__.createBlock(100, 100);
            const block2 = window.__cbdiag__.createBlock(200, 200);

            const initialZ = block2.zIndex;
            window.__cbdiag__.bringToFront(block2.id);

            const state = window.__cbdiag__.getState();
            const updatedBlock = state.blocks.find(b => b.id === block2.id);

            expect(updatedBlock.zIndex).toBeGreaterThan(initialZ);
        });

        it('should work multiple times on same block', () => {
            const block = window.__cbdiag__.createBlock(100, 100);

            window.__cbdiag__.bringToFront(block.id);
            const z1 = window.__cbdiag__.getState().blocks.find(b => b.id === block.id).zIndex;

            window.__cbdiag__.bringToFront(block.id);
            const z2 = window.__cbdiag__.getState().blocks.find(b => b.id === block.id).zIndex;

            window.__cbdiag__.bringToFront(block.id);
            const z3 = window.__cbdiag__.getState().blocks.find(b => b.id === block.id).zIndex;

            expect(z2).toBeGreaterThan(z1);
            expect(z3).toBeGreaterThan(z2);
        });

        it('should bring block above negative z-index blocks', () => {
            const block1 = window.__cbdiag__.createBlock(100, 100);
            const block2 = window.__cbdiag__.createBlock(200, 200);

            window.__cbdiag__.updateBlock(block1.id, { zIndex: -10 });
            window.__cbdiag__.updateBlock(block2.id, { zIndex: -5 });

            window.__cbdiag__.bringToFront(block1.id);

            const state = window.__cbdiag__.getState();
            const updatedBlock = state.blocks.find(b => b.id === block1.id);

            expect(updatedBlock.zIndex).toBe(-4); // max (-5) + 1
        });
    });

    describe('sendToBack', () => {
        it('should decrease block z-index below all others', () => {
            const block1 = window.__cbdiag__.createBlock(100, 100);
            const block2 = window.__cbdiag__.createBlock(200, 200);
            const block3 = window.__cbdiag__.createBlock(300, 300);

            const minZBefore = window.__cbdiag__.getMinZIndex();
            window.__cbdiag__.sendToBack(block3.id);

            const state = window.__cbdiag__.getState();
            const updatedBlock = state.blocks.find(b => b.id === block3.id);

            expect(updatedBlock.zIndex).toBe(minZBefore - 1);
        });

        it('should work on already back-most block', () => {
            const block1 = window.__cbdiag__.createBlock(100, 100);
            const block2 = window.__cbdiag__.createBlock(200, 200);

            const initialZ = block1.zIndex;
            window.__cbdiag__.sendToBack(block1.id);

            const state = window.__cbdiag__.getState();
            const updatedBlock = state.blocks.find(b => b.id === block1.id);

            expect(updatedBlock.zIndex).toBeLessThan(initialZ);
        });

        it('should work multiple times on same block', () => {
            const block = window.__cbdiag__.createBlock(100, 100);

            window.__cbdiag__.sendToBack(block.id);
            const z1 = window.__cbdiag__.getState().blocks.find(b => b.id === block.id).zIndex;

            window.__cbdiag__.sendToBack(block.id);
            const z2 = window.__cbdiag__.getState().blocks.find(b => b.id === block.id).zIndex;

            window.__cbdiag__.sendToBack(block.id);
            const z3 = window.__cbdiag__.getState().blocks.find(b => b.id === block.id).zIndex;

            expect(z2).toBeLessThan(z1);
            expect(z3).toBeLessThan(z2);
        });

        it('should send block below positive z-index blocks', () => {
            const block1 = window.__cbdiag__.createBlock(100, 100);
            const block2 = window.__cbdiag__.createBlock(200, 200);

            window.__cbdiag__.updateBlock(block1.id, { zIndex: 5 });
            window.__cbdiag__.updateBlock(block2.id, { zIndex: 10 });

            window.__cbdiag__.sendToBack(block2.id);

            const state = window.__cbdiag__.getState();
            const updatedBlock = state.blocks.find(b => b.id === block2.id);

            expect(updatedBlock.zIndex).toBe(4); // min (5) - 1
        });
    });

    describe('z-index persistence', () => {
        it('should persist z-index when saving', () => {
            const block = window.__cbdiag__.createBlock(100, 100);
            window.__cbdiag__.updateBlock(block.id, { zIndex: 42 });

            window.__cbdiag__.saveAllDiagrams();

            const saved = JSON.parse(localStorage.getItem('cbdiag_diagrams'));
            const diagram = saved.diagrams[0];
            const savedBlock = diagram.blocks.find(b => b.id === block.id);

            expect(savedBlock.zIndex).toBe(42);
        });

        it('should restore z-index when loading', () => {
            const diagram = window.__cbdiag__.getState().diagrams[0];
            const block = window.__cbdiag__.createBlock(100, 100);
            window.__cbdiag__.updateBlock(block.id, { zIndex: 42 });

            window.__cbdiag__.saveAllDiagrams();
            window.__cbdiag__.resetState();
            window.__cbdiag__.loadAllDiagrams();
            window.__cbdiag__.switchDiagram(diagram.id);

            const state = window.__cbdiag__.getState();
            const restoredBlock = state.blocks.find(b => b.id === block.id);

            expect(restoredBlock.zIndex).toBe(42);
        });
    });

    describe('new block z-index assignment', () => {
        it('should assign incrementing z-index to new blocks', () => {
            const block1 = window.__cbdiag__.createBlock(100, 100);
            const block2 = window.__cbdiag__.createBlock(200, 200);
            const block3 = window.__cbdiag__.createBlock(300, 300);

            expect(block2.zIndex).toBeGreaterThan(block1.zIndex);
            expect(block3.zIndex).toBeGreaterThan(block2.zIndex);
        });

        it('should assign z-index above manually set values', () => {
            const block1 = window.__cbdiag__.createBlock(100, 100);
            window.__cbdiag__.updateBlock(block1.id, { zIndex: 100 });

            const block2 = window.__cbdiag__.createBlock(200, 200);

            expect(block2.zIndex).toBeGreaterThan(100);
        });

        it('should handle negative z-index when creating new blocks', () => {
            const block1 = window.__cbdiag__.createBlock(100, 100);
            window.__cbdiag__.updateBlock(block1.id, { zIndex: -5 });

            const block2 = window.__cbdiag__.createBlock(200, 200);

            expect(block2.zIndex).toBeGreaterThan(-5);
            expect(block2.zIndex).toBe(-4);
        });
    });
});
