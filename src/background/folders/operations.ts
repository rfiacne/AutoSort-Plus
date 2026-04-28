declare const browser: any;

import { storeMoveHistory } from './history';
import type { MoveHistoryEntry } from './history';

export interface MoveResult {
  subject: string;
  status: string;
  destination: string;
  error?: string;
}

interface FolderCache {
  get(key: string): any;
  set(key: string, value: any): void;
  readonly size: number;
}

interface MoveOptions {
  label: string;
  notificationId?: string;
  debugLogger?: any;
}

export async function applyLabelsToMessages(
  messages: any[],
  label: string
): Promise<MoveResult[]> {
  const messageCount = messages.length;
  const moveResults: MoveResult[] = [];
  let successCount = 0;
  let errorCount = 0;

  const folderCache = new Map<string, any>();
  const accountCache = new Map<string, any>();

  async function getAccount(accountId: string): Promise<any> {
    if (!accountCache.has(accountId)) {
      const account = await browser.accounts.get(accountId);
      accountCache.set(accountId, account);
    }
    return accountCache.get(accountId);
  }

  function buildFolderMap(folders: any[], prefix: string, accountId: string): void {
    if (!folders) return;
    for (const folder of folders) {
      const fullName = prefix ? `${prefix}/${folder.name}` : folder.name;
      folderCache.set(`${accountId}:${fullName}`, folder);
      if (folder.subFolders) {
        buildFolderMap(folder.subFolders, fullName, accountId);
      }
    }
  }

  // Pre-build folder cache
  const uniqueAccountIds = [...new Set(
    messages.map((m: any) => m.folder?.accountId).filter((id: any) => id)
  )];
  for (const accountId of uniqueAccountIds) {
    const account = await getAccount(accountId as string);
    buildFolderMap(account.folders, '', accountId as string);
  }

  for (const message of messages) {
    const account = await getAccount(message.folder.accountId);

    // Cached folder lookup
    let targetFolder = folderCache.get(`${message.folder.accountId}:${label}`);

    // Handle subfolder paths
    if (!targetFolder && label.includes('/')) {
      targetFolder = folderCache.get(`${message.folder.accountId}:${label}`);
    }

    // Auto-create missing folder
    if (!targetFolder) {
      const looksImported = label.includes('/') || label.includes('\\');
      if (!looksImported) {
        try {
          const parentFolder = account.folders?.[0] || null;
          if (parentFolder && browser.folders?.create) {
            const created = await browser.folders.create(parentFolder, label);
            if (created) {
              targetFolder = created;
              folderCache.set(`${message.folder.accountId}:${label}`, created);
            }
          }
        } catch (createError) {
          console.error(`Failed to create folder "${label}":`, createError);
        }
      }
    }

    try {
      if (!targetFolder) {
        errorCount++;
        console.error(
          `Folder "${label}" not found in account "${message.folder.accountId}". ` +
          `Please create this folder in Thunderbird, or check your label settings. (msg ${message.id})`
        );
        const result: MoveResult = {
          subject: message.subject || '(No subject)',
          status: 'Error',
          destination: `Not found: ${label}`,
        };
        moveResults.push(result);
        await storeMoveHistory(result);
        continue;
      }

      await browser.messages.move([message.id], targetFolder.id);
      successCount++;
      const result: MoveResult = {
        subject: message.subject || '(No subject)',
        status: 'Success',
        destination: targetFolder.name,
      };
      moveResults.push(result);
      await storeMoveHistory(result);
    } catch (moveError: any) {
      errorCount++;
      const result: MoveResult = {
        subject: message.subject || '(No subject)',
        status: 'Error',
        destination: label,
        error: moveError.message,
      };
      moveResults.push(result);
      await storeMoveHistory(result);
    }
  }

  return moveResults;
}
