import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { homeMediaFiles, readHomePhoto, saveHomePhoto, HOME_PHOTO_MAX_BYTES } from "../../src/lib/homepage/media";

test("admin photos are decoded, normalized and only served by immutable safe names", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "rodo-home-media-"));
  const old = process.env.HOMEPAGE_MEDIA_DIR;
  process.env.HOMEPAGE_MEDIA_DIR = directory;
  try {
    const png = await sharp({ create: { width: 2400, height: 1800, channels: 3, background: "#aabbcc" } }).png().toBuffer();
    const file = await saveHomePhoto(new File([new Uint8Array(png)], "../unsafe-name.jpg", { type: "image/jpeg" }));
    assert.match(file, /^homepage\/[a-f0-9-]{36}\.webp$/);
    assert.deepEqual(await homeMediaFiles(), [file]);
    const bytes = await readHomePhoto(file.slice("homepage/".length));
    assert.ok(bytes);
    const metadata = await sharp(bytes).metadata();
    assert.equal(metadata.format, "webp");
    assert.ok(metadata.width! <= 2000 && metadata.height! <= 1600);
    assert.equal(metadata.exif, undefined);
    assert.equal(await readHomePhoto("../package.json"), null);
    await assert.rejects(saveHomePhoto(new File(["<svg><script>bad</script></svg>"], "fake.png", { type: "image/png" })));
    await assert.rejects(saveHomePhoto(new File([new Uint8Array(HOME_PHOTO_MAX_BYTES + 1)], "large.png")), /8 მბ/);
  } finally {
    if (old === undefined) delete process.env.HOMEPAGE_MEDIA_DIR; else process.env.HOMEPAGE_MEDIA_DIR = old;
    await rm(directory, { recursive: true, force: true });
  }
});
