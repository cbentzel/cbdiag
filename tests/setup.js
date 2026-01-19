import { beforeEach, afterEach } from 'vitest';
import { setupTestDOM, mockLocalStorage } from './utils/test-helpers.js';

// Set test mode flag BEFORE any test files import app.js
window.__TEST_MODE__ = true;

// Setup DOM once before all tests (so app.js can capture element references)
setupTestDOM();

beforeEach(() => {
    // Mock localStorage for each test
    mockLocalStorage();

    // Clear canvas content but keep DOM structure intact
    const blocksLayer = document.getElementById('blocks-layer');
    const connectionsLayer = document.getElementById('connections-layer');
    const diagramList = document.getElementById('diagram-list');
    const breadcrumb = document.getElementById('breadcrumb');
    const propertiesPanel = document.getElementById('properties-panel');

    if (blocksLayer) blocksLayer.innerHTML = '';
    if (connectionsLayer) connectionsLayer.innerHTML = '';
    if (diagramList) diagramList.innerHTML = '';
    if (breadcrumb) breadcrumb.innerHTML = '';
    if (propertiesPanel) propertiesPanel.classList.add('hidden');
});

afterEach(() => {
    // Reset state if cbdiag was loaded (but don't delete __cbdiag__)
    if (window.__cbdiag__) {
        window.__cbdiag__.resetState?.();
    }
});
