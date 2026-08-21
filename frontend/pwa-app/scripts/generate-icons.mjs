// Genera iconos PNG válidos (sin dependencias) para el manifest PWA.
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'icons');
mkdirSync(outDir, { recursive: true });

const CRC_TABLE = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});

function crc32(buf) {
  let crc = -1;
  for (const byte of buf) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** Cuadrado redondeado oscuro con un punto de venta estilizado (círculo verde). */
function renderIcon(size) {
  const bg = [15, 23, 42]; // #0f172a
  const accent = [34, 197, 94]; // #22c55e
  const radius = size * 0.18;
  const cx = size / 2;
  const cy = size / 2;
  const rOuter = size * 0.28;
  const rInner = size * 0.12;

  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 4 + 1);
    raw[rowStart] = 0; // filtro "none"
    for (let x = 0; x < size; x++) {
      // esquinas redondeadas
      const dx = Math.max(radius - x, x - (size - 1 - radius), 0);
      const dy = Math.max(radius - y, y - (size - 1 - radius), 0);
      const inside = dx * dx + dy * dy <= radius * radius;

      const dist = Math.hypot(x - cx, y - cy);
      let px = bg[0];
      let pg = bg[1];
      let pb = bg[2];
      if (inside && dist <= rOuter && dist >= rInner) {
        px = accent[0];
        pg = accent[1];
        pb = accent[2];
      }
      const offset = rowStart + 1 + x * 4;
      raw[offset] = px;
      raw[offset + 1] = pg;
      raw[offset + 2] = pb;
      raw[offset + 3] = inside ? 255 : 0;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const size of [192, 512]) {
  writeFileSync(join(outDir, `icon-${size}.png`), renderIcon(size));
  console.log(`icon-${size}.png generado`);
}
