import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyToolbarFormat,
  parseSimpleRichText,
  sanitizeSafeNewsUrl,
  sortNewsForHomepage,
} from './newsFormatter';
import type { NewsArticle } from '../types/tournament';

test('sanitizeSafeNewsUrl accepts https/http/assets and blocks javascript/data protocols', () => {
  assert.equal(sanitizeSafeNewsUrl('https://intercarreras.vercel.app/privacidad'), 'https://intercarreras.vercel.app/privacidad');
  assert.equal(sanitizeSafeNewsUrl('/assets/aistudio/logo.svg'), '/assets/aistudio/logo.svg');
  assert.equal(sanitizeSafeNewsUrl('javascript:alert(1)'), null);
  assert.equal(sanitizeSafeNewsUrl('data:text/html,<script>alert(1)</script>'), null);
  assert.equal(sanitizeSafeNewsUrl('vbscript:msgbox(1)'), null);
});

test('parseSimpleRichText parses headings, bold, italic, lists, quotes, and strips unsafe link schemes', () => {
  const input = [
    '## Resumen de la Fecha 3',
    'Gran jornada con **Informática FC** liderando en *Primera División*.',
    '- Ganaron 4-1 en Cancha 1',
    '- Revisa el [reglamento](https://intercarreras.vercel.app/) y [malicioso](javascript:alert(1))',
    '> El espíritu deportivo de la UFRO brilló en cancha.',
  ].join('\n');

  const blocks = parseSimpleRichText(input);
  assert.equal(blocks.length, 4);
  assert.deepEqual(blocks[0], { type: 'heading', text: 'Resumen de la Fecha 3' });

  assert.equal(blocks[1].type, 'paragraph');
  if (blocks[1].type === 'paragraph') {
    assert.ok(blocks[1].segments.some((s) => s.type === 'bold' && s.text === 'Informática FC'));
    assert.ok(blocks[1].segments.some((s) => s.type === 'italic' && s.text === 'Primera División'));
  }

  assert.equal(blocks[2].type, 'list');
  if (blocks[2].type === 'list') {
    assert.equal(blocks[2].items.length, 2);
    const secondItem = blocks[2].items[1];
    assert.ok(secondItem.some((s) => s.type === 'link' && s.href === 'https://intercarreras.vercel.app/'));
    // Unsafe javascript: link must downgrade to plain text
    assert.ok(!secondItem.some((s) => s.type === 'link' && s.href.includes('javascript:')));
    assert.ok(secondItem.some((s) => s.type === 'text' && s.text === 'malicioso'));
  }

  assert.equal(blocks[3].type, 'quote');
});

test('applyToolbarFormat wraps selected text and inserts templates cleanly', () => {
  const bold = applyToolbarFormat('Hola UFRO mundo', 5, 9, 'bold');
  assert.equal(bold.nextValue, 'Hola **UFRO** mundo');
  assert.equal(bold.nextStart, 7);
  assert.equal(bold.nextEnd, 11);

  const heading = applyToolbarFormat('Intro', 5, 5, 'heading');
  assert.equal(heading.nextValue, 'Intro\n\n## Subtítulo de la noticia');

  const list = applyToolbarFormat('Punto A\nPunto B', 0, 15, 'list');
  assert.equal(list.nextValue, '- Punto A\n- Punto B');
});

test('sortNewsForHomepage hides unpublished drafts and prioritizes featured articles then newest', () => {
  const base: Omit<NewsArticle, 'id' | 'featured' | 'published' | 'createdAt'> = {
    title: 'Nota',
    summary: 'Resumen breve de prueba',
    content: 'Contenido completo de prueba',
    category: 'ANUNCIO',
    authorUid: 'u-1',
    authorName: 'Prensa UFRO',
    authorRole: 'prensa',
    updatedAt: '2026-05-01T10:00:00Z',
  };

  const articles: NewsArticle[] = [
    { ...base, id: 'draft', featured: true, published: false, createdAt: '2026-05-10T10:00:00Z' },
    { ...base, id: 'normal-new', featured: false, published: true, createdAt: '2026-05-09T10:00:00Z' },
    { ...base, id: 'feat-old', featured: true, published: true, createdAt: '2026-05-05T10:00:00Z' },
    { ...base, id: 'feat-new', featured: true, published: true, createdAt: '2026-05-08T10:00:00Z' },
  ];

  const sorted = sortNewsForHomepage(articles);
  assert.equal(sorted.allPublished.length, 3);
  assert.equal(sorted.primary?.id, 'feat-new');
  assert.deepEqual(
    sorted.secondary.map((a) => a.id),
    ['feat-old', 'normal-new']
  );
});
