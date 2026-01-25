import { describe, it, expect, beforeAll, beforeEach } from 'vitest';

describe('Block Nesting', () => {
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
    });

    describe('Data Model', () => {
        it('should create blocks with nesting fields', () => {
            const block = window.__cbdiag__.createBlock(100, 100);

            expect(block.parentBlockId).toBeNull();
            expect(block.childBlockIds).toEqual([]);
        });

        it('should create proxy blocks with nesting fields', () => {
            const targetDiagram = window.__cbdiag__.createDiagram('Target');
            window.__cbdiag__.switchDiagram(window.__cbdiag__.getState().diagrams[0].id);
            const proxy = window.__cbdiag__.createProxyBlock(100, 100, targetDiagram.id);

            expect(proxy.parentBlockId).toBeNull();
            expect(proxy.childBlockIds).toEqual([]);
        });
    });

    describe('Coordinate Transformations', () => {
        it('should convert local to global for top-level block', () => {
            const block = window.__cbdiag__.createBlock(100, 200);
            const global = window.__cbdiag__.localToGlobal(block);

            expect(global.x).toBe(block.x);
            expect(global.y).toBe(block.y);
        });

        it('should convert local to global for nested block', () => {
            const parent = window.__cbdiag__.createBlock(100, 100);
            const child = window.__cbdiag__.createBlock(200, 200);

            // Manually set up parent-child relationship
            child.parentBlockId = parent.id;
            child.x = 50; // local coordinates
            child.y = 50;
            parent.childBlockIds = [child.id];

            const global = window.__cbdiag__.localToGlobal(child);

            // Should be parent position + child local position
            expect(global.x).toBe(parent.x + 50);
            expect(global.y).toBe(parent.y + 50);
        });

        it('should convert local to global for deeply nested block', () => {
            const grandparent = window.__cbdiag__.createBlock(100, 100);
            const parent = window.__cbdiag__.createBlock(200, 200);
            const child = window.__cbdiag__.createBlock(300, 300);

            // Set up grandparent -> parent -> child
            parent.parentBlockId = grandparent.id;
            parent.x = 20;
            parent.y = 20;
            grandparent.childBlockIds = [parent.id];

            child.parentBlockId = parent.id;
            child.x = 10;
            child.y = 10;
            parent.childBlockIds = [child.id];

            const global = window.__cbdiag__.localToGlobal(child);

            // Should be grandparent + parent + child positions
            expect(global.x).toBe(grandparent.x + 20 + 10);
            expect(global.y).toBe(grandparent.y + 20 + 10);
        });

        it('should convert global to local for top-level', () => {
            const local = window.__cbdiag__.globalToLocal(100, 200, null);

            expect(local.x).toBe(100);
            expect(local.y).toBe(200);
        });

        it('should convert global to local for nested block', () => {
            const parent = window.__cbdiag__.createBlock(100, 100);

            // Convert global (150, 150) to local coordinates within parent
            const local = window.__cbdiag__.globalToLocal(150, 150, parent.id);

            // Should be global - parent position
            expect(local.x).toBe(150 - parent.x);
            expect(local.y).toBe(150 - parent.y);
        });

        it('should get global bounds for nested block', () => {
            const parent = window.__cbdiag__.createBlock(100, 100);
            const child = window.__cbdiag__.createBlock(200, 200);

            // Set up nesting
            child.parentBlockId = parent.id;
            child.x = 30;
            child.y = 40;
            parent.childBlockIds = [child.id];

            const bounds = window.__cbdiag__.getGlobalBounds(child);

            expect(bounds.x).toBe(parent.x + 30);
            expect(bounds.y).toBe(parent.y + 40);
            expect(bounds.width).toBe(child.width);
            expect(bounds.height).toBe(child.height);
            expect(bounds.right).toBe(parent.x + 30 + child.width);
            expect(bounds.bottom).toBe(parent.y + 40 + child.height);
        });
    });

    describe('Hierarchy Traversal', () => {
        it('should get ancestors for top-level block', () => {
            const block = window.__cbdiag__.createBlock(100, 100);
            const ancestors = window.__cbdiag__.getAncestors(block.id);

            expect(ancestors).toEqual([]);
        });

        it('should get ancestors for nested block', () => {
            const grandparent = window.__cbdiag__.createBlock(100, 100);
            const parent = window.__cbdiag__.createBlock(200, 200);
            const child = window.__cbdiag__.createBlock(300, 300);

            // Set up hierarchy
            parent.parentBlockId = grandparent.id;
            grandparent.childBlockIds = [parent.id];

            child.parentBlockId = parent.id;
            parent.childBlockIds = [child.id];

            const ancestors = window.__cbdiag__.getAncestors(child.id);

            expect(ancestors.length).toBe(2);
            expect(ancestors[0].id).toBe(parent.id);
            expect(ancestors[1].id).toBe(grandparent.id);
        });

        it('should get descendants for block with no children', () => {
            const block = window.__cbdiag__.createBlock(100, 100);
            const descendants = window.__cbdiag__.getDescendants(block.id);

            expect(descendants).toEqual([]);
        });

        it('should get descendants recursively', () => {
            const grandparent = window.__cbdiag__.createBlock(100, 100);
            const parent = window.__cbdiag__.createBlock(200, 200);
            const child = window.__cbdiag__.createBlock(300, 300);

            // Set up hierarchy
            parent.parentBlockId = grandparent.id;
            grandparent.childBlockIds = [parent.id];

            child.parentBlockId = parent.id;
            parent.childBlockIds = [child.id];

            const descendants = window.__cbdiag__.getDescendants(grandparent.id);

            expect(descendants.length).toBe(2);
            expect(descendants.some(d => d.id === parent.id)).toBe(true);
            expect(descendants.some(d => d.id === child.id)).toBe(true);
        });

        it('should check isAncestorOf correctly', () => {
            const grandparent = window.__cbdiag__.createBlock(100, 100);
            const parent = window.__cbdiag__.createBlock(200, 200);
            const child = window.__cbdiag__.createBlock(300, 300);
            const unrelated = window.__cbdiag__.createBlock(400, 400);

            // Set up hierarchy
            parent.parentBlockId = grandparent.id;
            grandparent.childBlockIds = [parent.id];

            child.parentBlockId = parent.id;
            parent.childBlockIds = [child.id];

            expect(window.__cbdiag__.isAncestorOf(grandparent.id, child.id)).toBe(true);
            expect(window.__cbdiag__.isAncestorOf(parent.id, child.id)).toBe(true);
            expect(window.__cbdiag__.isAncestorOf(child.id, grandparent.id)).toBe(false);
            expect(window.__cbdiag__.isAncestorOf(unrelated.id, child.id)).toBe(false);
        });
    });

    describe('Parenting Operations', () => {
        it('should perform parenting and update relationships', () => {
            const parent = window.__cbdiag__.createBlock(100, 100);
            parent.width = 300;
            parent.height = 200;
            const child = window.__cbdiag__.createBlock(200, 200);

            window.__cbdiag__.performParenting(child.id, parent.id);

            expect(child.parentBlockId).toBe(parent.id);
            expect(parent.childBlockIds).toContain(child.id);
        });

        it('should convert coordinates on parenting', () => {
            const parent = window.__cbdiag__.createBlock(100, 100);
            parent.width = 300;
            parent.height = 200;
            const child = window.__cbdiag__.createBlock(200, 200);

            // Store original global position
            const originalGlobal = window.__cbdiag__.getGlobalBounds(child);

            window.__cbdiag__.performParenting(child.id, parent.id);

            // After parenting, global position should be preserved
            const newGlobal = window.__cbdiag__.getGlobalBounds(child);
            expect(newGlobal.x).toBeCloseTo(originalGlobal.x, 1);
            expect(newGlobal.y).toBeCloseTo(originalGlobal.y, 1);
        });

        it('should prevent parenting to own descendant (cycle)', () => {
            const parent = window.__cbdiag__.createBlock(100, 100);
            parent.width = 300;
            parent.height = 200;
            const child = window.__cbdiag__.createBlock(200, 200);

            // Set up parent -> child
            window.__cbdiag__.performParenting(child.id, parent.id);

            // Try to make parent a child of child (should not work)
            const originalParentId = parent.parentBlockId;
            window.__cbdiag__.performParenting(parent.id, child.id);

            // Parent should not have changed
            expect(parent.parentBlockId).toBe(originalParentId);
        });

        it('should remove from old parent when reparenting', () => {
            const oldParent = window.__cbdiag__.createBlock(100, 100);
            oldParent.width = 300;
            oldParent.height = 200;
            const newParent = window.__cbdiag__.createBlock(500, 100);
            newParent.width = 300;
            newParent.height = 200;
            const child = window.__cbdiag__.createBlock(150, 150);

            // Parent to old parent
            window.__cbdiag__.performParenting(child.id, oldParent.id);
            expect(oldParent.childBlockIds).toContain(child.id);

            // Reparent to new parent
            window.__cbdiag__.performParenting(child.id, newParent.id);

            expect(oldParent.childBlockIds).not.toContain(child.id);
            expect(newParent.childBlockIds).toContain(child.id);
            expect(child.parentBlockId).toBe(newParent.id);
        });
    });

    describe('Unparenting Operations', () => {
        it('should perform unparenting and update relationships', () => {
            const parent = window.__cbdiag__.createBlock(100, 100);
            parent.width = 300;
            parent.height = 200;
            const child = window.__cbdiag__.createBlock(200, 200);

            window.__cbdiag__.performParenting(child.id, parent.id);
            window.__cbdiag__.performUnparenting(child.id);

            expect(child.parentBlockId).toBeNull();
            expect(parent.childBlockIds).not.toContain(child.id);
        });

        it('should convert coordinates on unparenting', () => {
            const parent = window.__cbdiag__.createBlock(100, 100);
            parent.width = 300;
            parent.height = 200;
            const child = window.__cbdiag__.createBlock(200, 200);

            // Parent the child
            window.__cbdiag__.performParenting(child.id, parent.id);

            // Store global position while nested
            const globalWhileNested = window.__cbdiag__.getGlobalBounds(child);

            // Unparent
            window.__cbdiag__.performUnparenting(child.id);

            // After unparenting, position should be the same global coords
            expect(child.x).toBeCloseTo(globalWhileNested.x, 1);
            expect(child.y).toBeCloseTo(globalWhileNested.y, 1);
        });

        it('should move to top of z-order on unparenting', () => {
            const parent = window.__cbdiag__.createBlock(100, 100);
            parent.width = 300;
            parent.height = 200;
            const child = window.__cbdiag__.createBlock(200, 200);
            const topBlock = window.__cbdiag__.createBlock(400, 400);

            window.__cbdiag__.performParenting(child.id, parent.id);

            // topBlock should have highest z-index initially
            const topZBefore = topBlock.zIndex;

            window.__cbdiag__.performUnparenting(child.id);

            // Child should now have higher z-index than topBlock
            expect(child.zIndex).toBeGreaterThan(topZBefore);
        });

        it('should do nothing when unparenting block without parent', () => {
            const block = window.__cbdiag__.createBlock(100, 100);
            const originalX = block.x;
            const originalY = block.y;

            window.__cbdiag__.performUnparenting(block.id);

            expect(block.x).toBe(originalX);
            expect(block.y).toBe(originalY);
            expect(block.parentBlockId).toBeNull();
        });
    });

    describe('Auto-resize Parent', () => {
        it('should enlarge parent to fit children', () => {
            const parent = window.__cbdiag__.createBlock(100, 100);
            parent.width = 200;
            parent.height = 150;

            const child = window.__cbdiag__.createBlock(200, 200);

            // Manually set child inside parent
            child.parentBlockId = parent.id;
            child.x = 150; // Near edge
            child.y = 100;
            parent.childBlockIds = [child.id];

            window.__cbdiag__.autoResizeParent(parent);

            // Parent should have expanded to fit child + padding + buffer
            const PADDING = window.__cbdiag__.NESTING_CONSTANTS.PARENT_PADDING;
            const BUFFER = window.__cbdiag__.NESTING_CONSTANTS.MIN_PARENT_SIZE_BUFFER;
            expect(parent.width).toBeGreaterThanOrEqual(child.x + child.width + PADDING + BUFFER);
            expect(parent.height).toBeGreaterThanOrEqual(child.y + child.height + PADDING + BUFFER);
        });

        it('should shift children when at negative positions', () => {
            const parent = window.__cbdiag__.createBlock(100, 100);
            const child = window.__cbdiag__.createBlock(200, 200);

            // Manually set child at negative position
            child.parentBlockId = parent.id;
            child.x = 5; // Less than PARENT_PADDING
            child.y = 5;
            parent.childBlockIds = [child.id];

            window.__cbdiag__.autoResizeParent(parent);

            const PADDING = window.__cbdiag__.NESTING_CONSTANTS.PARENT_PADDING;
            expect(child.x).toBeGreaterThanOrEqual(PADDING);
            expect(child.y).toBeGreaterThanOrEqual(PADDING);
        });
    });

    describe('Resize Constraints', () => {
        it('should return default minimums for block without children', () => {
            const block = window.__cbdiag__.createBlock(100, 100);
            const minSize = window.__cbdiag__.getMinSizeForChildren(block);

            expect(minSize.minWidth).toBe(50);
            expect(minSize.minHeight).toBe(30);
        });

        it('should return minimum size based on children', () => {
            const parent = window.__cbdiag__.createBlock(100, 100);
            parent.width = 300;
            parent.height = 200;

            const child = window.__cbdiag__.createBlock(200, 200);
            child.parentBlockId = parent.id;
            child.x = 50;
            child.y = 40;
            parent.childBlockIds = [child.id];

            const minSize = window.__cbdiag__.getMinSizeForChildren(parent);
            const PADDING = window.__cbdiag__.NESTING_CONSTANTS.PARENT_PADDING;

            expect(minSize.minWidth).toBe(child.x + child.width + PADDING);
            expect(minSize.minHeight).toBe(child.y + child.height + PADDING);
        });
    });

    describe('Delete Cascade', () => {
        it('should delete children when parent is deleted', () => {
            const parent = window.__cbdiag__.createBlock(100, 100);
            parent.width = 300;
            parent.height = 200;
            const child = window.__cbdiag__.createBlock(200, 200);

            window.__cbdiag__.performParenting(child.id, parent.id);

            const childId = child.id;
            window.__cbdiag__.deleteBlock(parent.id);

            const state = window.__cbdiag__.getState();
            expect(state.blocks.find(b => b.id === childId)).toBeUndefined();
        });

        it('should delete deeply nested children', () => {
            const grandparent = window.__cbdiag__.createBlock(100, 100);
            grandparent.width = 400;
            grandparent.height = 300;
            const parent = window.__cbdiag__.createBlock(200, 200);
            parent.width = 200;
            parent.height = 150;
            const child = window.__cbdiag__.createBlock(300, 300);

            window.__cbdiag__.performParenting(parent.id, grandparent.id);
            window.__cbdiag__.performParenting(child.id, parent.id);

            const parentId = parent.id;
            const childId = child.id;

            window.__cbdiag__.deleteBlock(grandparent.id);

            const state = window.__cbdiag__.getState();
            expect(state.blocks.find(b => b.id === parentId)).toBeUndefined();
            expect(state.blocks.find(b => b.id === childId)).toBeUndefined();
        });

        it('should remove child from parent when child is deleted', () => {
            const parent = window.__cbdiag__.createBlock(100, 100);
            parent.width = 300;
            parent.height = 200;
            const child = window.__cbdiag__.createBlock(200, 200);

            window.__cbdiag__.performParenting(child.id, parent.id);

            window.__cbdiag__.deleteBlock(child.id);

            expect(parent.childBlockIds).not.toContain(child.id);
        });

        it('should delete connections to deleted nested blocks', () => {
            const parent = window.__cbdiag__.createBlock(100, 100);
            parent.width = 300;
            parent.height = 200;
            const child = window.__cbdiag__.createBlock(200, 200);
            const other = window.__cbdiag__.createBlock(500, 100);

            window.__cbdiag__.performParenting(child.id, parent.id);
            const conn = window.__cbdiag__.createConnection(child.id, other.id);

            window.__cbdiag__.deleteBlock(parent.id);

            const state = window.__cbdiag__.getState();
            expect(state.connections.find(c => c.id === conn.id)).toBeUndefined();
        });
    });

    describe('Connection with Nested Blocks', () => {
        it('should use global coordinates for connection anchors', () => {
            const parent = window.__cbdiag__.createBlock(100, 100);
            parent.width = 300;
            parent.height = 200;
            const child = window.__cbdiag__.createBlock(200, 200);

            // Manually set up nesting
            child.parentBlockId = parent.id;
            child.x = 50;
            child.y = 50;
            parent.childBlockIds = [child.id];

            const anchor = window.__cbdiag__.getAnchorPoint(child, 'right');

            // Anchor should be at global position
            expect(anchor.x).toBe(parent.x + 50 + child.width);
            expect(anchor.y).toBe(parent.y + 50 + child.height / 2);
        });
    });

    describe('Find Potential Parent', () => {
        it('should find block under cursor', () => {
            const potentialParent = window.__cbdiag__.createBlock(100, 100);
            potentialParent.width = 300;
            potentialParent.height = 200;
            const child = window.__cbdiag__.createBlock(400, 400);

            // Move child's center inside potential parent
            child.x = potentialParent.x + 50;
            child.y = potentialParent.y + 50;

            const point = {
                x: potentialParent.x + 100,
                y: potentialParent.y + 100
            };

            const found = window.__cbdiag__.findPotentialParent(child, point);

            expect(found).not.toBeNull();
            expect(found.id).toBe(potentialParent.id);
        });

        it('should not return self as potential parent', () => {
            const block = window.__cbdiag__.createBlock(100, 100);

            const point = { x: block.x + 50, y: block.y + 30 };
            const found = window.__cbdiag__.findPotentialParent(block, point);

            expect(found).toBeNull();
        });

        it('should not return ancestor as potential parent', () => {
            const parent = window.__cbdiag__.createBlock(100, 100);
            parent.width = 300;
            parent.height = 200;
            const child = window.__cbdiag__.createBlock(200, 200);

            // Set up nesting
            child.parentBlockId = parent.id;
            child.x = 50;
            child.y = 50;
            parent.childBlockIds = [child.id];

            // Point inside parent
            const point = { x: parent.x + 150, y: parent.y + 100 };

            // Child should not be able to parent to its own parent
            const found = window.__cbdiag__.findPotentialParent(child, point);

            // Since child is already nested in parent, and we're looking at the same parent area,
            // it should return null (can't parent to existing parent)
            expect(found === null || found.id !== parent.id).toBe(true);
        });

        it('should not return descendant as potential parent', () => {
            const parent = window.__cbdiag__.createBlock(100, 100);
            parent.width = 300;
            parent.height = 200;
            const child = window.__cbdiag__.createBlock(200, 200);

            // Set up nesting
            child.parentBlockId = parent.id;
            child.x = 50;
            child.y = 50;
            parent.childBlockIds = [child.id];

            // Point inside child
            const childGlobal = window.__cbdiag__.getGlobalBounds(child);
            const point = { x: childGlobal.x + 30, y: childGlobal.y + 30 };

            // Parent should not be able to find child as potential parent (descendant)
            const found = window.__cbdiag__.findPotentialParent(parent, point);

            expect(found === null || found.id !== child.id).toBe(true);
        });
    });

    describe('Migration', () => {
        it('should add nesting fields during load if missing', () => {
            // Create a diagram and block, then manually remove nesting fields
            const block = window.__cbdiag__.createBlock(100, 100);
            delete block.parentBlockId;
            delete block.childBlockIds;

            // Save
            window.__cbdiag__.saveAllDiagrams();

            // Manually modify localStorage to simulate old data
            const saved = localStorage.getItem('cbdiag_diagrams');
            const data = JSON.parse(saved);
            data.diagrams[0].blocks[0].parentBlockId = undefined;
            data.diagrams[0].blocks[0].childBlockIds = undefined;
            localStorage.setItem('cbdiag_diagrams', JSON.stringify(data));

            // Reset and reload
            window.__cbdiag__.resetState();
            window.__cbdiag__.loadAllDiagrams();

            const state = window.__cbdiag__.getState();
            const loadedBlock = state.blocks[0];

            expect(loadedBlock.parentBlockId).toBeNull();
            expect(loadedBlock.childBlockIds).toEqual([]);
        });
    });
});
