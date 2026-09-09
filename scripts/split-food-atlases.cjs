const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..', 'public');

async function dividerRanges(source, axis) {
  const { data, info } = await sharp(source).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const length = axis === 'row' ? info.height : info.width;
  const cross = axis === 'row' ? info.width : info.height;
  const scores = Array.from({ length }, (_, coordinate) => {
    let brightness = 0;
    for (let offset = 0; offset < cross; offset += 1) {
      const pixel = axis === 'row'
        ? (coordinate * info.width + offset) * 3
        : (offset * info.width + coordinate) * 3;
      brightness += (data[pixel] + data[pixel + 1] + data[pixel + 2]) / 3;
    }
    return brightness / cross;
  });
  const threshold = axis === 'row' ? 150 : 145;
  const dividerGroups = [];
  let start = null;
  scores.forEach((score, coordinate) => {
    if (score > threshold && start === null) start = coordinate;
    if (score <= threshold && start !== null) {
      dividerGroups.push([start, coordinate - 1]);
      start = null;
    }
  });
  if (start !== null) dividerGroups.push([start, length - 1]);
  const ranges = [];
  let cursor = 0;
  dividerGroups.forEach(([dividerStart, dividerEnd]) => {
    ranges.push([cursor, dividerStart]);
    cursor = dividerEnd + 1;
  });
  ranges.push([cursor, length]);
  return ranges;
}

async function writeCrop(source, output, left, top, width, height) {
  await sharp(source).extract({ left, top, width, height }).webp({ quality: 90 }).toFile(output);
}

async function splitChest(chestId) {
  const source = path.join(root, `food-chest-${chestId}-atlas.png`);
  const output = path.join(root, 'food', `chest-${chestId}`);
  const columns = await dividerRanges(source, 'column');
  const rows = await dividerRanges(source, 'row');
  fs.rmSync(output, { recursive: true, force: true });
  fs.mkdirSync(output, { recursive: true });
  const work = [];
  const availableRows = chestId === 1 ? rows.slice(0, 9) : rows;
  availableRows.forEach(([top, bottom], row) => columns.forEach(([left, right], column) => {
    const index = row * 5 + column;
    work.push(writeCrop(source, path.join(output, `${String(index).padStart(2, '0')}.webp`), left, top, right - left, bottom - top));
  }));
  if (chestId === 1) {
    const finalRow = path.join(root, 'food-chest-1-final-row.png');
    const metadata = await sharp(finalRow).metadata();
    for (let column = 0; column < 5; column += 1) {
      const left = Math.floor((column * metadata.width) / 5) + (column ? 2 : 0);
      const right = Math.floor(((column + 1) * metadata.width) / 5) - (column < 4 ? 2 : 0);
      work.push(writeCrop(finalRow, path.join(output, `${45 + column}.webp`), left, 0, right - left, metadata.height));
    }
  }
  await Promise.all(work);
}

Promise.all([1, 2, 3, 4, 5, 6].map(splitChest))
  .then(() => console.log('Created 300 independent food image files.'))
  .catch((error) => { console.error(error); process.exitCode = 1; });
