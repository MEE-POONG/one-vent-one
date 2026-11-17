import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import sharp from "sharp";
import {
  publicImage,
  uploadPublicImage,
} from "../src/server/storage/public-images";
import type { Actor } from "../src/server/auth";

test("public images: permissions, validation, immutable uploads and private-file isolation", async (t) => {
  const tempRoot = path.resolve(tmpdir());
  const directory = await mkdtemp(path.join(tempRoot, "oneventone-images-"));
  const previous = process.env.STORAGE_DIRECTORY;
  process.env.STORAGE_DIRECTORY = directory;
  t.after(async () => {
    if (previous === undefined) delete process.env.STORAGE_DIRECTORY;
    else process.env.STORAGE_DIRECTORY = previous;
    assert.equal(path.dirname(directory), tempRoot);
    assert.ok(path.basename(directory).startsWith("oneventone-images-"));
    await rm(directory, { recursive: true, force: true });
  });
  const admin: Actor = { id: "000000000000000000000001", roles: ["ADMIN"] };
  const owner: Actor = {
    id: "000000000000000000000002",
    roles: ["SUPER_ADMIN"],
  };
  const customer: Actor = {
    id: "000000000000000000000003",
    roles: ["CUSTOMER"],
  };
  const png = await sharp({
    create: { width: 32, height: 16, channels: 4, background: "#E11D4880" },
  })
    .png()
    .toBuffer();
  const file = new File([new Uint8Array(png)], "poster.png", {
    type: "image/png",
  });
  await assert.rejects(uploadPublicImage(customer, "poster", file), {
    code: "FORBIDDEN",
  });
  await assert.rejects(uploadPublicImage(admin, "logo", file), {
    code: "FORBIDDEN",
  });
  await assert.rejects(
    uploadPublicImage(
      admin,
      "poster",
      new File(["<svg/>"], "fake.png", { type: "image/png" }),
    ),
    { code: "VALIDATION_ERROR" },
  );
  await assert.rejects(
    uploadPublicImage(
      admin,
      "poster",
      new File([new Uint8Array(5 * 1024 * 1024 + 1)], "large.png", {
        type: "image/png",
      }),
    ),
    { code: "VALIDATION_ERROR" },
  );
  const uploaded = await uploadPublicImage(admin, "poster", file);
  assert.match(uploaded.url, /^\/api\/images\/[a-f0-9]{64}\.webp$/);
  assert.deepEqual(await uploadPublicImage(owner, "logo", file), uploaded);
  const key = uploaded.url.split("/").at(-1)!;
  const response = await publicImage(key);
  assert.equal(response.headers.get("Content-Type"), "image/webp");
  assert.match(response.headers.get("Cache-Control")!, /immutable/);
  const metadata = await sharp(
    Buffer.from(await response.arrayBuffer()),
  ).metadata();
  assert.equal(metadata.width, 32);
  assert.equal(metadata.height, 16);
  assert.equal(metadata.hasAlpha, true);
  await assert.rejects(publicImage("../private.png"), { code: "NOT_FOUND" });
  const privateKey = `${"a".repeat(64)}.webp`;
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, privateKey), "private evidence");
  await assert.rejects(publicImage(privateKey), { code: "NOT_FOUND" });
});
