// Reusable PPTX -> schema-JSON converter (Presentation Engine v2, Task 3).
// Not part of the browser bundle -- run offline/on-demand against any
// reference .pptx (the master deck now, a different deck in the future).
// Uses lightweight regex-based OOXML extraction (same EMU-to-inches
// technique already used elsewhere in this codebase) rather than a full
// XML-parser dependency, since the shapes we care about (a:sp text/fill,
// p:pic images, a:xfrm geometry) are a small, well-known, fixed subset of
// the OOXML schema.
const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const EMU_PER_INCH = 914400;

function emuToInches(emu) {
  return Math.round((Number(emu) / EMU_PER_INCH) * 100) / 100;
}

function extractXfrm(shapeXml) {
  const off = shapeXml.match(/<a:off x="(-?\d+)" y="(-?\d+)"\/>/);
  const ext = shapeXml.match(/<a:ext cx="(\d+)" cy="(\d+)"\/>/);
  if (!off || !ext) return null;
  return {
    x: emuToInches(off[1]),
    y: emuToInches(off[2]),
    w: emuToInches(ext[1]),
    h: emuToInches(ext[2]),
  };
}

function extractShapes(slideXml, rels, mediaByRelId, slideIndex, assets) {
  const elements = [];
  let idx = 0;

  // p:sp (text box / filled shape)
  const spRe = /<p:sp>([\s\S]*?)<\/p:sp>/g;
  let m;
  while ((m = spRe.exec(slideXml))) {
    const shapeXml = m[1];
    const rect = extractXfrm(shapeXml);
    if (!rect) continue;

    const fillMatch = shapeXml.match(/<a:solidFill><a:srgbClr val="([0-9A-Fa-f]{6})"\/>/);
    if (fillMatch) {
      elements.push({ type: 'shape', shape: 'rect', fill: fillMatch[1], ...rect });
    }

    const textMatches = [...shapeXml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((t) => t[1]).join('');
    if (textMatches.trim().length > 0) {
      elements.push({ type: 'text', text: textMatches, ...rect });
    }
    idx++;
  }

  // p:pic (image)
  const picRe = /<p:pic>([\s\S]*?)<\/p:pic>/g;
  let picIdx = 0;
  while ((m = picRe.exec(slideXml))) {
    const picXml = m[1];
    const rect = extractXfrm(picXml);
    const relMatch = picXml.match(/r:embed="(rId\d+)"/);
    if (!rect || !relMatch) continue;
    const relId = relMatch[1];
    const mediaPath = mediaByRelId[relId];
    if (!mediaPath) continue;
    picIdx++;
    const ext = path.extname(mediaPath);
    const filename = 'slide' + slideIndex + '-image' + picIdx + ext;
    assets.push({ filename: filename, mediaPath: mediaPath });
    elements.push({ type: 'image', deckAsset: filename, ...rect });
  }

  return elements;
}

function parseRels(relsXml) {
  const map = {};
  if (!relsXml) return map;
  const re = /<Relationship Id="(rId\d+)"[^>]*Target="([^"]+)"/g;
  let m;
  while ((m = re.exec(relsXml))) {
    map[m[1]] = m[2].replace(/^\.\.\//, 'ppt/');
  }
  return map;
}

async function convertPptxToSchema(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const slideFiles = Object.keys(zip.files)
    .filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f))
    .sort((a, b) => {
      const na = Number(a.match(/slide(\d+)\.xml/)[1]);
      const nb = Number(b.match(/slide(\d+)\.xml/)[1]);
      return na - nb;
    });

  const slides = [];
  const assetRefs = [];

  for (const slideFile of slideFiles) {
    const slideIndex = Number(slideFile.match(/slide(\d+)\.xml/)[1]);
    const slideXml = await zip.file(slideFile).async('string');
    const relsFile = 'ppt/slides/_rels/slide' + slideIndex + '.xml.rels';
    const relsXml = zip.file(relsFile) ? await zip.file(relsFile).async('string') : null;
    const mediaByRelId = parseRels(relsXml);

    const elements = extractShapes(slideXml, relsXml, mediaByRelId, slideIndex, assetRefs);
    slides.push({ componentId: 'slide-' + slideIndex, elements: elements });
  }

  const assets = [];
  for (const ref of assetRefs) {
    const mediaFile = zip.file(ref.mediaPath);
    if (!mediaFile) continue;
    const data = await mediaFile.async('nodebuffer');
    assets.push({ filename: ref.filename, data: data });
  }

  return { slides: slides, assets: assets };
}

async function main() {
  const [, , inputPath, outputPath, ...rest] = process.argv;
  if (!inputPath || !outputPath) {
    console.error('Usage: node scripts/pptx-to-schema.js <input.pptx> <output.json> [--assets-dir=<dir>]');
    process.exit(1);
  }
  const assetsDirArg = rest.find((a) => a.startsWith('--assets-dir='));
  const assetsDir = assetsDirArg ? assetsDirArg.split('=')[1] : 'client/public/deck-assets';

  const buffer = fs.readFileSync(inputPath);
  const result = await convertPptxToSchema(buffer);

  fs.mkdirSync(assetsDir, { recursive: true });
  for (const asset of result.assets) {
    fs.writeFileSync(path.join(assetsDir, asset.filename), asset.data);
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify({ slides: result.slides }, null, 2));

  console.log(
    'Wrote ' + result.slides.length + ' slide(s) to ' + outputPath +
      ' and ' + result.assets.length + ' asset(s) to ' + assetsDir,
  );
}

module.exports = { convertPptxToSchema: convertPptxToSchema };

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
