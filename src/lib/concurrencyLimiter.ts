/**
 * Concurrency Limiter - Controls parallel async operations
 *
 * Prevents overwhelming external APIs (OpenAI, Tavily, etc.) by limiting
 * the number of concurrent requests.
 *
 * Example:
 * ```typescript
 * import { limitConcurrency } from './concurrencyLimiter';
 *
 * const transactions = [tx1, tx2, tx3, ...tx100];
 * const tasks = transactions.map(tx => () => processTransaction(tx));
 *
 * // Only 5 concurrent operations at a time
 * const results = await limitConcurrency(tasks, 5);
 * ```
 */

/**
 * Execute async tasks with limited concurrency
 *
 * @param tasks - Array of async task functions (not promises!)
 * @param limit - Maximum number of concurrent tasks (default: 5)
 * @param onProgress - Optional callback for progress updates
 * @returns Array of results in the same order as tasks
 */
export async function limitConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  limit: number = 5,
  onProgress?: (completed: number, total: number) => void
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let currentIndex = 0;
  let completed = 0;

  async function runNext(): Promise<void> {
    const taskIndex = currentIndex++;

    if (taskIndex >= tasks.length) {
      return;
    }

    try {
      const result = await tasks[taskIndex]();
      results[taskIndex] = result;
    } catch (error) {
      console.error(`Task ${taskIndex} failed:`, error);
      throw error;
    } finally {
      completed++;
      if (onProgress) {
        onProgress(completed, tasks.length);
      }
    }

    await runNext();
  }

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => runNext());

  await Promise.all(workers);

  return results;
}

/**
 * Execute async tasks with limited concurrency and error tolerance
 *
 * Unlike limitConcurrency, this version continues processing even if some tasks fail.
 * Failed tasks will have { success: false, error: Error } in the results.
 *
 * @param tasks - Array of async task functions (not promises!)
 * @param limit - Maximum number of concurrent tasks (default: 5)
 * @param onProgress - Optional callback for progress updates
 * @returns Array of results with success/error status
 */
export async function limitConcurrencyWithErrorHandling<T>(
  tasks: Array<() => Promise<T>>,
  limit: number = 5,
  onProgress?: (completed: number, total: number, errors: number) => void
): Promise<Array<{ success: true; data: T } | { success: false; error: Error }>> {
  const results: Array<{ success: true; data: T } | { success: false; error: Error }> = new Array(tasks.length);
  let currentIndex = 0;
  let completed = 0;
  let errors = 0;

  async function runNext(): Promise<void> {
    const taskIndex = currentIndex++;

    if (taskIndex >= tasks.length) {
      return;
    }

    try {
      const result = await tasks[taskIndex]();
      results[taskIndex] = { success: true, data: result };
    } catch (error) {
      console.error(`Task ${taskIndex} failed:`, error);
      errors++;
      results[taskIndex] = {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    } finally {
      completed++;
      if (onProgress) {
        onProgress(completed, tasks.length, errors);
      }
    }

    await runNext();
  }

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => runNext());

  await Promise.all(workers);

  return results;
}

/**
 * Simple batch processor - splits array into batches and processes sequentially
 *
 * Use this when you want to process items in distinct batches rather than
 * a continuous stream of limited concurrency.
 *
 * @param items - Array of items to process
 * @param batchSize - Number of items per batch
 * @param processor - Function to process a batch
 * @param onBatchComplete - Optional callback after each batch
 * @returns Array of all results
 */
export async function processBatches<T, R>(
  items: T[],
  batchSize: number,
  processor: (batch: T[]) => Promise<R[]>,
  onBatchComplete?: (batchIndex: number, totalBatches: number) => void
): Promise<R[]> {
  const results: R[] = [];
  const totalBatches = Math.ceil(items.length / batchSize);

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchIndex = Math.floor(i / batchSize);

    console.log(`Processing batch ${batchIndex + 1}/${totalBatches} (${batch.length} items)`);

    const batchResults = await processor(batch);
    results.push(...batchResults);

    if (onBatchComplete) {
      onBatchComplete(batchIndex + 1, totalBatches);
    }
  }

  return results;
}
