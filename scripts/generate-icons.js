import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

const publicDir = path.resolve('public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Write high-res SVG icon
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#4F46E5" />
      <stop offset="50%" stop-color="#6366F1" />
      <stop offset="100%" stop-color="#06B6D4" />
    </linearGradient>
    <linearGradient id="bookGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" />
      <stop offset="100%" stop-color="#E0E7FF" />
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#1e1b4b" flood-opacity="0.35"/>
    </filter>
  </defs>
  <!-- Background rounded rect -->
  <rect width="512" height="512" rx="110" fill="url(#grad)" />
  
  <!-- Outer subtle ring -->
  <circle cx="256" cy="256" r="210" fill="none" stroke="#FFFFFF" stroke-opacity="0.15" stroke-width="6" stroke-dasharray="16 12"/>

  <!-- Main Symbol Group with shadow -->
  <g filter="url(#shadow)">
    <!-- Open Book / Study Slate -->
    <path d="M120 180 C 180 160, 240 175, 256 195 C 272 175, 332 160, 392 180 L 392 340 C 332 320, 272 335, 256 355 C 240 335, 180 320, 120 340 Z" fill="url(#bookGrad)" />
    <!-- Book spine / crease -->
    <path d="M 256 195 L 256 355" stroke="#818CF8" stroke-width="5" stroke-linecap="round" />
    
    <!-- Sync Arrow Ring around center -->
    <path d="M 195 240 A 65 65 0 0 1 310 215" fill="none" stroke="#4F46E5" stroke-width="12" stroke-linecap="round"/>
    <polygon points="310,200 330,220 305,235" fill="#4F46E5" />
    
    <path d="M 317 295 A 65 65 0 0 1 202 320" fill="none" stroke="#06B6D4" stroke-width="12" stroke-linecap="round"/>
    <polygon points="202,335 182,315 207,300" fill="#06B6D4" />

    <!-- Center pulse dot (Offline-First sync indicator) -->
    <circle cx="256" cy="268" r="14" fill="#10B981" stroke="#FFFFFF" stroke-width="4"/>
  </g>
</svg>`;

fs.writeFileSync(path.join(publicDir, 'icon.svg'), svgContent);
console.log('Saved public/icon.svg');

// Generate valid uncompressed/DEFLATE PNG files in pure node
function createPng(width, height, r, g, b, alpha = 255) {
  // Standard minimal PNG generator
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const ihdrChunk = makeChunk('IHDR', ihdr);

  // Raw image data: scanlines with filter byte 0
  const scanlineLength = 1 + width * 4;
  const rawData = Buffer.alloc(height * scanlineLength);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * scanlineLength;
    rawData[rowOffset] = 0; // filter type 0 (None)
    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 4;
      // Gradient / stylized design pattern
      const dx = x - width / 2;
      const dy = y - height / 2;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const cornerR = width * 0.22;
      
      // Rounded rect mask
      const inBox = Math.abs(dx) < (width/2 - cornerR) || Math.abs(dy) < (height/2 - cornerR) ||
        Math.hypot(Math.abs(dx) - (width/2 - cornerR), Math.abs(dy) - (height/2 - cornerR)) <= cornerR;

      if (inBox) {
        // Gradient from indigo #4F46E5 (79, 70, 229) to cyan #06B6D4 (6, 182, 212)
        const t = (x + y) / (width + height);
        const pr = Math.round(79 * (1 - t) + 6 * t);
        const pg = Math.round(70 * (1 - t) + 182 * t);
        const pb = Math.round(229 * (1 - t) + 212 * t);
        
        // Inner book emblem
        if (dist < width * 0.28) {
          rawData[pixelOffset] = 255;
          rawData[pixelOffset + 1] = 255;
          rawData[pixelOffset + 2] = 255;
          rawData[pixelOffset + 3] = 255;
        } else {
          rawData[pixelOffset] = pr;
          rawData[pixelOffset + 1] = pg;
          rawData[pixelOffset + 2] = pb;
          rawData[pixelOffset + 3] = 255;
        }
      } else {
        rawData[pixelOffset] = 0;
        rawData[pixelOffset + 1] = 0;
        rawData[pixelOffset + 2] = 0;
        rawData[pixelOffset + 3] = 0;
      }
    }
  }

  const compressedData = zlib.deflateSync(rawData);
  const idatChunk = makeChunk('IDAT', compressedData);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function makeChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = data.length;
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(len, 0);

  const crcBuf = Buffer.alloc(4);
  const crc = crc32(Buffer.concat([typeBuf, data]));
  crcBuf.writeUInt32BE(crc, 0);

  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

// CRC32 implementation
function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) {
        c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      }
      table[i] = c >>> 0;
    }
    crc32.table = table;
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), createPng(192, 192));
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), createPng(512, 512));
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), createPng(512, 512));
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), createPng(180, 180));
console.log('Successfully generated all PWA icons!');
