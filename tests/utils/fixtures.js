/**
 * Sample test data fixtures for cbdiag tests
 */

export const sampleDiagram1 = {
    id: 'diagram-1',
    name: 'Sample Diagram 1',
    blocks: [
        {
            id: 'block-1',
            type: 'block',
            x: 100,
            y: 100,
            width: 120,
            height: 60,
            label: 'Block 1',
            color: '#4a90d9',
            zIndex: 0
        },
        {
            id: 'block-2',
            type: 'block',
            x: 300,
            y: 100,
            width: 120,
            height: 60,
            label: 'Block 2',
            color: '#5bc0de',
            zIndex: 1
        }
    ],
    connections: [
        {
            id: 'conn-1',
            fromBlockId: 'block-1',
            toBlockId: 'block-2',
            fromSide: 'right',
            toSide: 'left'
        }
    ],
    nextBlockId: 3,
    nextConnectionId: 2,
    viewBox: { x: 0, y: 0, width: 1200, height: 800 },
    createdAt: 1700000000000,
    updatedAt: 1700000000000
};

export const sampleDiagram2 = {
    id: 'diagram-2',
    name: 'Sample Diagram 2',
    blocks: [],
    connections: [],
    nextBlockId: 1,
    nextConnectionId: 1,
    viewBox: { x: 0, y: 0, width: 1200, height: 800 },
    createdAt: 1700000100000,
    updatedAt: 1700000100000
};

export const sampleDiagramWithProxy = {
    id: 'diagram-3',
    name: 'Diagram with Proxy',
    blocks: [
        {
            id: 'block-1',
            type: 'block',
            x: 100,
            y: 100,
            width: 120,
            height: 60,
            label: 'Regular Block',
            color: '#4a90d9',
            zIndex: 0
        },
        {
            id: 'proxy-1',
            type: 'proxy',
            x: 300,
            y: 100,
            width: 140,
            height: 70,
            label: 'Sample Diagram 2',
            color: '#8e44ad',
            linkedDiagramId: 'diagram-2',
            zIndex: 1
        }
    ],
    connections: [
        {
            id: 'conn-1',
            fromBlockId: 'block-1',
            toBlockId: 'proxy-1',
            fromSide: 'right',
            toSide: 'left'
        }
    ],
    nextBlockId: 2,
    nextConnectionId: 2,
    viewBox: { x: 0, y: 0, width: 1200, height: 800 },
    createdAt: 1700000200000,
    updatedAt: 1700000200000
};

export const savedStateV2 = {
    version: 2,
    diagrams: [sampleDiagram1, sampleDiagram2],
    currentDiagramId: 'diagram-1'
};

export const savedStateV1 = {
    blocks: sampleDiagram1.blocks,
    connections: sampleDiagram1.connections,
    nextBlockId: sampleDiagram1.nextBlockId,
    nextConnectionId: sampleDiagram1.nextConnectionId,
    viewBox: sampleDiagram1.viewBox
};

export const overlappingBlocks = [
    {
        id: 'block-bottom',
        type: 'block',
        x: 100,
        y: 100,
        width: 150,
        height: 80,
        label: 'Bottom Block',
        color: '#ff0000',
        zIndex: 0
    },
    {
        id: 'block-middle',
        type: 'block',
        x: 120,
        y: 120,
        width: 150,
        height: 80,
        label: 'Middle Block',
        color: '#00ff00',
        zIndex: 1
    },
    {
        id: 'block-top',
        type: 'block',
        x: 140,
        y: 140,
        width: 150,
        height: 80,
        label: 'Top Block',
        color: '#0000ff',
        zIndex: 2
    }
];
