import { test, expect } from '@playwright/test';

test.describe('Z-Ordering', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        // Clear localStorage to start fresh
        await page.evaluate(() => localStorage.clear());
        await page.reload();
    });

    test('should show z-order controls in properties panel', async ({ page }) => {
        // Create a block
        await page.click('#add-block-btn');

        // Verify z-order controls are visible
        const zIndexInput = page.locator('#block-zindex');
        await expect(zIndexInput).toBeVisible();

        const bringToFrontBtn = page.locator('#bring-to-front');
        await expect(bringToFrontBtn).toBeVisible();

        const sendToBackBtn = page.locator('#send-to-back');
        await expect(sendToBackBtn).toBeVisible();
    });

    test('should change z-order via number input', async ({ page }) => {
        // Create a block
        await page.click('#add-block-btn');

        // Get initial z-index
        const zIndexInput = page.locator('#block-zindex');
        const initialZIndex = await zIndexInput.inputValue();

        // Change z-index
        await zIndexInput.fill('10');

        // Verify it updated
        const newZIndex = await zIndexInput.inputValue();
        expect(newZIndex).toBe('10');
        expect(newZIndex).not.toBe(initialZIndex);
    });

    test('should bring block to front', async ({ page }) => {
        // Create first block and note its ID
        await page.click('#add-block-btn');
        const block1ZIndex = await page.locator('#block-zindex').inputValue();
        await page.fill('#block-label', 'First Block');

        // Create second block
        await page.click('#add-block-btn');
        const block2ZIndex = await page.locator('#block-zindex').inputValue();

        // Second block should have higher z-index by default
        expect(parseInt(block2ZIndex)).toBeGreaterThan(parseInt(block1ZIndex));

        // Click on first block by its text to select it
        await page.locator('text=First Block').click({ force: true });

        // Click "Bring to Front"
        await page.click('#bring-to-front');

        // Verify z-index increased
        const newBlock1ZIndex = await page.locator('#block-zindex').inputValue();
        expect(parseInt(newBlock1ZIndex)).toBeGreaterThan(parseInt(block2ZIndex));
    });

    test('should send block to back', async ({ page }) => {
        // Create first block
        await page.click('#add-block-btn');

        // Create second block (will be on top by default)
        await page.click('#add-block-btn');
        const block2ZIndex = await page.locator('#block-zindex').inputValue();

        // Click "Send to Back" while second block is selected
        await page.click('#send-to-back');

        // Verify z-index decreased
        const newBlock2ZIndex = await page.locator('#block-zindex').inputValue();
        expect(parseInt(newBlock2ZIndex)).toBeLessThan(parseInt(block2ZIndex));
    });

    test('should maintain z-order after page reload', async ({ page }) => {
        // Create two blocks
        await page.click('#add-block-btn');
        await page.fill('#block-label', 'Bottom Block');

        await page.click('#add-block-btn');
        await page.fill('#block-label', 'Top Block');

        // Get their z-indexes
        const topBlockZIndex = await page.locator('#block-zindex').inputValue();

        // Select first block by clicking its text
        await page.locator('text=Bottom Block').click({ force: true });
        const bottomBlockZIndex = await page.locator('#block-zindex').inputValue();

        // Wait for auto-save
        await page.waitForTimeout(1500);

        // Reload page
        await page.reload();

        // Click on "Bottom Block" and verify z-index
        await page.locator('text=Bottom Block').click({ force: true });
        const reloadedBottomZIndex = await page.locator('#block-zindex').inputValue();
        expect(reloadedBottomZIndex).toBe(bottomBlockZIndex);

        // Click on "Top Block" and verify z-index
        await page.locator('text=Top Block').click({ force: true });
        const reloadedTopZIndex = await page.locator('#block-zindex').inputValue();
        expect(reloadedTopZIndex).toBe(topBlockZIndex);
    });

    test('should allow negative z-index values', async ({ page }) => {
        // Create a block
        await page.click('#add-block-btn');

        // Set negative z-index
        await page.fill('#block-zindex', '-5');

        // Verify it accepts negative values
        const zIndex = await page.locator('#block-zindex').inputValue();
        expect(zIndex).toBe('-5');
    });

    test('should show new blocks on top by default', async ({ page }) => {
        // Create first block
        await page.click('#add-block-btn');
        const block1ZIndex = await page.locator('#block-zindex').inputValue();

        // Create second block
        await page.click('#add-block-btn');
        const block2ZIndex = await page.locator('#block-zindex').inputValue();

        // Create third block
        await page.click('#add-block-btn');
        const block3ZIndex = await page.locator('#block-zindex').inputValue();

        // Each successive block should have higher z-index
        expect(parseInt(block2ZIndex)).toBeGreaterThan(parseInt(block1ZIndex));
        expect(parseInt(block3ZIndex)).toBeGreaterThan(parseInt(block2ZIndex));
    });

    test('should handle multiple bring-to-front operations', async ({ page }) => {
        // Create three blocks with labels
        await page.click('#add-block-btn');
        await page.fill('#block-label', 'Block 1');

        await page.click('#add-block-btn');
        await page.fill('#block-label', 'Block 2');

        await page.click('#add-block-btn');
        await page.fill('#block-label', 'Block 3');

        // Select first block by its text
        await page.locator('text=Block 1').click({ force: true });

        // Bring to front multiple times
        await page.click('#bring-to-front');
        const zIndex1 = await page.locator('#block-zindex').inputValue();

        await page.click('#bring-to-front');
        const zIndex2 = await page.locator('#block-zindex').inputValue();

        await page.click('#bring-to-front');
        const zIndex3 = await page.locator('#block-zindex').inputValue();

        // Each click should increase z-index
        expect(parseInt(zIndex2)).toBeGreaterThan(parseInt(zIndex1));
        expect(parseInt(zIndex3)).toBeGreaterThan(parseInt(zIndex2));
    });
});
