import sharp from "sharp";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const iconsDir = path.join(__dirname, "..", "public", "icons");

// Main artwork. Square-ish but not exactly square (1641x1640), so every target is
// resized with `fit: "cover"` to avoid sharp letterboxing it.
const artwork = path.join(iconsDir, "logo-source.png");

// Sampled from the artwork's own corners (all four are #202222). Padding the maskable
// icon with the manifest's #14161A instead left a visible rectangular seam — the two
// darks are close but not equal, and the join reads as a border at icon size.
const BG = "#202222";

/**
 * Fraction of the canvas the artwork occupies in the maskable icon.
 *
 * Android crops maskable icons to an arbitrary shape and only guarantees the centre
 * 80% circle survives. At full bleed the magnifier handle (reaching ~91% across) and
 * the lower-left paw would both be clipped. Shrinking to 82% pulls the furthest
 * element inside that circle; the gap is filled with BG so it just reads as a
 * slightly smaller creature rather than a border.
 */
const MASKABLE_SCALE = 0.82;

const fullBleed = [
  { file: "icon-192.png", size: 192 },
  { file: "icon-512.png", size: 512 },
  { file: "apple-touch-icon.png", size: 180 },
];

for (const { file, size } of fullBleed) {
  await sharp(artwork)
    .resize(size, size, { fit: "cover" })
    .png()
    .toFile(path.join(iconsDir, file));
  console.log(`wrote ${file} (${size}x${size}, full bleed)`);
}

const maskableSize = 512;
const inner = Math.round(maskableSize * MASKABLE_SCALE);
const pad = Math.round((maskableSize - inner) / 2);
const innerBuffer = await sharp(artwork).resize(inner, inner, { fit: "cover" }).png().toBuffer();
await sharp({
  create: { width: maskableSize, height: maskableSize, channels: 4, background: BG },
})
  .composite([{ input: innerBuffer, top: pad, left: pad }])
  .png()
  .toFile(path.join(iconsDir, "icon-maskable-512.png"));
console.log(`wrote icon-maskable-512.png (512x512, artwork at ${Math.round(MASKABLE_SCALE * 100)}%)`);

// The notification badge stays on the old flat SVG mark. Android renders badges as a
// monochrome silhouette derived from the alpha channel, and the artwork PNG is fully
// opaque — feeding it in would produce a solid filled square. (iOS ignores `badge`.)
await sharp(readFileSync(path.join(iconsDir, "logo-source.svg")), { density: 384 })
  .resize(72, 72)
  .png()
  .toFile(path.join(iconsDir, "badge-72.png"));
console.log("wrote badge-72.png (72x72, from logo-source.svg — needs alpha to silhouette)");
