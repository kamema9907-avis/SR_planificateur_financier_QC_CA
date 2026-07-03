import { defineConfig } from 'vitest/config';

// Configuration de test séparée de vite.config.ts : le moteur fiscal est du TypeScript
// pur (aucun JSX), donc aucun plugin n'est requis ici — ce qui évite le conflit de types
// lié à la copie de Vite embarquée par Vitest.
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
  },
});
