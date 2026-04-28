declare const browser: any;

export interface RateLimitResult {
  allowed: boolean;
  waitTime: number;
  keyIndex: number | null;
  message?: string;
}

// Mutex for atomic rate limit operations
let geminiRateLimitMutex: Promise<RateLimitResult> = Promise.resolve({
  allowed: true,
  waitTime: 0,
  keyIndex: 0,
});

export async function checkAndTrackGeminiRateLimit(
  keyIndex: number | null = null
): Promise<RateLimitResult> {
  // Chain onto mutex for atomic operation
  return (geminiRateLimitMutex = geminiRateLimitMutex.then(async () => {
    const now = Date.now();
    const data = await browser.storage.local.get([
      'geminiApiKeys',
      'geminiRateLimits',
      'currentGeminiKeyIndex',
      'geminiPaidPlan',
      'geminiRateLimit', // Legacy single-key
    ]);

    // Skip for paid plan
    if (data.geminiPaidPlan) {
      return { allowed: true, waitTime: 0, keyIndex: keyIndex ?? 0 };
    }

    // Multi-key mode
    if (data.geminiApiKeys?.length > 0) {
      const keys: string[] = data.geminiApiKeys;
      const rateLimits: Array<{
        requests: number[];
        dailyCount: number;
        dailyResetTime: number;
      }> =
        data.geminiRateLimits ||
        keys.map(() => ({
          requests: [],
          dailyCount: 0,
          dailyResetTime: now + 24 * 60 * 60 * 1000,
        }));
      let currentIndex = keyIndex ?? (data.currentGeminiKeyIndex || 0);

      const startIndex = currentIndex;
      let attempts = 0;

      while (attempts < keys.length) {
        const rateLimit = rateLimits[currentIndex];

        // Reset daily if expired
        if (now > rateLimit.dailyResetTime) {
          rateLimit.dailyCount = 0;
          rateLimit.dailyResetTime = now + 24 * 60 * 60 * 1000;
          rateLimit.requests = [];
        }

        // Clean old requests
        const oneMinuteAgo = now - 60000;
        rateLimit.requests = rateLimit.requests.filter(
          (t: number) => t > oneMinuteAgo
        );

        // Check availability
        if (rateLimit.dailyCount < 20) {
          // Check if we need to wait
          if (rateLimit.requests.length > 0) {
            const lastRequest = Math.max(...rateLimit.requests);
            const timeSinceLastRequest = now - lastRequest;
            const minInterval = 12000; // 12 seconds

            if (timeSinceLastRequest < minInterval) {
              const waitTime = Math.ceil(
                (minInterval - timeSinceLastRequest) / 1000
              );
              // Track request now (with wait)
              rateLimit.requests.push(now);
              rateLimit.dailyCount += 1;

              await browser.storage.local.set({
                currentGeminiKeyIndex: currentIndex,
                geminiRateLimits: rateLimits,
              });

              if ((window as any).debugLogger) {
                (window as any).debugLogger.info(
                  '[RateLimit]',
                  `Gemini Key #${currentIndex + 1}: ${rateLimit.dailyCount}/20 today, ${rateLimit.requests.length} in last minute`
                );
              }

              return { allowed: true, waitTime, keyIndex: currentIndex };
            }
          }

          // Track request immediately
          rateLimit.requests.push(now);
          rateLimit.dailyCount += 1;

          await browser.storage.local.set({
            currentGeminiKeyIndex: currentIndex,
            geminiRateLimits: rateLimits,
          });

          if ((window as any).debugLogger) {
            (window as any).debugLogger.info(
              '[RateLimit]',
              `Gemini Key #${currentIndex + 1}: ${rateLimit.dailyCount}/20 today, ${rateLimit.requests.length} in last minute`
            );
          }

          return { allowed: true, waitTime: 0, keyIndex: currentIndex };
        }

        currentIndex = (currentIndex + 1) % keys.length;
        attempts++;
      }

      return {
        allowed: false,
        waitTime: 0,
        keyIndex: currentIndex,
        message: `All ${keys.length} Gemini API keys have reached their daily limit (20/day each). Please wait for reset or add more API keys in settings.`,
      };
    }

    // Legacy single-key mode
    const rateLimit: {
      requests: number[];
      dailyCount: number;
      dailyResetTime: number;
    } = data.geminiRateLimit || {
      requests: [],
      dailyCount: 0,
      dailyResetTime: now + 24 * 60 * 60 * 1000,
    };

    // Reset daily if expired
    if (now > rateLimit.dailyResetTime) {
      rateLimit.dailyCount = 0;
      rateLimit.dailyResetTime = now + 24 * 60 * 60 * 1000;
      rateLimit.requests = [];
    }

    // Check daily limit
    if (rateLimit.dailyCount >= 20) {
      const hoursUntilReset = Math.ceil(
        (rateLimit.dailyResetTime - now) / (1000 * 60 * 60)
      );
      return {
        allowed: false,
        waitTime: 0,
        keyIndex: null,
        message: `Gemini free tier daily limit reached (20/day). Resets in ${hoursUntilReset} hours. Upgrade to paid plan or add multiple API keys in settings to remove limits.`,
      };
    }

    // Clean old requests
    const oneMinuteAgo = now - 60000;
    rateLimit.requests = rateLimit.requests.filter(
      (t: number) => t > oneMinuteAgo
    );

    // Check if need to wait
    if (rateLimit.requests.length > 0) {
      const lastRequest = Math.max(...rateLimit.requests);
      const timeSinceLastRequest = now - lastRequest;
      const minInterval = 12000;

      if (timeSinceLastRequest < minInterval) {
        const waitTime = Math.ceil(
          (minInterval - timeSinceLastRequest) / 1000
        );
        // Track now (with wait)
        rateLimit.requests.push(now);
        rateLimit.dailyCount += 1;
        await browser.storage.local.set({ geminiRateLimit: rateLimit });

        if ((window as any).debugLogger) {
          (window as any).debugLogger.info(
            '[RateLimit]',
            `Gemini requests: ${rateLimit.dailyCount}/20 today, ${rateLimit.requests.length} in last minute`
          );
        }

        return { allowed: true, waitTime, keyIndex: null };
      }
    }

    // Track request
    rateLimit.requests.push(now);
    rateLimit.dailyCount += 1;
    await browser.storage.local.set({ geminiRateLimit: rateLimit });

    if ((window as any).debugLogger) {
      (window as any).debugLogger.info(
        '[RateLimit]',
        `Gemini requests: ${rateLimit.dailyCount}/20 today, ${rateLimit.requests.length} in last minute`
      );
    }

    return { allowed: true, waitTime: 0, keyIndex: null };
  }).catch((err: Error) => {
    console.error('[RateLimit] Mutex internal error:', err);
    geminiRateLimitMutex = Promise.resolve({
      allowed: true,
      waitTime: 0,
      keyIndex: 0,
    });
    return {
      allowed: false,
      waitTime: 0,
      keyIndex: null,
      message: 'Rate limit check internal error: ' + err.message,
    };
  })) as Promise<RateLimitResult>;
}

// Deprecated: Use checkAndTrackGeminiRateLimit instead
export async function checkGeminiRateLimit(): Promise<RateLimitResult> {
  console.warn(
    '[Deprecated] checkGeminiRateLimit: Use checkAndTrackGeminiRateLimit instead'
  );
  const result = await checkAndTrackGeminiRateLimit();
  // Note: This deprecated wrapper already tracked the request, so callers
  // using this will need to NOT call trackGeminiRequest separately
  return result;
}

// Deprecated: No longer needed - tracking is done in checkAndTrackGeminiRateLimit
export async function trackGeminiRequest(
  _keyIndex: number | null
): Promise<void> {
  console.warn(
    '[Deprecated] trackGeminiRequest: No longer needed - tracking is done in checkAndTrackGeminiRateLimit'
  );
}
