const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

// Mojang skin API
const SKIN_URL = (uuid) => `https://sessionserver.mojang.com/session/minecraft/profile/${uuid}`;

async function fetchSkinHead(uuid, username) {
  try {
    const cacheDir = path.join(app.getPath('userData'), 'skin-cache');
    if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });

    const cacheFile = path.join(cacheDir, `${uuid}.png`);
    const metaFile = path.join(cacheDir, `${uuid}.json`);

    // Use cache if less than 1 hour old
    if (fs.existsSync(cacheFile) && fs.existsSync(metaFile)) {
      const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
      if (Date.now() - meta.fetchedAt < 3600000) {
        return cacheFile;
      }
    }

    // Fetch profile with skin texture info
    const profileRes = await fetch(SKIN_URL(uuid.replace(/-/g, '')));
    if (!profileRes.ok) throw new Error(`Profile fetch failed: ${profileRes.status}`);
    const profile = await profileRes.json();

    // Decode base64 texture property
    const textureProp = profile.properties?.find(p => p.name === 'textures');
    if (!textureProp) throw new Error('No texture property found');

    const textureData = JSON.parse(Buffer.from(textureProp.value, 'base64').toString('utf8'));
    const skinUrl = textureData.textures?.SKIN?.url;
    if (!skinUrl) throw new Error('No skin URL found');

    // Download skin texture (64x64 PNG)
    const skinRes = await fetch(skinUrl);
    if (!skinRes.ok) throw new Error(`Skin download failed: ${skinRes.status}`);
    const skinBuffer = Buffer.from(await skinRes.arrayBuffer());

    // Extract head region (8,8 to 16,16 = face, 40,8 to 48,16 = hat layer)
    // We'll parse the PNG manually to extract the head pixels
    const headPng = await extractHead(skinBuffer);

    fs.writeFileSync(cacheFile, headPng);
    fs.writeFileSync(metaFile, JSON.stringify({ fetchedAt: Date.now(), uuid, username }));

    return cacheFile;
  } catch (e) {
    console.error('Skin fetch error:', e.message);
    return null;
  }
}

