import '@testing-library/jest-dom/vitest';

// jsdom has no `chrome` global — mock the subset of chrome.storage.local the
// app touches (src/utils/storage.ts) so components can render in tests.
const memoryStore: Record<string, unknown> = {};

globalThis.chrome = {
  storage: {
    local: {
      get: async (key: string) => ({ [key]: memoryStore[key] }),
      set: async (items: Record<string, unknown>) => {
        Object.assign(memoryStore, items);
      },
      remove: async (keys: string[]) => {
        for (const key of keys) delete memoryStore[key];
      },
    },
  },
} as unknown as typeof chrome;
