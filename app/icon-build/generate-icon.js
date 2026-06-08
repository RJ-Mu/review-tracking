// Generates PWA icon sizes from a single 512x512 source.
// Run from app/:  node icon-build/generate-icons.js
import sharp from 'sharp';
import { mkdirSync } from 'fs';

const SRC = 'icon-build/icon-source.png';
const OUT = 'public/icons';
mkdirSync(OUT, { recursive: true });

// Background to fill the maskable padding and any transparency (match icon bg).
const BG = { r: 8, g: 16, b: 8, alpha: 1 };   // #081008

async function run() {
  // Plain icons: straight resize.
  await sharp(SRC).resize(192, 192, { fit: 'contain', background: BG })
    .png().toFile(`${OUT}/icon-192.png`);
  await sharp(SRC).resize(512, 512, { fit: 'contain', background: BG })
    .png().toFile(`${OUT}/icon-512.png`);

  // Apple touch icon (iOS home screen) — 180x180, flattened on bg (iOS ignores transparency oddly).
  await sharp(SRC).resize(180, 180, { fit: 'contain', background: BG })
    .flatten({ background: BG }).png().toFile(`${OUT}/apple-touch-icon.png`);

  // Maskable 512: shrink the art to ~78% and pad, so Android's circular crop
  // never cuts into the ">P1". The padding uses the same background colour.
  const inner = Math.round(512 * 0.78);          // ~400px of art
  const pad = Math.round((512 - inner) / 2);      // ~56px each side
  const resized = await sharp(SRC).resize(inner, inner, { fit: 'contain', background: BG }).toBuffer();
  await sharp({ create: { width: 512, height: 512, channels: 4, background: BG } })
    .composite([{ input: resized, top: pad, left: pad }])
    .png().toFile(`${OUT}/icon-512-maskable.png`);

  console.log('Icons written to', OUT);
}

run().catch((e) => { console.error(e); process.exit(1); });