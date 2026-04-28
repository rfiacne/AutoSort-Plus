/**
 * Gemini multi-key management and usage display for the options page.
 */

import { i18n } from '../shared/i18n';

declare const browser: any;

interface GeminiRateLimit {
  requests: number[];
  dailyCount: number;
  dailyResetTime: number;
}

// ── Module State ──────────────────────────────────────────────────

let geminiKeys: string[] = [];

export function getGeminiKeys(): string[] {
  return geminiKeys;
}

export function setGeminiKeys(keys: string[]): void {
  geminiKeys = keys;
}

function updateSingleKeyUsageDisplay(rateLimit: GeminiRateLimit): void {
  const now = Date.now();

  const dailyCountEl = document.getElementById('gemini-daily-count');
  if (dailyCountEl) dailyCountEl.textContent = String(rateLimit.dailyCount);

  const lastRequestEl = document.getElementById('gemini-last-request');
  if (lastRequestEl) {
    if (rateLimit.requests && rateLimit.requests.length > 0) {
      const lastRequest = Math.max(...rateLimit.requests);
      const minutesAgo = Math.floor((now - lastRequest) / 60000);
      if (minutesAgo < 1) {
        lastRequestEl.textContent = i18n.get('geminiNever');
        lastRequestEl.dataset.i18nFallback = 'just_now';
      } else if (minutesAgo < 60) {
        lastRequestEl.textContent = `${minutesAgo} minute${minutesAgo > 1 ? 's' : ''} ago`;
      } else {
        const hoursAgo = Math.floor(minutesAgo / 60);
        lastRequestEl.textContent = `${hoursAgo} hour${hoursAgo > 1 ? 's' : ''} ago`;
      }
    } else {
      lastRequestEl.textContent = i18n.get('geminiNever');
    }
  }

  const resetTimeEl = document.getElementById('gemini-reset-time');
  if (resetTimeEl) {
    if (rateLimit.dailyResetTime > now) {
      const hoursUntil = Math.ceil(
        (rateLimit.dailyResetTime - now) / (1000 * 60 * 60)
      );
      resetTimeEl.textContent = `In ${hoursUntil} hour${hoursUntil > 1 ? 's' : ''}`;
    } else {
      resetTimeEl.textContent = i18n.get(
        'geminiResetExpired',
        'Expired (will reset on next request)'
      );
    }
  }

  const usageMessage = document.getElementById('usage-message');
  const statusSpan = document.getElementById('gemini-status');

  if (rateLimit.dailyCount >= 20) {
    if (statusSpan) {
      statusSpan.textContent =
        '🔴 ' +
        i18n.get('geminiStatusLimitReached', 'Limit Reached');
      statusSpan.style.color = '#dc3545';
    }
    if (usageMessage) {
      usageMessage.className = 'usage-message warning';
      usageMessage.textContent =
        '⚠️ ' +
        i18n.get(
          'geminiLimitMessage',
          'Daily limit reached! Create a new API key in a different project and update it above to continue processing emails.'
        );
    }
  } else if (rateLimit.dailyCount >= 15) {
    if (statusSpan) {
      statusSpan.textContent =
        '🟡 ' +
        i18n.get('geminiStatusNearlyFull', 'Nearly Full');
      statusSpan.style.color = '#ffc107';
    }
    if (usageMessage) {
      usageMessage.className = 'usage-message warning';
      usageMessage.textContent =
        `⚠️ ${i18n.get('geminiRemainingMessage', 'Only')} ${20 - rateLimit.dailyCount} ${i18n.get('requestsRemainingToday', 'requests remaining today. Consider switching to a new API key soon.')}`;
    }
  } else {
    if (statusSpan) {
      statusSpan.textContent =
        '🟢 ' + i18n.get('geminiStatusReady', 'Ready');
      statusSpan.style.color = '#28a745';
    }
    if (usageMessage) {
      usageMessage.style.display = 'none';
    }
  }
}

