// Links MEDIA_DIR (the folder that contains "originals/") to public/media so next/image can optimise it.
import { existsSync, lstatSync, mkdirSync, rmSync, symlinkSync } from "node:fs";
import path from "node:path";

const src = path.resolve(process.env.MEDIA_DIR ?? process.argv[2] ?? "");
const dest = path.resolve("public/media");
if (!src || !existsSync(path.join(src, "originals"))) {
  console.error(`MEDIA_DIR must point to a folder containing "originals/" (got: ${src})`);
  process.exit(1);
}
mkdirSync("public", { recursive: true });
if (existsSync(dest) || lstatSync(dest, { throwIfNoEntry: false })) rmSync(dest, { recursive: true, force: true });
symlinkSync(src, dest, process.platform === "win32" ? "junction" : "dir");
console.log(`public/media -> ${src}`);
