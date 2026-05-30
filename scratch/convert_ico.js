const fs = require('fs');
const path = require('path');

const pngPath = path.join(__dirname, '../public/logo.png');
const icoPath = path.join(__dirname, '../public/favicon.ico');

try {
  const pngBuffer = fs.readFileSync(pngPath);
  const pngSize = pngBuffer.length;

  // Create 22-byte ICO header
  const header = Buffer.alloc(22);

  // ICO Header
  header.writeUInt16LE(0, 0);     // Reserved
  header.writeUInt16LE(1, 2);     // Type (1 = ICO)
  header.writeUInt16LE(1, 4);     // Image count (1)

  // Directory Entry
  header.writeUInt8(0, 6);        // Width (0 = 256px)
  header.writeUInt8(0, 7);        // Height (0 = 256px)
  header.writeUInt8(0, 8);        // Color count (0)
  header.writeUInt8(0, 9);        // Reserved
  header.writeUInt16LE(1, 10);    // Color planes (1)
  header.writeUInt16LE(32, 12);   // Bits per pixel (32)
  header.writeUInt32LE(pngSize, 14); // Image data size
  header.writeUInt32LE(22, 18);   // Offset of image data (22)

  // Combine header and PNG data
  const icoBuffer = Buffer.concat([header, pngBuffer]);

  fs.writeFileSync(icoPath, icoBuffer);
  console.log('Successfully generated public/favicon.ico from public/logo.png!');
} catch (err) {
  console.error('ICO generation failed:', err);
  process.exit(1);
}
