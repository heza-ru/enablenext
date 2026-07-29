const assert = require('assert');
const test = require('node:test');
const JSZip = require('jszip');
const { convertPptxToSchema } = require('../pptx-to-schema.js');

// Minimal single-slide OOXML fixture: one text box + one filled rectangle.
// EMU: 914400 per inch. A 2in x 1in text box at (1in, 0.5in):
const SLIDE_XML = `<?xml version="1.0"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
       xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:sp>
        <p:spPr>
          <a:xfrm><a:off x="914400" y="457200"/><a:ext cx="1828800" cy="914400"/></a:xfrm>
          <a:prstGeom prst="rect"/>
          <a:solidFill><a:srgbClr val="4A4560"/></a:solidFill>
        </p:spPr>
        <p:txBody><a:p><a:r><a:t>Hello Slide</a:t></a:r></a:p></p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>`;

test('convertPptxToSchema extracts one slide with a text+shape element', async () => {
  const zip = new JSZip();
  zip.file('ppt/presentation.xml', '<p:presentation/>');
  zip.file('ppt/slides/slide1.xml', SLIDE_XML);
  const buffer = await zip.generateAsync({ type: 'nodebuffer' });

  const result = await convertPptxToSchema(buffer);

  assert.strictEqual(result.slides.length, 1);
  const slide = result.slides[0];
  assert.strictEqual(typeof slide.componentId, 'string');
  assert.ok(slide.elements.length >= 1);

  const textEl = slide.elements.find((e) => e.type === 'text');
  assert.ok(textEl, 'expected a text element');
  assert.strictEqual(textEl.text, 'Hello Slide');
  assert.strictEqual(textEl.x, 1); // 914400 EMU / 914400 = 1in
  assert.strictEqual(textEl.y, 0.5);
  assert.strictEqual(textEl.w, 2);
  assert.strictEqual(textEl.h, 1);

  const shapeEl = slide.elements.find((e) => e.type === 'shape');
  assert.ok(shapeEl, 'expected a shape element for the fill');
  assert.strictEqual(shapeEl.fill, '4A4560');
});

test('convertPptxToSchema extracts embedded images into result.assets', async () => {
  const zip = new JSZip();
  zip.file('ppt/presentation.xml', '<p:presentation/>');
  zip.file('ppt/slides/slide1.xml', `<?xml version="1.0"?>
    <p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
           xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
           xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
      <p:cSld><p:spTree>
        <p:pic>
          <p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="914400" cy="914400"/></a:xfrm></p:spPr>
          <p:blipFill><a:blip r:embed="rId1"/></p:blipFill>
        </p:pic>
      </p:spTree></p:cSld>
    </p:sld>`);
  zip.file(
    'ppt/slides/_rels/slide1.xml.rels',
    `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
      <Relationship Id="rId1" Type="...image" Target="../media/image1.png"/>
    </Relationships>`,
  );
  zip.file('ppt/media/image1.png', Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  const buffer = await zip.generateAsync({ type: 'nodebuffer' });

  const result = await convertPptxToSchema(buffer);
  assert.strictEqual(result.assets.length, 1);
  assert.strictEqual(result.assets[0].filename, 'slide1-image1.png');
  const imgEl = result.slides[0].elements.find((e) => e.type === 'image');
  assert.ok(imgEl);
  assert.strictEqual(imgEl.deckAsset, 'slide1-image1.png');
});
