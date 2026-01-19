import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'happy-dom',
        setupFiles: ['./tests/setup.js'],
        exclude: ['tests/e2e/**', 'node_modules/**'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html', 'json-summary'],
            include: ['js/**/*.js'],
            exclude: ['tests/**', 'node_modules/**'],
            thresholds: {
                lines: 70,
                functions: 70,
                branches: 65,
                statements: 70
            }
        },
        testTimeout: 10000
    }
});