function updateMultiKeyUsageDisplay(
  keys: string[],
  rateLimits: GeminiRateLimit[],
  currentIndex: number
): void {
  const container = document.getElementById('all-keys-usage-stats');
  if (!container) return;
  const now = Date.now();
  container.innerHTML = '';

  keys.forEach((key, index) => {
    const rateLimit = rateLimits[index] || {
      requests: [],
      dailyCount: 0,
      dailyResetTime: now,
    };
    const isActive = index === currentIndex;

    const card = document.createElement('div');
    card.className = `key-usage-card${isActive ? ' active' : ''}`;

    let statusBadge = '';
    if (isActive) {
      statusBadge =
        '<span class="key-status active">🔵 ACTIVE</span>';
    } else if (rateLimit.dailyCount >= 20) {
      statusBadge =
        '<span class="key-status limit">🔴 LIMIT</span>';
    } else if (rateLimit.dailyCount >= 15) {
      statusBadge =
        '<span class="key-status warning">🟡 NEAR LIMIT</span>';
    } else {
      statusBadge =
        '<span class="key-status ready">🟢 READY</span>';
    }

    let resetText = '--';
    if (rateLimit.dailyResetTime > now) {
      const hoursUntil = Math.ceil(
        (rateLimit.dailyResetTime - now) / (1000 * 60 * 60)
      );
      resetText = `${hoursUntil}h`;
    }

    let lastRequestText = 'Never';
    if (rateLimit.requests && rateLimit.requests.length > 0) {
      const lastRequest = Math.max(...rateLimit.requests);
      const minutesAgo = Math.floor((now - lastRequest) / 60000);
      if (minutesAgo < 1) {
        lastRequestText = 'Just now';
      } else if (minutesAgo < 60) {
        lastRequestText = `${minutesAgo}m ago`;
      } else {
        lastRequestText = `${Math.floor(minutesAgo / 60)}h ago`;
      }
    }

    const maskedKey = key ? `...${key.slice(-8)}` : 'Not set';

    card.innerHTML = `
      <div class="key-header">
        <span class="key-title">Key ${index + 1}: ${maskedKey}</span>
        ${statusBadge}
      </div>
      <div class="key-stats">
        <div class="stat-item">
          <span class="stat-label">Usage:</span>
          <span class="stat-value">${rateLimit.dailyCount}/20</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Last:</span>
          <span class="stat-value">${lastRequestText}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Resets:</span>
          <span class="stat-value">${resetText}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Available:</span>
          <span class="stat-value">${20 - rateLimit.dailyCount}</span>
        </div>
      </div>
    `;

    container.appendChild(card);
  });
}

export async function updateGeminiUsageDisplay(): Promise<void> {
  const data = await browser.storage.local.get([
    'geminiRateLimits',
    'currentGeminiKeyIndex',
    'geminiApiKeys',
    'geminiRateLimit',
  ]);
  const currentIndex: number = data.currentGeminiKeyIndex || 0;
  const keys: string[] = data.geminiApiKeys || geminiKeys;

  const singleKeyEl = document.getElementById('single-key-usage');
  const multiKeyEl = document.getElementById('multi-key-usage');

  if (keys.length > 1) {
    if (singleKeyEl) singleKeyEl.style.display = 'none';
    if (multiKeyEl) multiKeyEl.style.display = 'block';
    const rateLimits: GeminiRateLimit[] = data.geminiRateLimits || [];
    updateMultiKeyUsageDisplay(keys, rateLimits, currentIndex);
  } else if (keys.length === 1) {
    if (singleKeyEl) singleKeyEl.style.display = 'block';
    if (multiKeyEl) multiKeyEl.style.display = 'none';
    const rateLimits: GeminiRateLimit[] = data.geminiRateLimits || [
      { requests: [], dailyCount: 0, dailyResetTime: Date.now() },
    ];
    updateSingleKeyUsageDisplay(rateLimits[0]);
  } else {
    if (singleKeyEl) singleKeyEl.style.display = 'block';
    if (multiKeyEl) multiKeyEl.style.display = 'none';
    const rateLimit: GeminiRateLimit = data.geminiRateLimit || {
      requests: [],
      dailyCount: 0,
      dailyResetTime: Date.now(),
    };
    updateSingleKeyUsageDisplay(rateLimit);
  }
}

// ── Key Management ────────────────────────────────────────────────

export async function testGeminiKey(
  apiKey: string,
  index: number,
  keyItemElement: HTMLElement
): Promise<void> {
  const statusSpan = keyItemElement.querySelector('.key-test-result') as HTMLElement | null;

  if (!apiKey) {
    if (statusSpan) {
      statusSpan.textContent = '⚠️ Enter key first';
      statusSpan.className = 'key-test-result error';
    }
    return;
  }

  try {
    if (statusSpan) {
      statusSpan.textContent = 'Testing...';
      statusSpan.className = 'key-test-result testing';
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Test' }] }],
          generationConfig: { maxOutputTokens: 10 },
        }),
      }
    );

    if (response.ok) {
      if (statusSpan) {
        statusSpan.textContent = '✓ Valid';
        statusSpan.className = 'key-test-result success';
      }
    } else if (response.status === 429) {
      if (statusSpan) {
        statusSpan.textContent = '⚠️ Limit reached';
        statusSpan.className = 'key-test-result error';
        statusSpan.title =
          'This key has reached its daily rate limit (20/day). Will reset in ~24 hours.';
      }
      console.error(`Key #${index + 1} has reached rate limit (429)`);
    } else if (response.status === 401 || response.status === 403) {
      if (statusSpan) {
        statusSpan.textContent = '✗ Invalid key';
        statusSpan.className = 'key-test-result error';
        statusSpan.title =
          'API key is invalid or expired. Check your key in Google AI Studio.';
      }
      console.error(`Key #${index + 1} test failed: ${response.status}`);
    } else {
      if (statusSpan) {
        statusSpan.textContent = `✗ Failed (${response.status})`;
        statusSpan.className = 'key-test-result error';
      }
      console.error(`Key #${index + 1} test failed:`, response.status);
    }
  } catch (error: unknown) {
    if (statusSpan) {
      statusSpan.textContent = '✗ Error';
      statusSpan.className = 'key-test-result error';
    }
    console.error(`Key #${index + 1} test error:`, error);
  }
}

