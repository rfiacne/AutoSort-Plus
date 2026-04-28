import { els } from './dom-refs';

export function showMessage(message: string, isSuccess = true): void {
  const messageDiv = document.createElement('div');
  messageDiv.className = 'message';
  messageDiv.textContent = message;
  messageDiv.style.backgroundColor = isSuccess
    ? 'var(--success-color)'
    : 'var(--error-color)';
  document.body.appendChild(messageDiv);

  setTimeout(() => {
    messageDiv.remove();
  }, 3000);
}

export function showApiTestResult(
  message: string,
  isSuccess: boolean,
  isInfo?: boolean
): void {
  els.apiTestResult.textContent = message;
  if (isInfo) {
    els.apiTestResult.className = 'api-test-result info';
  } else {
    els.apiTestResult.className = `api-test-result ${isSuccess ? 'success' : 'error'}`;
  }
}

export function formatTimestamp(timestamp: unknown): string {
  if (!timestamp) return 'Unknown';
  const date = new Date(timestamp as number);
  return isNaN(date.getTime()) ? 'Unknown' : date.toLocaleString();
}
