import { vi } from 'vitest';

/**
 * Setup minimal DOM structure for testing
 */
export function setupTestDOM() {
    document.body.innerHTML = `
        <div id="app">
            <aside class="sidebar">
                <div class="sidebar-header">
                    <span class="logo">cbdiag</span>
                    <button id="new-diagram-btn" class="icon-btn">+</button>
                </div>
                <div id="diagram-list" class="diagram-list"></div>
            </aside>

            <div class="editor">
                <header class="toolbar">
                    <input type="text" id="diagram-name" class="diagram-name-input" placeholder="Untitled Diagram">
                    <button id="add-block-btn" class="tool-btn">+ Block</button>
                    <button id="add-proxy-btn" class="tool-btn">+ Proxy</button>
                    <button id="add-connection-btn" class="tool-btn">+ Connection</button>
                    <button id="delete-btn" class="tool-btn">Delete</button>
                    <span id="save-status" class="save-status">Saved</span>
                </header>

                <nav id="breadcrumb" class="breadcrumb hidden"></nav>

                <main class="canvas-container">
                    <svg id="canvas" class="canvas" viewBox="0 0 1200 800">
                        <defs>
                            <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                                <polygon points="0 0, 10 3.5, 0 7" fill="#666"/>
                            </marker>
                        </defs>
                        <g id="canvas-content">
                            <g id="connections-layer"></g>
                            <g id="blocks-layer"></g>
                        </g>
                    </svg>
                </main>

                <aside id="properties-panel" class="properties-panel hidden">
                    <h3 id="properties-title">Block Properties</h3>
                    <div id="block-properties">
                        <label>
                            Label:
                            <input type="text" id="block-label" placeholder="Enter label">
                        </label>
                        <label>
                            Color:
                            <input type="color" id="block-color" value="#4a90d9">
                        </label>
                    </div>
                    <div id="proxy-properties" class="hidden">
                        <label>
                            Linked Diagram:
                            <select id="proxy-diagram-select">
                                <option value="">Select a diagram...</option>
                            </select>
                        </label>
                    </div>
                    <div id="common-properties">
                        <label>
                            Width:
                            <input type="number" id="block-width" min="50" max="500">
                        </label>
                        <label>
                            Height:
                            <input type="number" id="block-height" min="30" max="500">
                        </label>
                        <label>
                            Z-Order:
                            <input type="number" id="block-zindex" min="-999" max="999">
                            <button id="bring-to-front" class="z-btn">⬆⬆</button>
                            <button id="send-to-back" class="z-btn">⬇⬇</button>
                        </label>
                    </div>
                </aside>

                <div id="proxy-modal" class="modal hidden">
                    <div class="modal-content">
                        <h3>Select Diagram for Proxy</h3>
                        <select id="proxy-modal-select">
                            <option value="">Select a diagram...</option>
                        </select>
                        <div class="modal-buttons">
                            <button id="proxy-modal-cancel" class="tool-btn">Cancel</button>
                            <button id="proxy-modal-create" class="tool-btn primary">Create Proxy</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Mock getBoundingClientRect for SVG canvas
    const canvas = document.getElementById('canvas');
    if (canvas) {
        canvas.getBoundingClientRect = vi.fn(() => ({
            x: 0,
            y: 0,
            width: 1200,
            height: 800,
            top: 0,
            left: 0,
            bottom: 800,
            right: 1200,
            toJSON: () => ({})
        }));
    }

    // Mock SVG methods
    if (typeof SVGElement !== 'undefined') {
        SVGElement.prototype.getBBox = vi.fn(() => ({
            x: 0,
            y: 0,
            width: 100,
            height: 50
        }));
    }
}

/**
 * Mock localStorage
 */
export function mockLocalStorage() {
    const store = {};

    const localStorageMock = {
        getItem: vi.fn((key) => store[key] || null),
        setItem: vi.fn((key, value) => {
            store[key] = value;
        }),
        removeItem: vi.fn((key) => {
            delete store[key];
        }),
        clear: vi.fn(() => {
            Object.keys(store).forEach(key => delete store[key]);
        })
    };

    global.localStorage = localStorageMock;
    return localStorageMock;
}

/**
 * Create test diagram fixture
 */
export function createTestDiagram(overrides = {}) {
    return {
        id: 'test-diagram-1',
        name: 'Test Diagram',
        blocks: [],
        connections: [],
        nextBlockId: 1,
        nextConnectionId: 1,
        viewBox: { x: 0, y: 0, width: 1200, height: 800 },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        ...overrides
    };
}

/**
 * Create test block fixture
 */
export function createTestBlock(overrides = {}) {
    return {
        id: 'block-1',
        type: 'block',
        x: 100,
        y: 100,
        width: 120,
        height: 60,
        label: 'Test Block',
        color: '#4a90d9',
        zIndex: 0,
        ...overrides
    };
}

/**
 * Create test proxy block fixture
 */
export function createTestProxyBlock(overrides = {}) {
    return {
        id: 'proxy-1',
        type: 'proxy',
        x: 100,
        y: 100,
        width: 140,
        height: 70,
        label: 'Test Proxy',
        color: '#8e44ad',
        zIndex: 0,
        linkedDiagramId: 'linked-diagram-1',
        ...overrides
    };
}

/**
 * Create test connection fixture
 */
export function createTestConnection(overrides = {}) {
    return {
        id: 'conn-1',
        fromBlockId: 'block-1',
        toBlockId: 'block-2',
        fromSide: 'right',
        toSide: 'left',
        ...overrides
    };
}

/**
 * Wait for next tick (useful for async operations)
 */
export function nextTick() {
    return new Promise(resolve => setTimeout(resolve, 0));
}

/**
 * Get SVG element by block ID
 */
export function getSVGBlock(blockId) {
    return document.getElementById(blockId);
}

/**
 * Get SVG connection path by connection ID
 */
export function getSVGConnection(connId) {
    return document.getElementById(connId);
}
