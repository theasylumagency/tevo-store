/**
 * After a cache refresh (POST /api/revalidate) one page render can fill many "use cache" entries
 * (catalog, media, settings, navigation…); Next adds a "close" listener to the response for each, which
 * trips Node's default limit of 10 and logs a MaxListenersExceededWarning per request. The listeners
 * belong to that single response and go away with it — this only silences the false alarm.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { EventEmitter } = await import("node:events");
    EventEmitter.defaultMaxListeners = 50;
    // Seed a new deployment before serving the first public request.
    const { getDb } = await import("@/db");
    await getDb();
  }
}
