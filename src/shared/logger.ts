type LogType = 'info' | 'warn' | 'error' | 'log';

interface QueuedLog {
  type: LogType;
  tag: string;
  message: string;
  data: unknown;
}

declare const browser: any;

export class DebugLogger {
  private enabled = false;
  private isReady = false;
  private queue: QueuedLog[] = [];

  constructor() {
    this.listenForChanges();
    this.init().catch(() => {});
  }

  async init(): Promise<void> {
    try {
      const result = (await browser.storage.local.get('debugMode')) as {
        debugMode?: boolean;
      };
      this.enabled = !!result.debugMode;
      this.isReady = true;
      this.flushQueue();
    } catch {
      this.isReady = true;
    }
  }

  private listenForChanges(): void {
    if (
      typeof browser !== 'undefined' &&
      browser.storage?.onChanged
    ) {
      browser.storage.onChanged.addListener(
        (changes: Record<string, { oldValue?: boolean; newValue?: boolean }>, area: string) => {
          if (area === 'local' && changes.debugMode !== undefined) {
            this.enabled = !!changes.debugMode.newValue;
          }
        }
      );
    }
  }

  async enable(): Promise<void> {
    this.enabled = true;
    if (typeof browser === 'undefined' || !browser.storage) return;
    try {
      await browser.storage.local.set({ debugMode: true });
    } catch {
      /* storage may not be available */
    }
  }

  async disable(): Promise<void> {
    this.enabled = false;
    if (typeof browser === 'undefined' || !browser.storage) return;
    try {
      await browser.storage.local.set({ debugMode: false });
    } catch {
      /* storage may not be available */
    }
  }

  private flushQueue(): void {
    if (this.enabled && this.queue.length > 0) {
      this.queue.forEach((log) => {
        const style = this.getTagStyle(log.tag);
        console[log.type](`%c${log.tag}`, style, log.message, log.data || '');
      });
    }
    this.queue = [];
  }

  private getTagStyle(tag: string): string {
    if (tag.includes('Error') || tag.includes('error')) {
      return 'color: white; background: #F44336; padding: 2px 6px; border-radius: 4px;';
    }
    if (tag.includes('API')) {
      return 'color: white; background: #9C27B0; padding: 2px 6px; border-radius: 4px;';
    }
    if (tag.includes('RateLimit') || tag.includes('warn') || tag.includes('Warning')) {
      return 'color: #333; background: #FFC107; padding: 2px 6px; border-radius: 4px;';
    }
    if (tag.includes('Folder')) {
      return 'color: white; background: #009688; padding: 2px 6px; border-radius: 4px;';
    }
    return 'color: white; background: #2196F3; padding: 2px 6px; border-radius: 4px;';
  }

  private enqueueOrLog(type: LogType, tag: string, message: string, data: unknown): void {
    if (!this.isReady) {
      this.queue.push({ type, tag, message, data });
      return;
    }
    if (this.enabled) {
      const style = this.getTagStyle(tag);
      if (data !== null && data !== undefined) {
        console[type](`%c${tag}`, style, message, data);
      } else {
        console[type](`%c${tag}`, style, message);
      }
    }
  }

  info(tag: string, message: string, data: unknown = null): void {
    this.enqueueOrLog('info', tag, message, data);
  }

  warn(tag: string, message: string, data: unknown = null): void {
    this.enqueueOrLog('warn', tag, message, data);
  }

  error(tag: string, message: string, data: unknown = null): void {
    if (!this.isReady) {
      this.queue.push({ type: 'error', tag, message, data });
      return;
    }
    const style = 'color: white; background: #F44336; padding: 2px 6px; border-radius: 4px;';
    console.error(
      `%c${tag}`,
      style,
      message,
      data !== null && data !== undefined ? data : ''
    );
  }

  apiRequest(provider: string, url: string, requestBody: unknown): void {
    if (!this.isReady) return;
    if (this.enabled) {
      console.groupCollapsed(
        `%c[API: ${provider}] Request`,
        'color: #9C27B0; font-weight: bold;'
      );
      console.log('URL:', url);
      console.log('Request Body:', requestBody);
      console.groupEnd();
    }
  }

  apiResponse(provider: string, status: number, data: unknown): void {
    if (!this.isReady) return;
    if (this.enabled) {
      const isSuccess = status >= 200 && status < 300;
      const color = isSuccess ? '#4CAF50' : '#F44336';
      const icon = isSuccess ? '✅' : '❌';
      console.groupCollapsed(
        `%c[API: ${provider}] ${icon} Response (${status})`,
        `color: ${color}; font-weight: bold;`
      );
      console.log('Response Data:', data);
      console.groupEnd();
    }
  }

  log(tag: string, message: string, data: unknown = null): void {
    this.info(tag, message, data);
  }
}

// Global singleton — maintain backward compatibility with existing JS
const logger = new DebugLogger();
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).debugLogger = logger;
}
