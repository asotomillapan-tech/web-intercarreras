import assert from 'node:assert/strict';
import test from 'node:test';
import {
  removeWhiteBackgroundFromPixels,
  sanitizeSvgMarkup,
} from './crestProcessor.ts';

test('sanitizeSvgMarkup accepts clean SVG and returns base64 data URI', () => {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="28" fill="#707ef9"/></svg>';
  const res = sanitizeSvgMarkup(svg);
  assert.equal(res.ok, true);
  assert.equal(res.format, 'svg');
  assert.ok(res.dataUrl?.startsWith('data:image/svg+xml;base64,'));
});

test('sanitizeSvgMarkup strips scripts, event handlers, foreignObject, and javascript hrefs', () => {
  const malicious = `
    <svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)">
      <script>alert("xss")</script>
      <foreignObject><body><iframe src="https://evil.test"></iframe></body></foreignObject>
      <a href="javascript:alert(2)"><rect width="50" height="50" onclick="steal()" fill="#0d0d0d"/></a>
    </svg>
  `;
  const res = sanitizeSvgMarkup(malicious);
  assert.equal(res.ok, true);
  const decoded = Buffer.from(
    res.dataUrl!.replace('data:image/svg+xml;base64,', ''),
    'base64'
  ).toString('utf-8');
  assert.equal(/<script/i.test(decoded), false);
  assert.equal(/foreignObject/i.test(decoded), false);
  assert.equal(/onload=/i.test(decoded), false);
  assert.equal(/onclick=/i.test(decoded), false);
  assert.equal(/javascript:/i.test(decoded), false);
  assert.equal(/<rect/i.test(decoded), true);
});

test('removeWhiteBackgroundFromPixels clears outer white border but preserves enclosed interior white', () => {
  // 5x5 image:
  // Outer ring (border) = pure white (255,255,255,255)
  // Middle ring (x=1..3, y=1..3 except center) = dark shield border (13,13,13,255)
  // Center pixel (2,2) = interior white star (255,255,255,255)
  const w = 5;
  const h = 5;
  const rgba = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const isBorder = x === 0 || y === 0 || x === w - 1 || y === h - 1;
      const isCenter = x === 2 && y === 2;
      if (isBorder || isCenter) {
        rgba[idx] = 255;
        rgba[idx + 1] = 255;
        rgba[idx + 2] = 255;
        rgba[idx + 3] = 255;
      } else {
        rgba[idx] = 13;
        rgba[idx + 1] = 13;
        rgba[idx + 2] = 13;
        rgba[idx + 3] = 255;
      }
    }
  }

  const out = removeWhiteBackgroundFromPixels(rgba, w, h, 235);

  // Corner pixel (0,0) must be fully transparent
  assert.equal(out[3], 0);
  // Dark border pixel (1,1) must stay fully opaque
  assert.equal(out[(1 * w + 1) * 4 + 3], 255);
  // Enclosed interior white pixel (2,2) must remain fully opaque!
  assert.equal(out[(2 * w + 2) * 4 + 3], 255);
});
