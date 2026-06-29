// Guard the Open Graph share image against the most common drift: a wrong-size
// or missing assets/og-image.png. The page declares og:image:width/height as
// 1200x630, so the file must actually be those dimensions. Reads the PNG IHDR
// chunk directly (no image library) and fails on a mismatch. Run from
// validate.sh and deploy.yml.
//
// This does NOT catch content drift (editing og-image.src.svg without
// re-rendering the PNG) — that stays a manual step, see the README.
import { open } from "node:fs/promises";

const EXPECTED = { width: 1200, height: 630 };
const path = new URL("../assets/og-image.png", import.meta.url);

const file = await open(path, "r");
const buf = Buffer.alloc(24);
let bytesRead;
try {
  ({ bytesRead } = await file.read(buf, 0, 24, 0));
} finally {
  await file.close();
}

// PNG: 8-byte signature, then the IHDR chunk (length+type) with width and
// height as big-endian uint32 at byte offsets 16 and 20.
const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
if (bytesRead < 24 || !buf.subarray(0, 8).equals(SIGNATURE)) {
  console.error("check-og-image: assets/og-image.png is not a valid PNG");
  process.exitCode = 1;
} else if (buf.subarray(12, 16).toString("ascii") !== "IHDR") {
  console.error("check-og-image: assets/og-image.png missing IHDR chunk");
  process.exitCode = 1;
} else {
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);

  if (width !== EXPECTED.width || height !== EXPECTED.height) {
    console.error(
      `check-og-image: assets/og-image.png is ${width}x${height}, expected ${EXPECTED.width}x${EXPECTED.height}`,
    );
    process.exitCode = 1;
  } else {
    console.log(`check-og-image: assets/og-image.png is ${width}x${height}`);
  }
}
