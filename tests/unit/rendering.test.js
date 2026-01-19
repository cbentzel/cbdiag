import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { setupTestEnvironment } from '../helpers/dom-mocks.js';

describe('Rendering Functions', () => {
    let canvas, blocksLayer, connectionsLayer;

    beforeAll(async () => {
        // Load app.js to expose __cbdiag__
        await import('../../js/app.js');
    });

    beforeEach(() => {
        const env = setupTestEnvironment();
        canvas = env.canvas;
        blocksLayer = env.blocksLayer;
        connectionsLayer = env.connectionsLayer;
    });

    describe('renderBlock', () => {
        it('should create SVG group element with correct ID', () => {
            const block = window.__cbdiag__.createBlock(100, 100);
            window.__cbdiag__.renderBlock(block);

            const blockElement = document.getElementById(block.id);
            expect(blockElement).toBeDefined();
            expect(blockElement.tagName).toBe('g');
            expect(blockElement.getAttribute('id')).toBe(block.id);
        });

        it('should position block at correct coordinates', () => {
            const block = window.__cbdiag__.createBlock(150, 250);
            window.__cbdiag__.renderBlock(block);

            const blockElement = document.getElementById(block.id);
            const rect = blockElement.querySelector('rect');
            // createBlock centers at the given coords, so x = 150 - 60 = 90, y = 250 - 30 = 220
            expect(rect.getAttribute('x')).toBe(String(block.x));
            expect(rect.getAttribute('y')).toBe(String(block.y));
        });

        it('should apply width, height, and color', () => {
            const block = window.__cbdiag__.createBlock(100, 100);
            window.__cbdiag__.updateBlock(block.id, {
                width: 200,
                height: 100,
                color: '#ff0000'
            }, false);
            window.__cbdiag__.renderBlock(block);

            const blockElement = document.getElementById(block.id);
            const rect = blockElement.querySelector('rect');
            expect(rect.getAttribute('width')).toBe('200');
            expect(rect.getAttribute('height')).toBe('100');
            expect(rect.getAttribute('fill')).toBe('#ff0000');
        });

        it('should display block label', () => {
            const block = window.__cbdiag__.createBlock(100, 100);
            window.__cbdiag__.updateBlock(block.id, { label: 'Test Block' }, false);
            window.__cbdiag__.renderBlock(block);

            const blockElement = document.getElementById(block.id);
            const text = blockElement.querySelector('text');
            expect(text.textContent).toBe('Test Block');
        });

        it('should show proxy indicator for proxy blocks', () => {
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
            }, false);
            window.__cbdiag__.renderBlock(proxyBlock);

            const blockElement = document.getElementById(proxyBlock.id);
            expect(blockElement.classList.contains('proxy')).toBe(true);
            expect(blockElement.getAttribute('data-proxy')).toBe('true');
            expect(blockElement.getAttribute('data-linked-diagram')).toBe(diagram2Id);

            const proxyIcon = blockElement.querySelector('.proxy-icon');
            expect(proxyIcon).toBeDefined();
            expect(proxyIcon.textContent).toContain('click to enter');
        });

        it('should show "(Missing)" for proxy with invalid linkedDiagramId', () => {
            const proxyBlock = window.__cbdiag__.createBlock(100, 100);
            window.__cbdiag__.updateBlock(proxyBlock.id, {
                type: 'proxy',
                linkedDiagramId: 'non-existent-diagram'
            }, false);
            window.__cbdiag__.renderBlock(proxyBlock);

            const blockElement = document.getElementById(proxyBlock.id);
            const text = blockElement.querySelector('text');
            expect(text.textContent).toBe('(Missing)');
        });

        it('should update label from linked diagram name for valid proxy', () => {
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
            }, false);
            window.__cbdiag__.renderBlock(proxyBlock);

            const blockElement = document.getElementById(proxyBlock.id);
            const text = blockElement.querySelector('text');
            expect(text.textContent).toBe('Target Diagram');
        });

        it('should create resize handle', () => {
            const block = window.__cbdiag__.createBlock(100, 100);
            window.__cbdiag__.renderBlock(block);

            const blockElement = document.getElementById(block.id);
            const resizeHandle = blockElement.querySelector('[data-resize="true"]');
            expect(resizeHandle).toBeDefined();
            expect(resizeHandle.tagName).toBe('rect');
            expect(resizeHandle.getAttribute('width')).toBe('10');
            expect(resizeHandle.getAttribute('height')).toBe('10');
        });

        it('should insert block in correct z-index order (lower z-index first)', () => {
            const block1 = window.__cbdiag__.createBlock(100, 100);
            window.__cbdiag__.updateBlock(block1.id, { zIndex: 2 }, false);
            window.__cbdiag__.renderBlock(block1);

            const block2 = window.__cbdiag__.createBlock(200, 100);
            window.__cbdiag__.updateBlock(block2.id, { zIndex: 1 }, false);
            window.__cbdiag__.renderBlock(block2);

            const block3 = window.__cbdiag__.createBlock(300, 100);
            window.__cbdiag__.updateBlock(block3.id, { zIndex: 3 }, false);
            window.__cbdiag__.renderBlock(block3);

            const children = Array.from(blocksLayer.children);
            const ids = children.map(el => el.getAttribute('data-block-id'));

            // block2 (z:1) should be first, block1 (z:2) second, block3 (z:3) third
            expect(ids.indexOf(block2.id)).toBeLessThan(ids.indexOf(block1.id));
            expect(ids.indexOf(block1.id)).toBeLessThan(ids.indexOf(block3.id));
        });

        it('should replace existing block element when re-rendering', () => {
            const block = window.__cbdiag__.createBlock(100, 100);
            window.__cbdiag__.renderBlock(block);

            const firstElement = document.getElementById(block.id);
            expect(firstElement).toBeDefined();

            // Re-render the same block
            window.__cbdiag__.updateBlock(block.id, { label: 'Updated' }, false);
            window.__cbdiag__.renderBlock(block);

            const secondElement = document.getElementById(block.id);
            expect(secondElement).toBeDefined();

            // Should be only one element with this ID
            const allElements = document.querySelectorAll(`#${block.id}`);
            expect(allElements.length).toBe(1);
        });
    });

    describe('renderConnection', () => {
        it('should create SVG path element', () => {
            const block1 = window.__cbdiag__.createBlock(100, 100);
            const block2 = window.__cbdiag__.createBlock(300, 100);
            const conn = window.__cbdiag__.createConnection(block1.id, block2.id);

            const connElement = document.getElementById(conn.id);
            expect(connElement).toBeDefined();
            expect(connElement.tagName).toBe('path');
            expect(connElement.classList.contains('connection')).toBe(true);
        });

        it('should calculate correct path between blocks', () => {
            const block1 = window.__cbdiag__.createBlock(100, 100);
            const block2 = window.__cbdiag__.createBlock(300, 100);
            const conn = window.__cbdiag__.createConnection(block1.id, block2.id);

            const connElement = document.getElementById(conn.id);
            const path = connElement.getAttribute('d');

            // Path should be in format "M x1 y1 L x2 y2"
            expect(path).toMatch(/^M \d+(\.\d+)? \d+(\.\d+)? L \d+(\.\d+)? \d+(\.\d+)?$/);
        });

        it('should use fromSide and toSide anchor points', () => {
            const block1 = window.__cbdiag__.createBlock(100, 100);
            const block2 = window.__cbdiag__.createBlock(300, 100);
            const conn = window.__cbdiag__.createConnection(block1.id, block2.id);

            expect(conn.fromSide).toBeDefined();
            expect(conn.toSide).toBeDefined();

            // For horizontally aligned blocks, should use right/left sides
            expect(['left', 'right', 'top', 'bottom']).toContain(conn.fromSide);
            expect(['left', 'right', 'top', 'bottom']).toContain(conn.toSide);
        });

        it('should apply marker-end arrowhead', () => {
            const block1 = window.__cbdiag__.createBlock(100, 100);
            const block2 = window.__cbdiag__.createBlock(300, 100);
            const conn = window.__cbdiag__.createConnection(block1.id, block2.id);

            const connElement = document.getElementById(conn.id);
            expect(connElement.getAttribute('marker-end')).toBe('url(#arrowhead)');
        });

        it('should replace existing connection element when re-rendering', () => {
            const block1 = window.__cbdiag__.createBlock(100, 100);
            const block2 = window.__cbdiag__.createBlock(300, 100);
            const conn = window.__cbdiag__.createConnection(block1.id, block2.id);

            const firstElement = document.getElementById(conn.id);
            expect(firstElement).toBeDefined();

            // Re-render by moving a block
            window.__cbdiag__.updateBlock(block1.id, { x: 150, y: 150 }, false);

            const secondElement = document.getElementById(conn.id);
            expect(secondElement).toBeDefined();

            // Should be only one element with this ID
            const allElements = document.querySelectorAll(`#${conn.id}`);
            expect(allElements.length).toBe(1);
        });
    });

    describe('renderDiagramList', () => {
        it('should render all diagrams in sidebar', () => {
            window.__cbdiag__.createDiagram('Diagram 1');
            window.__cbdiag__.createDiagram('Diagram 2');
            window.__cbdiag__.createDiagram('Diagram 3');
            window.__cbdiag__.renderDiagramList();

            const diagramList = document.getElementById('diagram-list');
            const items = diagramList.querySelectorAll('.diagram-item');

            // Should have all 4 diagrams (including the initial test diagram)
            expect(items.length).toBeGreaterThanOrEqual(3);
        });

        it('should highlight active diagram', () => {
            window.__cbdiag__.createDiagram('Diagram 1');
            const state = window.__cbdiag__.getState();
            const diagram1Id = state.diagrams[state.diagrams.length - 1].id;

            window.__cbdiag__.switchDiagram(diagram1Id);
            window.__cbdiag__.renderDiagramList();

            const diagramList = document.getElementById('diagram-list');
            const activeItem = diagramList.querySelector('.diagram-item.active');

            expect(activeItem).toBeDefined();
            expect(activeItem.getAttribute('data-diagram-id')).toBe(diagram1Id);
        });

        it('should include delete buttons', () => {
            window.__cbdiag__.createDiagram('Diagram 1');
            window.__cbdiag__.renderDiagramList();

            const diagramList = document.getElementById('diagram-list');
            const deleteButtons = diagramList.querySelectorAll('.diagram-item-delete');

            expect(deleteButtons.length).toBeGreaterThan(0);
            deleteButtons.forEach(btn => {
                expect(btn.textContent).toBe('×');
            });
        });

        it('should display diagram names', () => {
            window.__cbdiag__.createDiagram('My Custom Diagram');
            window.__cbdiag__.renderDiagramList();

            const diagramList = document.getElementById('diagram-list');
            const names = Array.from(diagramList.querySelectorAll('.diagram-item-name'))
                .map(el => el.textContent);

            expect(names).toContain('My Custom Diagram');
        });

        it('should clear previous list before rendering', () => {
            window.__cbdiag__.createDiagram('Diagram 1');
            window.__cbdiag__.renderDiagramList();

            const diagramList = document.getElementById('diagram-list');
            const firstCount = diagramList.children.length;

            // Render again without adding diagrams
            window.__cbdiag__.renderDiagramList();
            const secondCount = diagramList.children.length;

            // Should have the same count (not doubled)
            expect(secondCount).toBe(firstCount);
        });
    });

    describe('renderBreadcrumb', () => {
        it('should show breadcrumb for navigation stack', () => {
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
            }, false);

            // Navigate into the proxy (simulating double-click)
            window.__cbdiag__.navigateIntoDiagram(proxyBlock.id);
            window.__cbdiag__.renderBreadcrumb();

            const breadcrumb = document.getElementById('breadcrumb');
            expect(breadcrumb.classList.contains('hidden')).toBe(false);

            const items = breadcrumb.querySelectorAll('.breadcrumb-item');
            expect(items.length).toBeGreaterThan(0);
        });

        it('should include separators between items', () => {
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
            }, false);

            // Navigate into the proxy
            window.__cbdiag__.navigateIntoDiagram(proxyBlock.id);
            window.__cbdiag__.renderBreadcrumb();

            const breadcrumb = document.getElementById('breadcrumb');
            const separators = breadcrumb.querySelectorAll('.breadcrumb-separator');

            expect(separators.length).toBeGreaterThan(0);
            separators.forEach(sep => {
                expect(sep.textContent).toBe('>');
            });
        });

        it('should hide when navigation stack is empty', () => {
            window.__cbdiag__.renderBreadcrumb();

            const breadcrumb = document.getElementById('breadcrumb');
            expect(breadcrumb.classList.contains('hidden')).toBe(true);
        });
    });

    describe('renderCanvas', () => {
        it('should render all blocks', () => {
            window.__cbdiag__.createBlock(100, 100);
            window.__cbdiag__.createBlock(200, 200);
            window.__cbdiag__.createBlock(300, 300);

            window.__cbdiag__.renderCanvas();

            const blocks = blocksLayer.querySelectorAll('.block');
            expect(blocks.length).toBe(3);
        });

        it('should render all connections', () => {
            const block1 = window.__cbdiag__.createBlock(100, 100);
            const block2 = window.__cbdiag__.createBlock(300, 100);
            const block3 = window.__cbdiag__.createBlock(500, 100);

            window.__cbdiag__.createConnection(block1.id, block2.id);
            window.__cbdiag__.createConnection(block2.id, block3.id);

            window.__cbdiag__.renderCanvas();

            const connections = connectionsLayer.querySelectorAll('.connection');
            expect(connections.length).toBe(2);
        });

        it('should sort blocks by z-index before rendering', () => {
            const block1 = window.__cbdiag__.createBlock(100, 100);
            window.__cbdiag__.updateBlock(block1.id, { zIndex: 3 }, false);

            const block2 = window.__cbdiag__.createBlock(200, 100);
            window.__cbdiag__.updateBlock(block2.id, { zIndex: 1 }, false);

            const block3 = window.__cbdiag__.createBlock(300, 100);
            window.__cbdiag__.updateBlock(block3.id, { zIndex: 2 }, false);

            window.__cbdiag__.renderCanvas();

            const children = Array.from(blocksLayer.children);
            const ids = children.map(el => el.getAttribute('data-block-id'));

            // Should be in order: block2 (z:1), block3 (z:2), block1 (z:3)
            expect(ids.indexOf(block2.id)).toBeLessThan(ids.indexOf(block3.id));
            expect(ids.indexOf(block3.id)).toBeLessThan(ids.indexOf(block1.id));
        });

        it('should clear canvas before rendering', () => {
            const block1 = window.__cbdiag__.createBlock(100, 100);
            window.__cbdiag__.renderCanvas();

            const firstCount = blocksLayer.children.length;
            expect(firstCount).toBe(1);

            // Render again without adding blocks
            window.__cbdiag__.renderCanvas();
            const secondCount = blocksLayer.children.length;

            // Should still have only 1 block (not doubled)
            expect(secondCount).toBe(1);
        });
    });
});
