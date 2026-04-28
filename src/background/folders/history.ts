declare const browser: any;

export interface MoveHistoryEntry {
  timestamp: string;
  subject: string;
  status: string;
  destination: string;
  error?: string;
}

const MAX_HISTORY = 100;

export async function storeMoveHistory(result: Omit<MoveHistoryEntry, 'timestamp'>): Promise<void> {
  try {
    const data = (await browser.storage.local.get('moveHistory')) as {
      moveHistory?: MoveHistoryEntry[];
    };
    const history: MoveHistoryEntry[] = data.moveHistory || [];
    history.unshift({
      timestamp: new Date().toISOString(),
      ...result,
    });
    if (history.length > MAX_HISTORY) {
      history.length = MAX_HISTORY;
    }
    await browser.storage.local.set({ moveHistory: history });
  } catch (error) {
    console.error('Error storing move history:', error);
  }
}

export async function getMoveHistory(): Promise<MoveHistoryEntry[]> {
  const data = (await browser.storage.local.get('moveHistory')) as {
    moveHistory?: MoveHistoryEntry[];
  };
  return data.moveHistory || [];
}

export async function clearMoveHistory(): Promise<void> {
  await browser.storage.local.set({ moveHistory: [] });
}
