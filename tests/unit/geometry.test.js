import { describe, it, expect, beforeAll, vi } from 'vitest';

describe('Geometry Functions', () => {
    beforeAll(async () => {
        // Load app.js to expose __cbdiag__
        await import('../../js/app.js');
    });

    describe('screenToSvg', () => {
        it('should convert screen coordinates to SVG coordinates', () => {
            // Mock canvas getBoundingClientRect
            const mockCanvas = {
                getBoundingClientRect: () => ({
                    left: 0,
                    top: 0,
                    width: 800,
                    height: 600
                }),
                viewBox: {
                    baseVal: {
                        x: 0,
                        y: 0,
                        width: 800,
                        height: 600
                    }
                }
            };

            const result = window.__cbdiag__.screenToSvg(100, 50, mockCanvas);
            expect(result).toEqual({ x: 100, y: 50 });
        });

        it('should handle scaled viewBox', () => {
            const mockCanvas = {
                getBoundingClientRect: () => ({
                    left: 0,
                    top: 0,
                    width: 800,
                    height: 600
                }),
                viewBox: {
                    baseVal: {
                        x: 0,
                        y: 0,
                        width: 1600,
                        height: 1200
                    }
                }
            };

            const result = window.__cbdiag__.screenToSvg(100, 50, mockCanvas);
            expect(result).toEqual({ x: 200, y: 100 });
        });

        it('should handle offset canvas', () => {
            const mockCanvas = {
                getBoundingClientRect: () => ({
                    left: 50,
                    top: 100,
                    width: 800,
                    height: 600
                }),
                viewBox: {
                    baseVal: {
                        x: 0,
                        y: 0,
                        width: 800,
                        height: 600
                    }
                }
            };

            const result = window.__cbdiag__.screenToSvg(150, 200, mockCanvas);
            expect(result).toEqual({ x: 100, y: 100 });
        });
    });

    describe('getBlockCenter', () => {
        it('should calculate center of a block', () => {
            const block = {
                x: 100,
                y: 200,
                width: 120,
                height: 60
            };

            const result = window.__cbdiag__.getBlockCenter(block);
            expect(result).toEqual({ x: 160, y: 230 });
        });

        it('should handle blocks at origin', () => {
            const block = {
                x: 0,
                y: 0,
                width: 100,
                height: 50
            };

            const result = window.__cbdiag__.getBlockCenter(block);
            expect(result).toEqual({ x: 50, y: 25 });
        });
    });

    describe('getAnchorPoint', () => {
        const block = {
            x: 100,
            y: 200,
            width: 120,
            height: 60
        };

        it('should return top anchor point', () => {
            const result = window.__cbdiag__.getAnchorPoint(block, 'top');
            expect(result).toEqual({ x: 160, y: 200 });
        });

        it('should return bottom anchor point', () => {
            const result = window.__cbdiag__.getAnchorPoint(block, 'bottom');
            expect(result).toEqual({ x: 160, y: 260 });
        });

        it('should return left anchor point', () => {
            const result = window.__cbdiag__.getAnchorPoint(block, 'left');
            expect(result).toEqual({ x: 100, y: 230 });
        });

        it('should return right anchor point', () => {
            const result = window.__cbdiag__.getAnchorPoint(block, 'right');
            expect(result).toEqual({ x: 220, y: 230 });
        });

        it('should default to center for unknown side', () => {
            const result = window.__cbdiag__.getAnchorPoint(block, 'unknown');
            expect(result).toEqual({ x: 160, y: 230 });
        });
    });

    describe('getBestSides', () => {
        it('should return right-left for blocks on same horizontal level', () => {
            const blockA = { x: 0, y: 100, width: 100, height: 50 };
            const blockB = { x: 200, y: 100, width: 100, height: 50 };

            const result = window.__cbdiag__.getBestSides(blockA, blockB);
            expect(result).toEqual({ sideA: 'right', sideB: 'left' });
        });

        it('should return left-right for blocks reversed horizontally', () => {
            const blockA = { x: 200, y: 100, width: 100, height: 50 };
            const blockB = { x: 0, y: 100, width: 100, height: 50 };

            const result = window.__cbdiag__.getBestSides(blockA, blockB);
            expect(result).toEqual({ sideA: 'left', sideB: 'right' });
        });

        it('should return bottom-top for blocks on same vertical level', () => {
            const blockA = { x: 100, y: 0, width: 100, height: 50 };
            const blockB = { x: 100, y: 200, width: 100, height: 50 };

            const result = window.__cbdiag__.getBestSides(blockA, blockB);
            expect(result).toEqual({ sideA: 'bottom', sideB: 'top' });
        });

        it('should return top-bottom for blocks reversed vertically', () => {
            const blockA = { x: 100, y: 200, width: 100, height: 50 };
            const blockB = { x: 100, y: 0, width: 100, height: 50 };

            const result = window.__cbdiag__.getBestSides(blockA, blockB);
            expect(result).toEqual({ sideA: 'top', sideB: 'bottom' });
        });

        it('should prefer horizontal connection when blocks are diagonal', () => {
            const blockA = { x: 0, y: 0, width: 100, height: 50 };
            const blockB = { x: 300, y: 100, width: 100, height: 50 };

            const result = window.__cbdiag__.getBestSides(blockA, blockB);
            // Should prefer horizontal since dx (300) > dy (100)
            expect(result).toEqual({ sideA: 'right', sideB: 'left' });
        });

        it('should prefer vertical connection when dy is greater', () => {
            const blockA = { x: 0, y: 0, width: 100, height: 50 };
            const blockB = { x: 50, y: 300, width: 100, height: 50 };

            const result = window.__cbdiag__.getBestSides(blockA, blockB);
            // Should prefer vertical since dy (300) > dx (50)
            expect(result).toEqual({ sideA: 'bottom', sideB: 'top' });
        });
    });
});
