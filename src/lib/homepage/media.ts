import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { HomeInputError } from "./validation";

const filenamePattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.webp$/;
export const HOME_PHOTO_MAX_BYTES = 8 * 1024 * 1024;
const directory = () => path.resolve(/*turbopackIgnore: true*/ process.env.HOMEPAGE_MEDIA_DIR ?? ".data/home-media");

export async function homeMediaFiles() {
  try { return (await readdir(directory())).filter(file => filenamePattern.test(file)).map(file => "homepage/" + file); }
  catch { return []; }
}
export async function readHomePhoto(filename: string) {
  if (!filenamePattern.test(filename)) return null;
  try { return await readFile(path.join(directory(), filename)); }
  catch { return null; }
}
export async function saveHomePhoto(file: File) {
  if (!file.size || file.size > HOME_PHOTO_MAX_BYTES) throw new HomeInputError("აირჩიე ფოტო მაქსიმუმ 8 მბ ზომით.");
  const input = Buffer.from(await file.arrayBuffer());
  let output: Buffer;
  try {
    const { default: sharp } = await import("sharp");
    const image = sharp(input, { limitInputPixels: 40_000_000, failOn: "warning" });
    const metadata = await image.metadata();
    if (!metadata.format || !["jpeg", "png", "webp", "avif", "heif"].includes(metadata.format) || (metadata.pages ?? 1) > 1) {
      throw new Error("Unsupported image");
    }
    // Decode rather than trust MIME/name; orientation is applied and metadata is stripped.
    output = await image.rotate().resize({ width: 2000, height: 1600, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 86 }).toBuffer();
  } catch { throw new HomeInputError("ფოტოს წაკითხვა ვერ მოხერხდა. გამოიყენე JPG, PNG, WebP ან AVIF ფორმატი."); }
  await mkdir(directory(), { recursive: true });
  const filename = randomUUID() + ".webp";
  await writeFile(path.join(directory(), filename), output, { flag: "wx", mode: 0o600 });
  return "homepage/" + filename;
}
