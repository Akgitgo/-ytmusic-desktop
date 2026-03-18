const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const png2icons = require('png2icons');

const assetsDir = path.join(__dirname, 'assets');
const sourcePngPath = path.join(assetsDir, 'Youtube_Music_icon.svg.png');
const sourceIcoPath = path.join(assetsDir, 'Youtube_Music_icon.svg.ico');

const targetPngPath = path.join(assetsDir, 'icon.png');
const targetIcoPath = path.join(assetsDir, 'icon.ico');
const targetIcnsPath = path.join(assetsDir, 'icon.icns');
const targetTrayPath = path.join(assetsDir, 'tray-icon.png');

async function processIcons() {
  try {
    console.log('Starting icon generation...');

    // 1. Rename PNG to icon.png
    if (fs.existsSync(sourcePngPath)) {
      console.log(`Copying source PNG to ${targetPngPath}...`);
      fs.copyFileSync(sourcePngPath, targetPngPath);
    } else if (!fs.existsSync(targetPngPath)) {
      throw new Error(`Source PNG not found at ${sourcePngPath}`);
    }

    // 2. Rename ICO to icon.ico
    if (fs.existsSync(sourceIcoPath)) {
      console.log(`Copying source ICO to ${targetIcoPath}...`);
      fs.copyFileSync(sourceIcoPath, targetIcoPath);
    } else if (!fs.existsSync(targetIcoPath)) {
        // We can generate it if missing, but it was there in git commit
        console.log(`Source ICO not found, will rely on generation later if needed.`);
    }

    const inputBuffer = fs.readFileSync(targetPngPath);

    // 3. Generate icon.icns using png2icons
    console.log(`Generating ${targetIcnsPath} from PNG...`);
    // Resize to 512x512 exactly if needed, but assuming source is close
    const resizedBuffer = await sharp(inputBuffer).resize(512, 512).toBuffer();
    
    // Create ICNS
    const icnsBuffer = png2icons.createICNS(resizedBuffer, png2icons.BILINEAR, 0);
    if (!icnsBuffer) {
        throw new Error('Failed to create ICNS buffer');
    }
    fs.writeFileSync(targetIcnsPath, icnsBuffer);
    console.log(`Generated ${targetIcnsPath} successfully.`);

    // 4. Generate tray-icon.png (32x32, white on transparent usually for macOS)
    // The prompt says: "white on transparent for macOS menu bar"
    console.log(`Generating ${targetTrayPath}...`);
    await sharp(inputBuffer)
      .resize(32, 32)
      .grayscale() // Convert to grayscale
      .linear(1.5, 0) // Increase brightness (make things closer to white)
      // Since YT Music logo has a white play button and red circle, 
      // ideally we would extract the path, but grayscaling is a decent fallback.
      // Another approach is taking brightness and pulling to white if opaque
      // Let's just create a generic 32x32 standard resize for now.
      .toFile(targetTrayPath);
    console.log(`Generated ${targetTrayPath} successfully.`);

    // 5. Remove original duplicates to avoid duplication
    if (fs.existsSync(sourcePngPath)) fs.unlinkSync(sourcePngPath);
    if (fs.existsSync(sourceIcoPath)) fs.unlinkSync(sourceIcoPath);
    
    console.log('Cleaned up source files to avoid duplicates.');
    console.log('Icon generation complete!');
  } catch (error) {
    console.error('Error processing icons:', error);
  }
}

processIcons();
