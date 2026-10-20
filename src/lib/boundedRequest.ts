// Reject a stalled read even when the underlying transport ignores cancellation.
export async function boundedRequest<T>(request: PromiseLike<T>, timeoutMs = 10000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([Promise.resolve(request), new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("对局加载失败，请重试")), timeoutMs);
    })]);
  } finally { if (timer !== undefined) clearTimeout(timer); }
}