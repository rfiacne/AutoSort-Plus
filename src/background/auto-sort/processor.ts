declare const browser: any;

import { extractEmailContext } from '../email/extractor';

export async function processWithConcurrency<T>(
  items: T[],
  processor: (item: T) => Promise<unknown>,
  limit: number = 3
): Promise<PromiseSettledResult<unknown>[]> {
  const results: Promise<unknown>[] = [];
  const executing = new Set<Promise<unknown>>();

  for (const item of items) {
    const promise = processor(item).then((result) => {
      executing.delete(promise);
      return result;
    });
    executing.add(promise);
    results.push(promise);

    if (executing.size >= limit) {
      await Promise.race(executing);
    }
  }

  return Promise.allSettled(results);
}

export async function classifyAndMove(
  message: any,
  analyzeFn: (content: string, context: any) => Promise<string | null>,
  applyLabelsFn: (msgs: any[], label: string) => Promise<unknown>,
  debugLogger?: any
): Promise<void> {
  try {
    const fullMessage = await browser.messages.getFull(message.id);
    if (!fullMessage) return;

    const emailContext = await extractEmailContext(fullMessage, message);
    if (!emailContext) return;

    const emailContent = emailContext.body;
    if (!emailContent?.trim()) return;

    const label = await analyzeFn(emailContent, emailContext);
    if (!label || String(label).trim().toLowerCase() === 'null') return;

    await applyLabelsFn([message], label);

    if (debugLogger) {
      debugLogger.info('[AutoSort]', `Auto-sorted message ${message.id} to ${label}`);
    }
  } catch (err: any) {
    if (debugLogger) {
      debugLogger.warn('[AutoSort]', `Failed to auto-sort message ${message.id}: ${err.message}`);
    }
  }
}

export async function handleNewMail(
  folder: any,
  messageList: any,
  provider: string,
  concurrencyLimit: number,
  analyzeFn: (content: string, context: any) => Promise<string | null>,
  applyLabelsFn: (msgs: any[], label: string) => Promise<unknown>,
  settings: { autoSortEnabled?: boolean; enableAi?: boolean },
  debugLogger?: any
): Promise<void> {
  if (!settings.autoSortEnabled) return;
  if (settings.enableAi === false) return;
  if (!folder.specialUse?.includes('inbox')) return;

  if (debugLogger) {
    debugLogger.info('[AutoSort]', `Processing new mail with concurrency=${concurrencyLimit} for provider=${provider}`);
  }

  let page = messageList;
  while (true) {
    await processWithConcurrency(
      page.messages,
      (msg) => classifyAndMove(msg, analyzeFn, applyLabelsFn, debugLogger),
      concurrencyLimit
    );
    if (!page.id) break;
    page = await browser.messages.continueList(page.id);
  }
}
