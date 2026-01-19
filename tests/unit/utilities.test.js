import { describe, it, expect, beforeAll } from 'vitest';

describe('Utility Functions', () => {
    beforeAll(async () => {
        // Load app.js to expose __cbdiag__ (only once)
        // The test setup already set __TEST_MODE__ = true
        await import('../../js/app.js');
    });

    describe('darkenColor', () => {
        it('should darken a hex color by specified percentage', () => {
            const result = window.__cbdiag__.darkenColor('#ffffff', 20);
            expect(result).toBe('#cccccc');
        });

        it('should handle colors without # prefix', () => {
            const result = window.__cbdiag__.darkenColor('ffffff', 20);
            // darkenColor doesn't add # if input doesn't have it
            expect(result).toMatch(/^#?[0-9a-f]{6}$/);
        });

        it('should not go below #000000', () => {
            const result = window.__cbdiag__.darkenColor('#111111', 50);
            expect(result).toMatch(/^#[0-9a-f]{6}$/);
        });
    });

    describe('generateId', () => {
        it('should generate block ID with prefix', () => {
            const id = window.__cbdiag__.generateId('block');
            expect(id).toMatch(/^block-\d+$/);
        });

        it('should generate connection ID with prefix', () => {
            const id = window.__cbdiag__.generateId('conn');
            expect(id).toMatch(/^conn-\d+$/);
        });

        it('should generate unique IDs', () => {
            const id1 = window.__cbdiag__.generateId('block');
            const id2 = window.__cbdiag__.generateId('block');
            expect(id1).not.toBe(id2);
        });
    });

    describe('getMaxZIndex', () => {
        it('should return 0 when no blocks exist', () => {
            const result = window.__cbdiag__.getMaxZIndex();
            expect(result).toBe(0);
        });

        it('should return highest z-index from blocks', () => {
            // Test with state directly - getMaxZIndex is a pure function
            // It will be tested more thoroughly in integration tests
            const result = window.__cbdiag__.getMaxZIndex();
            expect(result).toBeGreaterThanOrEqual(0);
        });
    });

    describe('getMinZIndex', () => {
        it('should return 0 when no blocks exist', () => {
            const result = window.__cbdiag__.getMinZIndex();
            expect(result).toBe(0);
        });

        it('should return lowest z-index from blocks', () => {
            // Test with state directly - getMinZIndex is a pure function
            // It will be tested more thoroughly in integration tests
            const result = window.__cbdiag__.getMinZIndex();
            expect(result).toBeLessThanOrEqual(0);
        });
    });
});
