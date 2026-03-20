const pngToIco = require('png-to-ico');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const assetsDir = path.join(__dirname, 'assets');
const sourcePng = path.join(assetsDir, 'icon.png');
const targetIco = path.join(assetsDir, 'icon.ico');

// Check what pngToIco exports
console.log('pngToIco type:', typeof pngToIco);
console.log('pngToIco keys:', Object.keys(pngToIco));

async function run() {
  try {
    const fn = typeof pngToIco === 'function' ? pngToIco : pngToIco.default || pngToIco.pngToIco;
    console.log('Using fn:', typeof fn);

    const sizes = [16, 32, 48, 64, 128, 256];
    const buffers = await Promise.all(
      sizes.map(s => sharp(sourcePng).resize(s, s).png().toBuffer())
    );

    const icoBuffer = await fn(buffers);
    fs.writeFileSync(targetIco, icoBuffer);
    console.log(`✅ Valid icon.ico written (${icoBuffer.length} bytes)`);
  } catch (err) {
    console.error('Failed:', err.message);
    process.exit(1);
  }
}

run();
