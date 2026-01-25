import { describe, it, expect, beforeAll, beforeEach } from 'vitest';

describe('Block Operations', () => {
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

    describe('createBlock', () => {
        it('should create block at specified coordinates', () => {
            const block = window.__cbdiag__.createBlock(100, 200);

            expect(block).toBeDefined();
            expect(block.id).toMatch(/^block-\d+$/);
            expect(block.type).toBe('block');
            expect(block.x).toBe(40); // centered at 100-60
            expect(block.y).toBe(170); // centered at 200-30
            expect(block.width).toBe(120);
            expect(block.height).toBe(60);
            expect(block.label).toMatch(/^Block \d+$/);
            expect(block.color).toMatch(/^#[0-9a-f]{6}$/i);
            expect(block.opacity).toBe(0);
        });

        it('should assign highest z-index to new blocks', () => {
            const block1 = window.__cbdiag__.createBlock(100, 100);
            const block2 = window.__cbdiag__.createBlock(200, 200);

            expect(block2.zIndex).toBeGreaterThan(block1.zIndex);
        });

        it('should add block to state', () => {
            const initialCount = window.__cbdiag__.getState().blocks.length;
            window.__cbdiag__.createBlock(100, 100);
            const newCount = window.__cbdiag__.getState().blocks.length;

            expect(newCount).toBe(initialCount + 1);
        });

        it('should select newly created block', () => {
            const block = window.__cbdiag__.createBlock(100, 100);
            const state = window.__cbdiag__.getState();

            expect(state.selectedBlockId).toBe(block.id);
        });
    });

    describe('updateBlock', () => {
        it('should update block properties', () => {
            const block = window.__cbdiag__.createBlock(100, 100);

            window.__cbdiag__.updateBlock(block.id, {
                label: 'Updated Block',
                color: '#ff0000',
                width: 200,
                height: 100
            });

            const state = window.__cbdiag__.getState();
            const updatedBlock = state.blocks.find(b => b.id === block.id);

            expect(updatedBlock.label).toBe('Updated Block');
            expect(updatedBlock.color).toBe('#ff0000');
            expect(updatedBlock.width).toBe(200);
            expect(updatedBlock.height).toBe(100);
        });

        it('should update block opacity', () => {
            const block = window.__cbdiag__.createBlock(100, 100);

            window.__cbdiag__.updateBlock(block.id, { opacity: 0.5 });

            const state = window.__cbdiag__.getState();
            const updatedBlock = state.blocks.find(b => b.id === block.id);

            expect(updatedBlock.opacity).toBe(0.5);
        });

        it('should update block position', () => {
            const block = window.__cbdiag__.createBlock(100, 100);

            window.__cbdiag__.updateBlock(block.id, { x: 300, y: 400 });

            const state = window.__cbdiag__.getState();
            const updatedBlock = state.blocks.find(b => b.id === block.id);

            expect(updatedBlock.x).toBe(300);
            expect(updatedBlock.y).toBe(400);
        });

        it('should preserve unchanged properties', () => {
            const block = window.__cbdiag__.createBlock(100, 100);
            const originalLabel = block.label;

            window.__cbdiag__.updateBlock(block.id, { color: '#00ff00' });

            const state = window.__cbdiag__.getState();
            const updatedBlock = state.blocks.find(b => b.id === block.id);

            expect(updatedBlock.label).toBe(originalLabel);
            expect(updatedBlock.color).toBe('#00ff00');
        });

        it('should update block without triggering save when triggerSave is false', () => {
            const block = window.__cbdiag__.createBlock(100, 100);

            // Update with triggerSave = false
            window.__cbdiag__.updateBlock(block.id, { x: 200 }, false);

            const state = window.__cbdiag__.getState();
            const updatedBlock = state.blocks.find(b => b.id === block.id);
            expect(updatedBlock.x).toBe(200);
        });

        it('should do nothing when updating non-existent block', () => {
            const initialState = window.__cbdiag__.getState();
            const initialBlockCount = initialState.blocks.length;

            // Try to update non-existent block
            window.__cbdiag__.updateBlock('non-existent-id', { x: 500 });

            const state = window.__cbdiag__.getState();
            expect(state.blocks.length).toBe(initialBlockCount);
        });
    });

    describe('deleteBlock', () => {
        it('should remove block from state', () => {
            const block = window.__cbdiag__.createBlock(100, 100);
            const initialCount = window.__cbdiag__.getState().blocks.length;

            window.__cbdiag__.deleteBlock(block.id);

            const newCount = window.__cbdiag__.getState().blocks.length;
            expect(newCount).toBe(initialCount - 1);
        });

        it('should delete associated connections', () => {
            const block1 = window.__cbdiag__.createBlock(100, 100);
            const block2 = window.__cbdiag__.createBlock(300, 100);
            const conn = window.__cbdiag__.createConnection(block1.id, block2.id);

            window.__cbdiag__.deleteBlock(block1.id);

            const state = window.__cbdiag__.getState();
            const hasConnection = state.connections.some(c => c.id === conn.id);
            expect(hasConnection).toBe(false);
        });

        it('should clear selection if deleted block was selected', () => {
            const block = window.__cbdiag__.createBlock(100, 100);
            window.__cbdiag__.selectBlock(block.id);

            window.__cbdiag__.deleteBlock(block.id);

            const state = window.__cbdiag__.getState();
            expect(state.selectedBlockId).toBeNull();
        });

        it('should not affect selection when deleting unselected block', () => {
            const block1 = window.__cbdiag__.createBlock(100, 100);
            const block2 = window.__cbdiag__.createBlock(300, 100);
            window.__cbdiag__.selectBlock(block1.id);

            window.__cbdiag__.deleteBlock(block2.id);

            const state = window.__cbdiag__.getState();
            expect(state.selectedBlockId).toBe(block1.id);
        });

        it('should delete block even when no DOM element exists', () => {
            const block = window.__cbdiag__.createBlock(100, 100);
            // Remove the DOM element directly
            const el = document.getElementById(block.id);
            if (el) el.remove();

            const initialCount = window.__cbdiag__.getState().blocks.length;
            window.__cbdiag__.deleteBlock(block.id);

            const newCount = window.__cbdiag__.getState().blocks.length;
            expect(newCount).toBe(initialCount - 1);
        });
    });

    describe('selectBlock', () => {
        it('should set selected block ID', () => {
            const block = window.__cbdiag__.createBlock(100, 100);

            window.__cbdiag__.selectBlock(block.id);

            const state = window.__cbdiag__.getState();
            expect(state.selectedBlockId).toBe(block.id);
        });

        it('should handle selecting non-existent block gracefully', () => {
            window.__cbdiag__.selectBlock('non-existent-block-id');

            const state = window.__cbdiag__.getState();
            expect(state.selectedBlockId).toBe('non-existent-block-id');
        });

        it('should allow deselecting by passing null', () => {
            const block = window.__cbdiag__.createBlock(100, 100);
            window.__cbdiag__.selectBlock(block.id);

            window.__cbdiag__.selectBlock(null);

            const state = window.__cbdiag__.getState();
            expect(state.selectedBlockId).toBeNull();
        });
    });

    describe('createProxyBlock', () => {
        it('should create proxy block with target diagram ID', () => {
            const targetDiagram = window.__cbdiag__.createDiagram();
            const proxy = window.__cbdiag__.createProxyBlock(100, 100, targetDiagram.id);

            expect(proxy).toBeDefined();
            expect(proxy.type).toBe('proxy');
            expect(proxy.targetDiagramId).toBe(targetDiagram.id);
            expect(proxy.id).toMatch(/^block-\d+$/);
        });

        it('should have different styling than regular blocks', () => {
            const targetDiagram = window.__cbdiag__.createDiagram();
            const proxy = window.__cbdiag__.createProxyBlock(100, 100, targetDiagram.id);

            expect(proxy.color).toBe('#9b59b6');
        });

        it('should have default opacity of 0 (no transparency)', () => {
            const targetDiagram = window.__cbdiag__.createDiagram();
            const proxy = window.__cbdiag__.createProxyBlock(100, 100, targetDiagram.id);

            expect(proxy.opacity).toBe(0);
        });

        it('should assign highest z-index to new proxy blocks', () => {
            const targetDiagram = window.__cbdiag__.createDiagram();
            const block = window.__cbdiag__.createBlock(100, 100);
            const proxy = window.__cbdiag__.createProxyBlock(200, 200, targetDiagram.id);

            expect(proxy.zIndex).toBeGreaterThan(block.zIndex);
        });
    });
});
