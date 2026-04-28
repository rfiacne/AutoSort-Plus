declare const browser: { i18n: { getMessage(messageName: string, substitutions?: string | string[]): string } };

export const i18n = {
  get(key: string, substitutions?: string | string[]): string {
    try {
      const msg = browser.i18n.getMessage(key, substitutions);
      return msg || key;
    } catch {
      return key;
    }
  },
};

export function applyTranslations(): void {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (key) el.textContent = i18n.get(key);
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (key) (el as HTMLInputElement).placeholder = i18n.get(key);
  });

  document.querySelectorAll('[data-i18n-title]').forEach((el) => {
    const key = el.getAttribute('data-i18n-title');
    if (key) el.setAttribute('title', i18n.get(key));
  });
}

// Global singleton for backward compatibility with existing JS
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).applyTranslations = applyTranslations;
}
