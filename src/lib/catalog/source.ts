import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Catalog } from "./types";

/**
 * The only place that knows where catalog data comes from.
 * Swap FileCatalogSource for KhidiCatalogSource (same return shape) and nothing else changes.
 */
export interface CatalogSource {
  load(): Promise<Catalog>;
}

const SUPPORTED_MAJOR = "1";

function assertContract(c: Catalog): Catalog {
  if (!c || typeof c !== "object" || !Array.isArray(c.products)) {
    throw new Error("Catalog source returned an invalid payload");
  }
  const major = String(c.schema_version ?? "").split(".")[0];
  if (major !== SUPPORTED_MAJOR) {
    throw new Error(`Unsupported catalog schema ${c.schema_version}; this store reads ${SUPPORTED_MAJOR}.x`);
  }
  return c;
}

export class FileCatalogSource implements CatalogSource {
  constructor(private file: string) {}

  async load(): Promise<Catalog> {
    const abs = path.isAbsolute(this.file) ? this.file : path.join(/*turbopackIgnore: true*/ process.cwd(), this.file);
    return assertContract(JSON.parse(await readFile(abs, "utf8")) as Catalog);
  }
}

export class KhidiCatalogSource implements CatalogSource {
  constructor(private url: string, private token?: string) {}

  async load(): Promise<Catalog> {
    const res = await fetch(this.url, {
      headers: this.token ? { Authorization: `Bearer ${this.token}` } : undefined,
    });
    if (!res.ok) throw new Error(`Khidi catalog request failed: ${res.status}`);
    return assertContract((await res.json()) as Catalog);
  }
}

export function createCatalogSource(): CatalogSource {
  const kind = process.env.CATALOG_SOURCE ?? "file";
  if (kind === "khidi") {
    if (!process.env.KHIDI_API_URL) throw new Error("KHIDI_API_URL is not set");
    return new KhidiCatalogSource(process.env.KHIDI_API_URL, process.env.KHIDI_API_TOKEN);
  }
  return new FileCatalogSource(process.env.CATALOG_PATH ?? "data/catalog.json");
}
