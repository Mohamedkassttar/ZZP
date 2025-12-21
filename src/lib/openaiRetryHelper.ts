/**
 * OpenAI API Retry Helper
 *
 * Handles rate limiting (429 errors) with exponential backoff
 * and provides user-friendly error messages
 */

interface OpenAIRequestConfig {
  model: string;
  messages: Array<{
    role: 'system' | 'user';
    content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
  }>;
  max_tokens: number;
  temperature: number;
}

interface RetryConfig {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
}

const DEFAULT_RETRY_CONFIG: Required<RetryConfig> = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
};

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Call OpenAI API with automatic retry on 429 (rate limit) errors
 *
 * Features:
 * - Exponential backoff (1s, 2s, 4s, 8s...)
 * - Respects Retry-After header from OpenAI
 * - User-friendly error messages
 * - Automatic retry on transient errors
 *
 * @param apiKey - OpenAI API key
 * @param config - Request configuration
 * @param retryConfig - Retry settings
 * @returns OpenAI API response
 */
export async function callOpenAIWithRetry(
  apiKey: string,
  config: OpenAIRequestConfig,
  retryConfig: RetryConfig = {}
): Promise<any> {
  const { maxRetries, initialDelayMs, maxDelayMs } = {
    ...DEFAULT_RETRY_CONFIG,
    ...retryConfig,
  };

  let lastError: Error | null = null;
  let attempt = 0;

  while (attempt <= maxRetries) {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(config),
      });

      if (response.ok) {
        const data = await response.json();
        return data;
      }

      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error?.message || response.statusText;

      if (response.status === 429) {
        console.warn(`⚠️ OpenAI rate limit hit (attempt ${attempt + 1}/${maxRetries + 1})`);

        if (attempt >= maxRetries) {
          throw new Error(
            `OpenAI rate limit exceeded. This usually means:\n\n` +
            `1. Too many requests in a short time (try again in a few minutes)\n` +
            `2. Your API key quota is exhausted (check your OpenAI billing)\n` +
            `3. You're on a free tier with strict limits\n\n` +
            `Original error: ${errorMessage}`
          );
        }

        const retryAfterHeader = response.headers.get('Retry-After');
        let delayMs: number;

        if (retryAfterHeader) {
          delayMs = Math.min(parseInt(retryAfterHeader, 10) * 1000, maxDelayMs);
          console.log(`📍 Retry-After header found: ${retryAfterHeader}s (using ${delayMs}ms)`);
        } else {
          delayMs = Math.min(initialDelayMs * Math.pow(2, attempt), maxDelayMs);
          console.log(`📍 Exponential backoff: ${delayMs}ms`);
        }

        await sleep(delayMs);
        attempt++;
        continue;
      }

      if (response.status === 401) {
        throw new Error(
          `OpenAI API key is invalid or expired.\n\n` +
          `Please check your VITE_OPENAI_API_KEY in the .env file.\n` +
          `Get a valid API key from: https://platform.openai.com/api-keys\n\n` +
          `Original error: ${errorMessage}`
        );
      }

      if (response.status === 403) {
        throw new Error(
          `OpenAI API access forbidden.\n\n` +
          `This usually means your API key doesn't have permission to access this resource.\n` +
          `Check your OpenAI account settings and billing.\n\n` +
          `Original error: ${errorMessage}`
        );
      }

      if (response.status === 500 || response.status === 502 || response.status === 503) {
        console.warn(`⚠️ OpenAI server error ${response.status} (attempt ${attempt + 1}/${maxRetries + 1})`);

        if (attempt >= maxRetries) {
          throw new Error(
            `OpenAI server error (${response.status}). ` +
            `This is a temporary issue on OpenAI's side. Please try again later.\n\n` +
            `Original error: ${errorMessage}`
          );
        }

        const delayMs = Math.min(initialDelayMs * Math.pow(2, attempt), maxDelayMs);
        console.log(`📍 Retrying after ${delayMs}ms...`);
        await sleep(delayMs);
        attempt++;
        continue;
      }

      throw new Error(`OpenAI API error (${response.status}): ${errorMessage}`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (lastError.message.includes('OpenAI')) {
        throw lastError;
      }

      if (attempt >= maxRetries) {
        throw new Error(
          `Failed to connect to OpenAI API after ${maxRetries + 1} attempts.\n\n` +
          `Check your internet connection and try again.\n\n` +
          `Original error: ${lastError.message}`
        );
      }

      console.warn(`⚠️ Network error (attempt ${attempt + 1}/${maxRetries + 1}): ${lastError.message}`);
      const delayMs = Math.min(initialDelayMs * Math.pow(2, attempt), maxDelayMs);
      await sleep(delayMs);
      attempt++;
    }
  }

  throw lastError || new Error('Unknown error calling OpenAI API');
}

/**
 * Extract JSON from OpenAI response
 *
 * OpenAI sometimes wraps JSON in markdown code blocks or adds text around it
 *
 * @param content - Raw OpenAI response content
 * @returns Parsed JSON object
 */
export function extractJSON(content: string): any {
  if (!content) {
    console.error('❌ [JSON EXTRACT] No response content from OpenAI');
    throw new Error('No response content from OpenAI');
  }

  console.log('📄 [JSON EXTRACT] Raw OpenAI response:', content.substring(0, 500));

  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error('❌ [JSON EXTRACT] Could not find JSON in response. Full response:', content);
    throw new Error(`Could not extract JSON from OpenAI response. AI returned: "${content.substring(0, 200)}..."`);
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    console.log('✓ [JSON EXTRACT] Successfully parsed JSON:', parsed);
    return parsed;
  } catch (error) {
    console.error('❌ [JSON EXTRACT] Failed to parse JSON. Matched text:', jsonMatch[0].substring(0, 200));
    throw new Error(`Failed to parse JSON from OpenAI response: ${error}. Matched: "${jsonMatch[0].substring(0, 100)}..."`);
  }
}
