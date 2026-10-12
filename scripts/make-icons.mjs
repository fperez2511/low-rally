// Generates the PWA icons (PNG) with no dependencies: rasterises a few flat polygons
// in the game's palette and writes PNGs with node's built-in zlib.
// Usage: npm run icons
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';

const SKY = [0xf4, 0xc9, 0xa0];
const GRASS = [0x8c, 0xae, 0x5b];
const FOREST = [0x4f, 0x7a, 0x4a];
const ROAD = [0x6e, 0x6a, 0x78];
const CREAM = [0xf6, 0xec, 0xd6];
const CAR = [0xe4, 0x53, 0x3a];

// Polygons in a 100x100 design space, painted back to front.
const art = [
  [SKY, [[0, 0], [100, 0], [100, 100], [0, 100]]],
  [FOREST, [[0, 62], [28, 34], [52, 60], [74, 30], [100, 58], [100, 100], [0, 100]]],
  [GRASS, [[0, 74], [30, 56], [60, 72], [100, 52], [100, 100], [0, 100]]],
  [ROAD, [[40, 100], [47, 58], [53, 58], [78, 100]]],
  [CREAM, [[48.6, 100], [49.4, 64], [50.6, 64], [53, 100]]],
  [CAR, [[38, 86], [38, 74], [44, 68], [58, 68], [64, 74], [64, 86]]],
  [CREAM, [[43, 74], [46, 70], [56, 70], [59, 74]]],
];

function inside(poly, x, y) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

/** `pad` shrinks the artwork toward the centre (maskable icons need a safe zone). */
function render(size, pad = 0) {
  const px = Buffer.alloc(size * size * 3);
  const scale = 100 / (size * (1 - pad * 2));
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x - size * pad) * scale;
      const dy = (y - size * pad) * scale;
      let col = SKY;
      for (const [c, poly] of art) if (inside(poly, dx, dy)) col = c;
      px.set(col, (y * size + x) * 3);
    }
  }
  return px;
}

const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};
function png(size, rgb) {
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    rgb.copy(raw, y * (size * 3 + 1) + 1, y * size * 3, (y + 1) * size * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync('public', { recursive: true });
writeFileSync('public/pwa-192.png', png(192, render(192)));
writeFileSync('public/pwa-512.png', png(512, render(512)));
writeFileSync('public/pwa-maskable-512.png', png(512, render(512, 0.1)));
writeFileSync('public/apple-touch-icon.png', png(180, render(180)));

const hex = (c) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
const svgPolys = art.map(([c, poly]) => `<polygon fill="${hex(c)}" points="${poly.map((p) => p.join(',')).join(' ')}"/>`).join('');
writeFileSync('public/icon.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${svgPolys}</svg>\n`);
console.log('icons written to public/');