async function extractHead(skinBuffer) {
  // Parse PNG to get pixel data, crop head (8,8)-(16,16) and scale to 64x64
  // We'll use a pure JS PNG parser approach

  // Find IDAT chunks and decompress
  const zlib = require('zlib');

  let pos = 8; // skip PNG signature
  let width = 0, height = 0, bitDepth = 0, colorType = 0;
  let idatChunks = [];

  while (pos < skinBuffer.length) {
    const len = skinBuffer.readUInt32BE(pos); pos += 4;
    const type = skinBuffer.slice(pos, pos + 4).toString('ascii'); pos += 4;
    const data = skinBuffer.slice(pos, pos + len); pos += len;
    pos += 4; // skip CRC

    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === 'IDAT') {
      idatChunks.push(data);
    } else if (type === 'IEND') break;
  }

  // Only handle RGBA (colorType 6) or RGB (colorType 2)
  const hasAlpha = colorType === 6;
  const bytesPerPixel = hasAlpha ? 4 : 3;

  const compressed = Buffer.concat(idatChunks);
  const decompressed = zlib.inflateSync(compressed);

  // Reconstruct pixels with PNG filter decoding
  const pixels = new Array(height).fill(null).map(() => new Array(width).fill(null).map(() => [0,0,0,255]));
  const stride = 1 + width * bytesPerPixel; // filter byte + pixel data

  let prevRow = new Uint8Array(width * bytesPerPixel);

  for (let y = 0; y < height; y++) {
    const filterType = decompressed[y * stride];
    const rowData = decompressed.slice(y * stride + 1, y * stride + stride);
    const recon = new Uint8Array(width * bytesPerPixel);

    for (let i = 0; i < rowData.length; i++) {
      const a = i >= bytesPerPixel ? recon[i - bytesPerPixel] : 0;
      const b = prevRow[i];
      const c = i >= bytesPerPixel ? prevRow[i - bytesPerPixel] : 0;

      let val;
      if (filterType === 0) val = rowData[i];
      else if (filterType === 1) val = (rowData[i] + a) & 0xff;
      else if (filterType === 2) val = (rowData[i] + b) & 0xff;
      else if (filterType === 3) val = (rowData[i] + Math.floor((a + b) / 2)) & 0xff;
      else if (filterType === 4) val = (rowData[i] + paethPredictor(a, b, c)) & 0xff;
      else val = rowData[i];

      recon[i] = val;
    }

    for (let x = 0; x < width; x++) {
      const idx = x * bytesPerPixel;
      pixels[y][x] = [recon[idx], recon[idx+1], recon[idx+2], hasAlpha ? recon[idx+3] : 255];
    }
    prevRow = recon;
  }

  // Extract face region (8,8)-(16,16) = 8x8 pixels
  // Extract hat overlay (40,8)-(48,16) and composite on top
  const OUTPUT_SIZE = 64;
  const FACE_X = 8, FACE_Y = 8;
  const HAT_X = 40, HAT_Y = 8;
  const HEAD_SIZE = 8;

  const outPixels = new Array(OUTPUT_SIZE).fill(null).map(() =>
    new Array(OUTPUT_SIZE).fill(null).map(() => [0,0,0,255])
  );

  const scale = OUTPUT_SIZE / HEAD_SIZE;

  for (let py = 0; py < OUTPUT_SIZE; py++) {
    for (let px = 0; px < OUTPUT_SIZE; px++) {
      const srcX = Math.floor(px / scale);
      const srcY = Math.floor(py / scale);

      const faceX = FACE_X + srcX;
      const faceY = FACE_Y + srcY;

      let pixel = (pixels[faceY] && pixels[faceY][faceX]) ? pixels[faceY][faceX] : [0,0,0,255];

      // Composite hat layer on top if not transparent
      if (width >= 64) {
        const hatX = HAT_X + srcX;
        const hatY = HAT_Y + srcY;
        if (pixels[hatY] && pixels[hatY][hatX]) {
          const hat = pixels[hatY][hatX];
          if (hat[3] > 10) {
            const a = hat[3] / 255;
            pixel = [
              Math.round(hat[0]*a + pixel[0]*(1-a)),
              Math.round(hat[1]*a + pixel[1]*(1-a)),
              Math.round(hat[2]*a + pixel[2]*(1-a)),
              255
            ];
          }
        }
      }

      outPixels[py][px] = pixel;
    }
  }

  return writePng(outPixels, OUTPUT_SIZE, OUTPUT_SIZE);
}

function paethPredictor(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function writePng(pixels, w, h) {
  const zlib = require('zlib');
  // Build raw RGBA data
  let rawRows = Buffer.alloc(h * (1 + w * 4));
  for (let y = 0; y < h; y++) {
    rawRows[y * (1 + w*4)] = 0; // filter type None
    for (let x = 0; x < w; x++) {
      const p = pixels[y][x];
      const off = y * (1 + w*4) + 1 + x*4;
      rawRows[off]   = p[0];
      rawRows[off+1] = p[1];
      rawRows[off+2] = p[2];
      rawRows[off+3] = p[3] !== undefined ? p[3] : 255;
    }
  }

  const compressed = zlib.deflateSync(rawRows);

  function u32be(n) {
    const b = Buffer.alloc(4);
    b.writeUInt32BE(n, 0);
    return b;
  }

  function chunk(type, data) {
    const typeB = Buffer.from(type, 'ascii');
    const crcB = Buffer.alloc(4);
    crcB.writeUInt32BE(calcCrc(Buffer.concat([typeB, data])), 0);
    return Buffer.concat([u32be(data.length), typeB, data, crcB]);
  }

  function calcCrc(buf) {
    // CRC32 table
    if (!calcCrc.table) {
      calcCrc.table = new Int32Array(256);
      for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
        calcCrc.table[n] = c;
      }
    }
    let crc = -1;
    for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ calcCrc.table[(crc ^ buf[i]) & 0xff];
    return ((crc ^ -1) >>> 0);
  }

  const sig = Buffer.from([137,80,78,71,13,10,26,10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

module.exports = { fetchSkinHead };
