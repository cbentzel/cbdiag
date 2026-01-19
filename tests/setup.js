import { beforeEach, afterEach } from 'vitest';
import { setupTestDOM, mockLocalStorage } from './utils/test-helpers.js';

// Set test mode flag BEFORE any test files import app.js
window.__TEST_MODE__ = true;

beforeEach(() => {
    // Setup DOM environment
    setupTestDOM();

    // Mock localStorage
    mockLocalStorage();
});

afterEach(() => {
    // Clean up DOM
    document.body.innerHTML = '';

    // Reset state if cbdiag was loaded (but don't delete __cbdiag__)
    if (window.__cbdiag__) {
        window.__cbdiag__.resetState?.();
    }
});
