import "server-only";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { cacheLife } from "next/cache";

/** Which media files are actually present under public/media (so missing photos fall back cleanly). */
export async function getAvailableMedia(): Promise<string[]> {
  "use cache";
  cacheLife("hours");
  try {
    const dir = path.join(/*turbopackIgnore: true*/ process.cwd(), "public", "media", "originals");
    return (await readdir(dir)).map((f) => `originals/${f}`);
  } catch {
    return [];
  }
}
