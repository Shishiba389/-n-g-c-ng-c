const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..', 'public', 'food');
const files = [];
for (const chest of fs.readdirSync(root)) {
  for (const file of fs.readdirSync(path.join(root, chest))) {
    if (file.endsWith('.webp') && !file.endsWith('-hd.webp')) files.push(path.join(root, chest, file));
  }
}

Promise.all(files.map(async (file) => {
  const image = sharp(file);
  const metadata = await image.metadata();
  const scale = Math.max(1, Math.ceil(640 / Math.min(metadata.width, metadata.height)));
  if (scale === 1) return;
  const output = file.replace(/\.webp$/, '-hd.webp');
  await image
    .resize(metadata.width * scale, metadata.height * scale, { kernel: sharp.kernel.lanczos3 })
    .sharpen({ sigma: 0.8, m1: 0.6, m2: 1.2 })
    .webp({ quality: 96 })
    .toFile(output);
})).then(() => console.log(`Upscaled ${files.length} food images.`));
