import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  escapeHtmlAttr,
  injectOpenGraphMetadata,
  resolvePublicOrigin,
  toAbsoluteImageUrl,
} from './seoMeta.ts';

describe('seoMeta', () => {
  it('escapes HTML special characters safely in attributes', () => {
    assert.equal(
      escapeHtmlAttr('Final "UFRO" <2026> & Más'),
      'Final &quot;UFRO&quot; &lt;2026&gt; &amp; Más'
    );
  });

  it('resolves public origin from APP_URL or forwarded host headers', () => {
    assert.equal(
      resolvePublicOrigin({ envAppUrl: 'https://intercarreras.ufro.cl/' }),
      'https://intercarreras.ufro.cl'
    );
    assert.equal(
      resolvePublicOrigin({ protocol: 'https,http', host: 'ufro.example.com' }),
      'https://ufro.example.com'
    );
  });

  it('converts relative OG images to absolute URLs and preserves external HTTPS URLs', () => {
    assert.equal(
      toAbsoluteImageUrl('https://intercarreras.ufro.cl', '/og-intercarreras.png'),
      'https://intercarreras.ufro.cl/og-intercarreras.png'
    );
    assert.equal(
      toAbsoluteImageUrl('https://intercarreras.ufro.cl', 'https://cdn.example.com/photo.jpg'),
      'https://cdn.example.com/photo.jpg'
    );
    assert.equal(
      toAbsoluteImageUrl('https://intercarreras.ufro.cl', ''),
      'https://intercarreras.ufro.cl/og-intercarreras.png'
    );
  });

  it('injects dynamic title, description, canonical, og:image, and twitter:image into index.html', () => {
    const sampleHtml = `<!doctype html><html><head>
      <title>Campeonato Intercarreras UFRO</title>
      <meta name="description" content="Base" />
      <meta property="og:type" content="website" />
      <meta property="og:title" content="Base" />
      <meta property="og:description" content="Base" />
      <meta property="og:image" content="/og-intercarreras.png" />
      <meta name="twitter:title" content="Base" />
      <meta name="twitter:description" content="Base" />
      <meta name="twitter:image" content="/og-intercarreras.png" />
    </head><body></body></html>`;

    const rendered = injectOpenGraphMetadata(sampleHtml, {
      title: 'Ing. Civil 3 - 1 Medicina · Campeonato Intercarreras UFRO',
      description: 'Ficha oficial del partido.',
      canonicalUrl: 'https://intercarreras.ufro.cl/partidos/m-12',
      imageUrl: 'https://intercarreras.ufro.cl/og-intercarreras.png',
      ogType: 'website',
    });

    assert.ok(rendered.includes('<title>Ing. Civil 3 - 1 Medicina · Campeonato Intercarreras UFRO</title>'));
    assert.ok(
      rendered.includes(
        '<meta property="og:image" content="https://intercarreras.ufro.cl/og-intercarreras.png" />'
      )
    );
    assert.ok(
      rendered.includes(
        '<link rel="canonical" href="https://intercarreras.ufro.cl/partidos/m-12" />'
      )
    );
  });
});
