declare const browser: any;
declare const messenger: any;

import { handleNewMail } from './processor';

let registered = false;

export function registerAutoSortListener(
  analyzeFn: (content: string, context: any) => Promise<string | null>,
  applyLabelsFn: (msgs: any[], label: string) => Promise<unknown>,
  getSettingsFn: () => Promise<{ autoSortEnabled?: boolean; enableAi?: boolean; aiProvider?: string }>,
  getConcurrencyFn: (provider: string) => number,
  debugLogger?: any
): void {
  if (registered) return;
  registered = true;

  browser.messages.onNewMailReceived.addListener(
    async (folder: any, messageList: any) => {
      const settings = await getSettingsFn();
      const provider = settings.aiProvider || 'gemini';
      const limit = getConcurrencyFn(provider);

      await handleNewMail(
        folder, messageList, provider, limit,
        analyzeFn, applyLabelsFn, settings, debugLogger
      );
    },
    false
  );
}

export function isAutoSortRegistered(): boolean {
  return registered;
}
