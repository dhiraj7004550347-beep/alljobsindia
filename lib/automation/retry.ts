export function isTransientCollectionError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  return /HTTP (?:429|5\d\d)|aborted|fetch failed|timed out|ECONNRESET|ETIMEDOUT|UND_ERR_(?:CONNECT_)?TIMEOUT|socket (?:hang up|closed)/i.test(message);
}
