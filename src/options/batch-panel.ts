/**
 * Batch progress panel for the options page.
 * Displays real-time batch processing status and provides pause/resume/cancel controls.
 */

declare const browser: any;

interface BatchProgressPayload {
  status?: string;
  total?: number;
  completed?: number;
  failed?: number;
  skipped?: number;
  provider?: string;
  chunkIndex?: number;
  totalChunks?: number;
}

let batchHideTimer: ReturnType<typeof setTimeout> | null = null;

function getPanelElements() {
  return {
    panel: document.getElementById('batch-status-panel'),
    fill: document.getElementById('batch-progress-fill'),
    text: document.getElementById('batch-progress-text'),
    badge: document.getElementById('batch-provider-badge'),
    pauseBtn: document.getElementById('batch-pause-btn'),
    resumeBtn: document.getElementById('batch-resume-btn'),
    cancelBtn: document.getElementById('batch-cancel-btn') as HTMLButtonElement | null,
  };
}

/**
 * Update the batch panel UI from a progress payload.
 */
export function applyBatchProgress(payload: BatchProgressPayload): void {
  const els = getPanelElements();
  if (!els.panel || !payload) return;

  const {
    status = 'running',
    total = 0,
    completed = 0,
    failed = 0,
    skipped = 0,
    provider = '',
    chunkIndex = 0,
    totalChunks = 0,
  } = payload;

  const done = (completed || 0) + (failed || 0) + (skipped || 0);
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  els.panel.style.display = 'block';
  els.panel.dataset.status = status;

  if (els.badge && provider) {
    els.badge.textContent = provider;
  }

  if (els.fill) {
    els.fill.style.width = pct + '%';
  }

  const displayChunk = chunkIndex || 0;
  const displayTotal = totalChunks || 0;

  if (els.text) {
    if (status === 'paused') {
      if (displayTotal > 0) {
        els.text.textContent = `⏸ Paused — chunk ${displayChunk}/${displayTotal} (${done}/${total})`;
      } else {
        els.text.textContent = `⏸ Paused (${done}/${total})`;
      }
    } else if (status === 'done') {
      els.text.textContent = `✅ Done — sorted: ${completed}, skipped: ${skipped}, failed: ${failed}`;
    } else if (status === 'cancelled') {
      if (displayTotal > 0) {
        els.text.textContent = `⏹ Cancelled after chunk ${displayChunk}/${displayTotal}`;
      } else {
        els.text.textContent = `⏹ Cancelled (${done}/${total})`;
      }
    } else {
      if (displayTotal > 0) {
        els.text.textContent = `Chunk ${displayChunk}/${displayTotal} — ${done}/${total} (sorted: ${completed}, failed: ${failed})`;
      } else {
        els.text.textContent = `${done}/${total} (sorted: ${completed}, failed: ${failed})`;
      }
    }
  }

  // Pause/Resume button visibility
  if (els.pauseBtn && els.resumeBtn) {
    if (status === 'paused') {
      els.pauseBtn.style.display = 'none';
      els.resumeBtn.style.display = '';
    } else {
      els.pauseBtn.style.display = '';
      els.resumeBtn.style.display = 'none';
    }
  }

  // Cancel button visibility
  if (els.cancelBtn) {
    els.cancelBtn.style.display =
      status === 'done' || status === 'cancelled' ? 'none' : '';
  }

  // Auto-hide after completion
  if (status === 'done' || status === 'cancelled') {
    if (batchHideTimer) clearTimeout(batchHideTimer);
    batchHideTimer = setTimeout(() => {
      if (els.panel) els.panel.style.display = 'none';
    }, 5000);
  }
}

/**
 * Initialize batch panel: restore any running batch state and wire up controls.
 */
export function initBatchPanel(): void {
  const els = getPanelElements();

  // Restore running batch state
  browser.storage.local.get('currentBatch').then(
    (result: { currentBatch?: BatchProgressPayload }) => {
      if (result.currentBatch && result.currentBatch.status === 'running') {
        applyBatchProgress(result.currentBatch);
      }
    }
  );

  // Listen for progress messages from background
  browser.runtime.onMessage.addListener(
    (msg: { action: string } & BatchProgressPayload) => {
      if (msg.action === 'batchProgress') {
        applyBatchProgress(msg);
      }
    }
  );

  // Pause button
  if (els.pauseBtn) {
    els.pauseBtn.addEventListener('click', () => {
      browser.runtime
        .sendMessage({ action: 'batchControl', command: 'pause' })
        .catch(() => {});
      if (els.panel) els.panel.dataset.status = 'paused';
      if (els.text)
        els.text.textContent =
          '⏸ Pausing… current request will finish first.';
      if (els.pauseBtn) els.pauseBtn.style.display = 'none';
      if (els.resumeBtn) els.resumeBtn.style.display = '';
    });
  }

  // Resume button
  if (els.resumeBtn) {
    els.resumeBtn.addEventListener('click', () => {
      browser.runtime
        .sendMessage({ action: 'batchControl', command: 'resume' })
        .catch(() => {});
      if (els.panel) els.panel.dataset.status = 'running';
      if (els.pauseBtn) els.pauseBtn.style.display = '';
      if (els.resumeBtn) els.resumeBtn.style.display = 'none';
    });
  }

  // Cancel button
  if (els.cancelBtn) {
    els.cancelBtn.addEventListener('click', () => {
      if (
        !confirm(
          'Cancel the current batch? Already-sorted emails will not be undone.'
        )
      )
        return;
      browser.runtime
        .sendMessage({ action: 'batchControl', command: 'cancel' })
        .catch(() => {});
      if (els.text)
        els.text.textContent =
          '⏹ Cancelling… current request will finish first.';
      if (els.cancelBtn) els.cancelBtn.disabled = true;
    });
  }
}
