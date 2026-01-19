import { test, expect } from '@playwright/test';

test.describe('Block Editing', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        // Clear localStorage to start fresh
        await page.evaluate(() => localStorage.clear());
        await page.reload();
    });

    test('should create block via toolbar button', async ({ page }) => {
        // Click the add block button
        await page.click('#add-block-btn');

        // Verify block appears on canvas
        const block = page.locator('.block').first();
        await expect(block).toBeVisible();

        // Verify properties panel shows
        const propertiesPanel = page.locator('#properties-panel');
        await expect(propertiesPanel).not.toHaveClass(/hidden/);
    });

    test('should edit block label', async ({ page }) => {
        // Create a block
        await page.click('#add-block-btn');

        // Change label
        await page.fill('#block-label', 'Test Block');

        // Verify label updates in SVG
        const blockText = page.locator('.block text').first();
        await expect(blockText).toHaveText('Test Block');
    });

    test('should change block color', async ({ page }) => {
        // Create a block
        await page.click('#add-block-btn');

        // Change color
        await page.fill('#block-color', '#ff0000');

        // Verify color updates
        const blockRect = page.locator('.block rect').first();
        const fill = await blockRect.getAttribute('fill');
        expect(fill).toBe('#ff0000');
    });

    test('should resize block using width/height inputs', async ({ page }) => {
        // Create a block
        await page.click('#add-block-btn');

        // Get initial dimensions
        const blockRect = page.locator('.block rect').first();
        const initialWidth = await blockRect.getAttribute('width');

        // Change width and trigger change event
        const widthInput = page.locator('#block-width');
        await widthInput.fill('200');
        await widthInput.press('Enter'); // Trigger change event

        // Wait a bit for the update
        await page.waitForTimeout(100);

        // Verify width changed
        const newWidth = await blockRect.getAttribute('width');
        expect(newWidth).toBe('200');
        expect(newWidth).not.toBe(initialWidth);
    });

    test('should delete block with delete button', async ({ page }) => {
        // Create a block
        await page.click('#add-block-btn');

        // Verify block exists
        let blockCount = await page.locator('.block').count();
        expect(blockCount).toBe(1);

        // Delete the block
        await page.click('#delete-btn');

        // Verify block is gone
        blockCount = await page.locator('.block').count();
        expect(blockCount).toBe(0);
    });

    test('should delete block with keyboard shortcut', async ({ page }) => {
        // Create a block
        await page.click('#add-block-btn');

        // Verify block exists
        let blockCount = await page.locator('.block').count();
        expect(blockCount).toBe(1);

        // Press Delete key
        await page.keyboard.press('Delete');

        // Verify block is gone
        blockCount = await page.locator('.block').count();
        expect(blockCount).toBe(0);
    });

    test('should create multiple blocks', async ({ page }) => {
        // Create first block
        await page.click('#add-block-btn');

        // Create second block
        await page.click('#add-block-btn');

        // Create third block
        await page.click('#add-block-btn');

        // Verify all three blocks exist
        const blockCount = await page.locator('.block').count();
        expect(blockCount).toBe(3);
    });

    test('should deselect block when clicking canvas', async ({ page }) => {
        // Create a block
        await page.click('#add-block-btn');

        // Verify properties panel is visible
        let propertiesPanel = page.locator('#properties-panel');
        await expect(propertiesPanel).not.toHaveClass(/hidden/);

        // Click on empty canvas area
        await page.locator('#canvas').click({ position: { x: 10, y: 10 } });

        // Verify properties panel is hidden
        await expect(propertiesPanel).toHaveClass(/hidden/);
    });
});
