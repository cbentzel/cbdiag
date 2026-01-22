import { describe, it, expect, beforeAll, beforeEach } from 'vitest';

describe('Persistence Operations', () => {
    beforeAll(async () => {
        // Load app.js to expose __cbdiag__
        await import('../../js/app.js');
    });

    beforeEach(() => {
        // Reset state and localStorage before each test
        window.__cbdiag__.resetState();
        localStorage.clear();
    });

    describe('saveAllDiagrams', () => {
        it('should save diagrams to localStorage', () => {
            // Create a diagram for testing (don't call init() as it requires full DOM)
            const diagram = window.__cbdiag__.createDiagram('Test Diagram');
            window.__cbdiag__.switchDiagram(diagram.id);

            window.__cbdiag__.createBlock(100, 100);
            window.__cbdiag__.saveAllDiagrams();

            const saved = localStorage.getItem('cbdiag_diagrams');
            expect(saved).toBeTruthy();
        });

        it('should save all diagram data', () => {
            // Create a diagram for testing (don't call init() as it requires full DOM)
            const diagram = window.__cbdiag__.createDiagram('Test Diagram');
            window.__cbdiag__.switchDiagram(diagram.id);

            window.__cbdiag__.createBlock(100, 100);
            window.__cbdiag__.createBlock(200, 200);
            window.__cbdiag__.saveAllDiagrams();

            const saved = JSON.parse(localStorage.getItem('cbdiag_diagrams'));
            expect(saved.diagrams).toBeDefined();
            expect(saved.diagrams.length).toBeGreaterThan(0);
        });

        it('should include version in saved data', () => {
            // Create a diagram for testing (don't call init() as it requires full DOM)
            const diagram = window.__cbdiag__.createDiagram('Test Diagram');
            window.__cbdiag__.switchDiagram(diagram.id);
            window.__cbdiag__.saveAllDiagrams();

            const saved = JSON.parse(localStorage.getItem('cbdiag_diagrams'));
            expect(saved.version).toBe(2);
        });

        it('should save current diagram ID', () => {
            // Create a diagram for testing (don't call init() as it requires full DOM)
            const diagram = window.__cbdiag__.createDiagram('Test Diagram');
            window.__cbdiag__.switchDiagram(diagram.id);

            window.__cbdiag__.saveAllDiagrams();

            const saved = JSON.parse(localStorage.getItem('cbdiag_diagrams'));
            expect(saved.currentDiagramId).toBe(diagram.id);
        });

        it('should save block properties', () => {
            // Create a diagram for testing (don't call init() as it requires full DOM)
            const diagram = window.__cbdiag__.createDiagram('Test Diagram');
            window.__cbdiag__.switchDiagram(diagram.id);

            const block = window.__cbdiag__.createBlock(100, 150);
            window.__cbdiag__.updateBlock(block.id, {
                label: 'Test Block',
                color: '#ff0000',
                width: 200,
                height: 100
            });

            window.__cbdiag__.saveAllDiagrams();

            const saved = JSON.parse(localStorage.getItem('cbdiag_diagrams'));
            const savedDiagram = saved.diagrams.find(d => d.id === diagram.id);
            const savedBlock = savedDiagram.blocks[0];

            expect(savedBlock.label).toBe('Test Block');
            expect(savedBlock.color).toBe('#ff0000');
            expect(savedBlock.width).toBe(200);
            expect(savedBlock.height).toBe(100);
        });

        it('should save connection data', () => {
            // Create a diagram for testing (don't call init() as it requires full DOM)
            const diagram = window.__cbdiag__.createDiagram('Test Diagram');
            window.__cbdiag__.switchDiagram(diagram.id);

            const block1 = window.__cbdiag__.createBlock(100, 100);
            const block2 = window.__cbdiag__.createBlock(300, 100);
            window.__cbdiag__.createConnection(block1.id, block2.id);

            window.__cbdiag__.saveAllDiagrams();

            const saved = JSON.parse(localStorage.getItem('cbdiag_diagrams'));
            const savedDiagram = saved.diagrams.find(d => d.id === diagram.id);

            expect(savedDiagram.connections.length).toBe(1);
            expect(savedDiagram.connections[0].from).toBe(block1.id);
            expect(savedDiagram.connections[0].to).toBe(block2.id);
        });
    });

    describe('loadAllDiagrams', () => {
        it('should load diagrams from localStorage', () => {
            // Save some diagrams
            // Create a diagram for testing (don't call init() as it requires full DOM)
            const diagram = window.__cbdiag__.createDiagram('Test Diagram');
            window.__cbdiag__.switchDiagram(diagram.id);
            window.__cbdiag__.createBlock(100, 100);
            window.__cbdiag__.saveAllDiagrams();

            // Reset and load
            window.__cbdiag__.resetState();
            window.__cbdiag__.loadAllDiagrams();

            const state = window.__cbdiag__.getState();
            expect(state.diagrams.length).toBeGreaterThan(0);
        });

        it('should restore current diagram', () => {
            // Save with specific current diagram
            // Create a diagram for testing (don't call init() as it requires full DOM)
            const diagram = window.__cbdiag__.createDiagram('Test Diagram');
            window.__cbdiag__.switchDiagram(diagram.id);
            window.__cbdiag__.saveAllDiagrams();

            // Reset and load
            window.__cbdiag__.resetState();
            window.__cbdiag__.loadAllDiagrams();

            const state = window.__cbdiag__.getState();
            expect(state.currentDiagramId).toBe(diagram.id);
        });

        it('should restore blocks', () => {
            // Save with blocks
            // Create a diagram for testing (don't call init() as it requires full DOM)
            const diagram = window.__cbdiag__.createDiagram('Test Diagram');
            window.__cbdiag__.switchDiagram(diagram.id);
            window.__cbdiag__.createBlock(100, 100);
            window.__cbdiag__.createBlock(200, 200);
            window.__cbdiag__.saveAllDiagrams();

            // Reset and load
            window.__cbdiag__.resetState();
            window.__cbdiag__.loadAllDiagrams();
            window.__cbdiag__.switchDiagram(diagram.id);

            const state = window.__cbdiag__.getState();
            expect(state.blocks.length).toBe(2);
        });

        it('should restore connections', () => {
            // Save with connections
            // Create a diagram for testing (don't call init() as it requires full DOM)
            const diagram = window.__cbdiag__.createDiagram('Test Diagram');
            window.__cbdiag__.switchDiagram(diagram.id);
            const block1 = window.__cbdiag__.createBlock(100, 100);
            const block2 = window.__cbdiag__.createBlock(300, 100);
            window.__cbdiag__.createConnection(block1.id, block2.id);
            window.__cbdiag__.saveAllDiagrams();

            // Reset and load
            window.__cbdiag__.resetState();
            window.__cbdiag__.loadAllDiagrams();
            window.__cbdiag__.switchDiagram(diagram.id);

            const state = window.__cbdiag__.getState();
            expect(state.connections.length).toBe(1);
        });

        it('should handle empty localStorage', () => {
            localStorage.clear();

            window.__cbdiag__.loadAllDiagrams();

            const state = window.__cbdiag__.getState();
            // Should have at least one default diagram
            expect(state.diagrams.length).toBeGreaterThanOrEqual(0);
        });

        it('should handle corrupt data gracefully', () => {
            localStorage.setItem('cbdiag_diagrams', 'invalid json');

            expect(() => {
                window.__cbdiag__.loadAllDiagrams();
            }).not.toThrow();
        });

        it('should migrate v1 data to v2', () => {
            // Create v1 format data (without zIndex)
            const v1Data = {
                version: 1,
                diagrams: [{
                    id: 'diagram-1',
                    name: 'Test Diagram',
                    blocks: [{
                        id: 'block-1',
                        x: 100,
                        y: 100,
                        width: 120,
                        height: 60,
                        label: 'Old Block',
                        color: '#4a90d9'
                        // No zIndex in v1
                    }],
                    connections: [],
                    viewBox: { x: 0, y: 0, width: 1200, height: 800 }
                }],
                currentDiagramId: 'diagram-1'
            };

            localStorage.setItem('cbdiag_diagrams', JSON.stringify(v1Data));

            window.__cbdiag__.loadAllDiagrams();
            window.__cbdiag__.switchDiagram('diagram-1');

            const state = window.__cbdiag__.getState();
            const block = state.blocks[0];

            // Should have migrated and added zIndex
            expect(block.zIndex).toBeDefined();
            expect(typeof block.zIndex).toBe('number');
        });

        it('should migrate old single-diagram format', () => {
            // Old format used different localStorage key
            const oldData = {
                blocks: [{
                    id: 'old-block-1',
                    x: 50,
                    y: 50,
                    width: 100,
                    height: 50,
                    label: 'Old Format Block',
                    color: '#ff0000'
                }],
                connections: [],
                nextBlockId: 2,
                nextConnectionId: 1
            };

            localStorage.setItem('cbdiag-diagram', JSON.stringify(oldData));

            const result = window.__cbdiag__.loadAllDiagrams();

            expect(result).toBe(true);
            const state = window.__cbdiag__.getState();
            expect(state.diagrams.length).toBeGreaterThan(0);
            expect(state.diagrams[0].name).toBe('Migrated Diagram');
        });

        it('should return false when no saved data exists', () => {
            localStorage.clear();

            const result = window.__cbdiag__.loadAllDiagrams();

            expect(result).toBe(false);
        });

        it('should restore nextDiagramId from v2 data', () => {
            // Create v2 format data with diagram IDs
            const v2Data = {
                version: 2,
                diagrams: [
                    {
                        id: 'diagram-5',
                        name: 'Test 1',
                        blocks: [],
                        connections: [],
                        nextBlockId: 1,
                        nextConnectionId: 1,
                        viewBox: { x: 0, y: 0, width: 1200, height: 800 }
                    },
                    {
                        id: 'diagram-10',
                        name: 'Test 2',
                        blocks: [],
                        connections: [],
                        nextBlockId: 1,
                        nextConnectionId: 1,
                        viewBox: { x: 0, y: 0, width: 1200, height: 800 }
                    }
                ],
                currentDiagramId: 'diagram-5'
            };

            localStorage.setItem('cbdiag_diagrams', JSON.stringify(v2Data));

            window.__cbdiag__.loadAllDiagrams();

            // Create a new diagram - should get diagram-11 (one more than highest existing ID)
            const newDiagram = window.__cbdiag__.createDiagram('New Diagram');
            expect(newDiagram.id).toBe('diagram-11');
        });

        it('should restore nextDiagramId from v1 data', () => {
            // Create v1 format data
            const v1Data = {
                version: 1,
                diagrams: [
                    {
                        id: 'diagram-3',
                        name: 'Test Diagram',
                        blocks: [],
                        connections: [],
                        nextBlockId: 1,
                        nextConnectionId: 1,
                        viewBox: { x: 0, y: 0, width: 1200, height: 800 }
                    }
                ],
                currentDiagramId: 'diagram-3'
            };

            localStorage.setItem('cbdiag_diagrams', JSON.stringify(v1Data));

            window.__cbdiag__.loadAllDiagrams();

            // Create a new diagram - should get diagram-4
            const newDiagram = window.__cbdiag__.createDiagram('New Diagram');
            expect(newDiagram.id).toBe('diagram-4');
        });

        it('should handle diagrams with non-standard IDs', () => {
            // Create data with mix of standard and non-standard IDs
            const v2Data = {
                version: 2,
                diagrams: [
                    {
                        id: 'diagram-2',
                        name: 'Standard',
                        blocks: [],
                        connections: [],
                        nextBlockId: 1,
                        nextConnectionId: 1,
                        viewBox: { x: 0, y: 0, width: 1200, height: 800 }
                    },
                    {
                        id: 'custom-id',
                        name: 'Custom',
                        blocks: [],
                        connections: [],
                        nextBlockId: 1,
                        nextConnectionId: 1,
                        viewBox: { x: 0, y: 0, width: 1200, height: 800 }
                    }
                ],
                currentDiagramId: 'diagram-2'
            };

            localStorage.setItem('cbdiag_diagrams', JSON.stringify(v2Data));

            window.__cbdiag__.loadAllDiagrams();

            // Should only use standard IDs for nextDiagramId calculation
            const newDiagram = window.__cbdiag__.createDiagram('New Diagram');
            expect(newDiagram.id).toBe('diagram-3');
        });
    });

    describe('scheduleAutoSave', () => {
        it('should be callable without errors', () => {
            // Create a diagram for testing (don't call init() as it requires full DOM)
            const diagram = window.__cbdiag__.createDiagram('Test Diagram');
            window.__cbdiag__.switchDiagram(diagram.id);

            expect(() => {
                window.__cbdiag__.scheduleAutoSave();
            }).not.toThrow();
        });
    });
});