function refreshGeminiKeysList(
  geminiKeysList: HTMLElement,
  onUpdateSaveState: () => void
): void {
  geminiKeysList.innerHTML = '';
  geminiKeys.forEach((key, index) => {
    addGeminiKeyInput(key, index, geminiKeysList, onUpdateSaveState);
  });
}

function removeGeminiKey(
  index: number,
  geminiKeysList: HTMLElement,
  onUpdateSaveState: () => void
): void {
  if (geminiKeys.length <= 1) {
    alert('You must have at least one API key configured.');
    return;
  }

  if (confirm(`Remove API key #${index + 1}?`)) {
    geminiKeys.splice(index, 1);
    refreshGeminiKeysList(geminiKeysList, onUpdateSaveState);
  }
}

export function addGeminiKeyInput(
  value: string,
  index: number,
  geminiKeysList: HTMLElement,
  onUpdateSaveState: () => void
): void {
  if (index === -1) {
    index = geminiKeys.length;
    geminiKeys.push(value);
  }

  const keyItem = document.createElement('div');
  keyItem.className = 'gemini-key-item';
  keyItem.dataset.index = String(index);

  const keyIndex = document.createElement('span');
  keyIndex.className = 'key-index';
  keyIndex.textContent = `#${index + 1}`;

  const input = document.createElement('input');
  input.type = 'password';
  input.className = 'gemini-api-key-input';
  input.placeholder = i18n.get(
    'geminiKeyInputPlaceholder',
    'Enter Gemini API key from another project'
  );
  input.value = value;
  input.dataset.index = String(index);
  input.addEventListener('input', (e) => {
    const target = e.target as HTMLInputElement;
    const newKey = target.value.trim();
    geminiKeys[index] = newKey;

    if (newKey) {
      const isDuplicate = geminiKeys.some(
        (key, i) => i !== index && key.trim() === newKey
      );
      if (isDuplicate) {
        input.style.borderColor = '#dc3545';
        input.title = '⚠️ This key is already added!';
      } else {
        input.style.borderColor = '';
        input.title = '';
      }
    } else {
      input.style.borderColor = '';
      input.title = '';
    }

    onUpdateSaveState();
  });

  const testButton = document.createElement('button');
  testButton.className = 'button';
  testButton.textContent = i18n.get('testButton', 'Test');
  testButton.addEventListener('click', () => {
    const keyValue = input.value.trim();
    const statusSpan = keyItem.querySelector('.key-test-result') as HTMLElement | null;

    if (!keyValue) {
      if (statusSpan) {
        statusSpan.textContent = '⚠️ Enter key first';
        statusSpan.className = 'key-test-result error';
      }
      return;
    }

    const isDuplicate = geminiKeys.some(
      (key, i) => i !== index && key.trim() === keyValue
    );
    if (isDuplicate) {
      if (statusSpan) {
        statusSpan.textContent = '⚠️ Duplicate key';
        statusSpan.className = 'key-test-result error';
        statusSpan.title = 'This key is already added in the list';
      }
      return;
    }

    testGeminiKey(keyValue, index, keyItem);
  });

  const removeButton = document.createElement('button');
  removeButton.className = 'button';
  removeButton.textContent = '×';
  removeButton.addEventListener('click', () =>
    removeGeminiKey(index, geminiKeysList, onUpdateSaveState)
  );

  const statusSpan = document.createElement('span');
  statusSpan.className = 'key-test-result';
  statusSpan.dataset.index = String(index);

  keyItem.appendChild(keyIndex);
  keyItem.appendChild(input);
  keyItem.appendChild(testButton);
  keyItem.appendChild(removeButton);
  keyItem.appendChild(statusSpan);
  geminiKeysList.appendChild(keyItem);
}

/**
 * Initialize Gemini keys display from saved settings.
 */
export async function initGeminiKeysFromStorage(
  geminiKeysList: HTMLElement,
  apiKeyInput: HTMLInputElement,
  onUpdateSaveState: () => void
): Promise<void> {
  const data = await browser.storage.local.get(['geminiApiKeys', 'apiKey']);

  if (data.geminiApiKeys && data.geminiApiKeys.length > 0) {
    geminiKeys = data.geminiApiKeys;
    geminiKeys.forEach((key: string, idx: number) => {
      addGeminiKeyInput(key, idx, geminiKeysList, onUpdateSaveState);
    });
  } else if (data.apiKey) {
    // Migrate from single key to multi-key
    geminiKeys = [data.apiKey];
    addGeminiKeyInput(data.apiKey, 0, geminiKeysList, onUpdateSaveState);
    apiKeyInput.value = data.apiKey;
  } else {
    // No keys configured yet - add one empty field
    addGeminiKeyInput('', 0, geminiKeysList, onUpdateSaveState);
  }
}
