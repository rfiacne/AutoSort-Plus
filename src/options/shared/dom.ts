export function getElement<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Element #${id} not found`);
  return el as T;
}

export function getElementOrNull<T extends HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

export function safeQuerySelector<T extends HTMLElement>(selector: string): T | null {
  return document.querySelector(selector) as T | null;
}
