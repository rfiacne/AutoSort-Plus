import { vi } from "vitest";

const mockStorage: Record<string, any> = {};

const mockBrowser = {
  storage: {
    local: {
      get: vi.fn((keys: string | string[] | null) => {
        if (keys === null) return Promise.resolve({ ...mockStorage });
        const keyList = Array.isArray(keys) ? keys : [keys];
        const result: Record<string, any> = {};
        for (const k of keyList) {
          if (k in mockStorage) result[k] = mockStorage[k];
        }
        return Promise.resolve(result);
      }),
      set: vi.fn((items: Record<string, any>) => {
        Object.assign(mockStorage, items);
        return Promise.resolve();
      }),
      remove: vi.fn((keys: string | string[]) => {
        const keyList = Array.isArray(keys) ? keys : [keys];
        for (const k of keyList) delete mockStorage[k];
        return Promise.resolve();
      }),
      clear: vi.fn(() => {
        Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
        return Promise.resolve();
      }),
    },
  },
  runtime: {
    getURL: vi.fn((path: string) => `moz-extension://test-id/${path}`),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
    sendMessage: vi.fn(() => Promise.resolve()),
    onInstalled: {
      addListener: vi.fn(),
    },
  },
  tabs: {
    create: vi.fn(() => Promise.resolve({ id: 1 })),
    remove: vi.fn(() => Promise.resolve()),
    executeScript: vi.fn(() => Promise.resolve([{ result: null }])),
  },
  notifications: {
    create: vi.fn(() => Promise.resolve("notif-1")),
    update: vi.fn(() => Promise.resolve(true)),
  },
  menus: {
    create: vi.fn(),
    removeAll: vi.fn(() => Promise.resolve()),
    onClicked: {
      addListener: vi.fn(),
    },
  },
  windows: {
    create: vi.fn(() => Promise.resolve({ id: 1 })),
  },
  accounts: {
    list: vi.fn(() => Promise.resolve([])),
  },
  messages: {
    list: vi.fn(() => Promise.resolve({ messages: [] })),
    getFull: vi.fn(() => Promise.resolve(null)),
    move: vi.fn(() => Promise.resolve()),
    query: vi.fn(() => Promise.resolve({ messages: [] })),
  },
  folders: {
    query: vi.fn(() => Promise.resolve([])),
    create: vi.fn(() => Promise.resolve({})),
  },
  mailTabs: {
    getCurrent: vi.fn(() => Promise.resolve({})),
  },
  i18n: {
    getMessage: vi.fn((key: string) => key),
  },
};

// Thunderbird uses both `browser` and `messenger` namespaces
(globalThis as any).browser = mockBrowser;
(globalThis as any).messenger = mockBrowser;
(globalThis as any).window = globalThis;

export function resetStorage(): void {
  Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
}

export function seedStorage(data: Record<string, any>): void {
  Object.assign(mockStorage, data);
}

export { mockBrowser };
