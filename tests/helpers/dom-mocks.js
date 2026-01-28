import { vi } from 'vitest';

/**
 * Mock canvas element with getBoundingClientRect
 */
export function mockCanvas() {
    const canvas = document.getElementById('canvas');
    if (canvas) {
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
    }
    return canvas;
}

/**
 * Create synthetic mouse events
 */
export function createMouseEvent(type, options = {}) {
    const event = new MouseEvent(type, {
        bubbles: true,
        ...options
    });

    if (options.target) {
        Object.defineProperty(event, 'target', {
            value: options.target,
            writable: false
        });
    }

    return event;
}

/**
 * Create synthetic keyboard events
 */
export function createKeyboardEvent(key, options = {}) {
    return new KeyboardEvent('keydown', {
        key,
        bubbles: true,
        ...options
    });
}

/**
 * Mock SVG element
 */
export function mockSVGElement(type = 'svg') {
    return document.createElementNS('http://www.w3.org/2000/svg', type);
}

/**
 * Setup basic test environment with diagram and event handlers
 */
export function setupTestEnvironment() {
    // Reset state before each test
    window.__cbdiag__.resetState();

    // Create a diagram for testing
    window.__cbdiag__.createDiagram('Test Diagram');
    const state = window.__cbdiag__.getState();
    if (state.diagrams.length > 0) {
        window.__cbdiag__.switchDiagram(state.diagrams[0].id);
    }

    // Get DOM elements
    const canvas = document.getElementById('canvas');
    const canvasContent = document.getElementById('canvas-content');

    // Mock canvas.getBoundingClientRect()
    mockCanvas();

    return { canvas, canvasContent, state };
}
