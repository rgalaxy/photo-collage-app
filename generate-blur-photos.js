const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const inputDir = './public/photos';
const outputJson = './public/assets/photo-blurs.json';

const imageFiles = fs.readdirSync(inputDir).filter(f => /\.(jpg|jpeg|png)$/i.test(f));

const promises = imageFiles.map(filename => {
  const fullPath = path.join(inputDir, filename);

  return sharp(fullPath)
    .resize(20) // really small version
    .blur()
    .toBuffer()
    .then(buffer => ({
      file: filename,
      blurDataUrl: `data:image/jpeg;base64,${buffer.toString('base64')}`,
    }));
});

Promise.all(promises)
  .then(results => {
    const map = {};
    results.forEach(r => (map[r.file] = r.blurDataUrl));
    fs.writeFileSync(outputJson, JSON.stringify(map, null, 2));
  })
  .catch(err => console.error('Error:', err));
