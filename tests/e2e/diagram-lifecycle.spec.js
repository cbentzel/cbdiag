import { test, expect } from '@playwright/test';

test.describe('Diagram Lifecycle and Persistence', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        // Clear localStorage to start fresh
        await page.evaluate(() => localStorage.clear());
        await page.reload();
    });

    test('should create new diagram via button', async ({ page }) => {
        // Get initial diagram count
        const initialCount = await page.locator('.diagram-item').count();

        // Click new diagram button
        await page.click('#new-diagram-btn');

        // Verify new diagram was added
        const newCount = await page.locator('.diagram-item').count();
        expect(newCount).toBe(initialCount + 1);
    });

    test('should rename diagram', async ({ page }) => {
        // Get the diagram name input
        const nameInput = page.locator('#diagram-name');

        // Change the name
        await nameInput.fill('My Test Diagram');

        // Wait a bit for auto-save
        await page.waitForTimeout(1500);

        // Verify save status
        const saveStatus = page.locator('#save-status');
        await expect(saveStatus).toHaveText('Saved');

        // Verify sidebar shows new name
        const diagramItem = page.locator('.diagram-item').first();
        await expect(diagramItem).toContainText('My Test Diagram');
    });

    test('should persist data after page reload', async ({ page }) => {
        // Create a block
        await page.click('#add-block-btn');

        // Change block label
        await page.fill('#block-label', 'Persistent Block');

        // Change diagram name
        await page.fill('#diagram-name', 'Persistent Diagram');

        // Wait for auto-save
        await page.waitForTimeout(1500);

        // Reload the page
        await page.reload();

        // Verify diagram name persisted
        const nameInput = page.locator('#diagram-name');
        await expect(nameInput).toHaveValue('Persistent Diagram');

        // Verify block persisted
        const blockText = page.locator('.block text').first();
        await expect(blockText).toHaveText('Persistent Block');
    });

    test('should switch between diagrams', async ({ page }) => {
        // Create a block in first diagram
        await page.click('#add-block-btn');
        await page.fill('#block-label', 'Diagram 1 Block');

        // Wait for auto-save
        await page.waitForTimeout(1500);

        // Create second diagram
        await page.click('#new-diagram-btn');

        // Verify canvas is empty in new diagram
        let blockCount = await page.locator('.block').count();
        expect(blockCount).toBe(0);

        // Create block in second diagram
        await page.click('#add-block-btn');
        await page.fill('#block-label', 'Diagram 2 Block');

        // Switch back to first diagram
        const firstDiagram = page.locator('.diagram-item').first();
        await firstDiagram.click();

        // Verify we see the first diagram's block
        const blockText = page.locator('.block text').first();
        await expect(blockText).toHaveText('Diagram 1 Block');
    });

    test('should delete diagram', async ({ page }) => {
        // Create second diagram (need at least 2 to delete one)
        await page.click('#new-diagram-btn');

        // Get initial count
        const initialCount = await page.locator('.diagram-item').count();
        expect(initialCount).toBeGreaterThanOrEqual(2);

        // Click on first diagram to select it
        const firstDiagram = page.locator('.diagram-item').first();
        await firstDiagram.click();

        // Right-click to open context menu (if implemented) or use delete button
        // For now, let's hover and click delete icon if visible
        await firstDiagram.hover();

        // Try to find and click delete button on diagram item
        const deleteBtn = firstDiagram.locator('.delete-diagram-btn');
        if (await deleteBtn.isVisible()) {
            // Handle confirmation dialog
            page.on('dialog', dialog => dialog.accept());
            await deleteBtn.click();

            // Verify diagram was deleted
            const newCount = await page.locator('.diagram-item').count();
            expect(newCount).toBe(initialCount - 1);
        }
    });

    test('should auto-save changes', async ({ page }) => {
        // Verify initial save status
        const saveStatus = page.locator('#save-status');
        await expect(saveStatus).toHaveText('Saved');

        // Make a change
        await page.click('#add-block-btn');

        // Should show "Saving..."
        await expect(saveStatus).toHaveText('Saving...');

        // Wait for auto-save to complete
        await page.waitForTimeout(1500);

        // Should show "Saved"
        await expect(saveStatus).toHaveText('Saved');
    });

    test('should create diagram with multiple blocks and persist', async ({ page }) => {
        // Create multiple blocks
        await page.click('#add-block-btn');
        await page.fill('#block-label', 'Block 1');

        await page.click('#add-block-btn');
        await page.fill('#block-label', 'Block 2');

        await page.click('#add-block-btn');
        await page.fill('#block-label', 'Block 3');

        // Verify all blocks exist
        let blockCount = await page.locator('.block').count();
        expect(blockCount).toBe(3);

        // Wait for auto-save
        await page.waitForTimeout(1500);

        // Reload and verify everything persisted
        await page.reload();

        // Verify blocks persisted
        const blockCountAfter = await page.locator('.block').count();
        expect(blockCountAfter).toBe(3);

        // Verify all block labels persisted
        await expect(page.locator('text=Block 1')).toBeVisible();
        await expect(page.locator('text=Block 2')).toBeVisible();
        await expect(page.locator('text=Block 3')).toBeVisible();
    });
});
