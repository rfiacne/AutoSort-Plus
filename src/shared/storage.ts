declare const browser: { storage: { local: { get(keys: string | string[] | null): Promise<Record<string, unknown>>; set(items: Record<string, unknown>): Promise<void>; remove(keys: string | string[]): Promise<void>; clear(): Promise<void> } } };

export async function getStorage<T>(keys: string | string[] | null): Promise<T> {
  return browser.storage.local.get(keys) as Promise<T>;
}

export async function setStorage(items: Record<string, unknown>): Promise<void> {
  return browser.storage.local.set(items);
}

export async function removeStorage(keys: string | string[]): Promise<void> {
  return browser.storage.local.remove(keys);
}

export async function clearStorage(): Promise<void> {
  return browser.storage.local.clear();
}
