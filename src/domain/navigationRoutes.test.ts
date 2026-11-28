import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildShareUrl,
  getEntityPath,
  getSectionPath,
  getSectionTitle,
  HEADER_NAV_ITEMS,
  isPrimarySpaNavigationClick,
  normalizePathname,
  resolveRouteFromPath,
  resolveSectionFromPath,
  SECTION_ROUTE_PATHS,
  type NavSection,
} from './navigationRoutes';

describe('navigationRoutes', () => {
  it('omits Inicio from HEADER_NAV_ITEMS and maps exact requested paths', () => {
    const ids = HEADER_NAV_ITEMS.map((i) => i.id);
    assert.equal(ids.includes('inicio'), false);
    assert.deepEqual(
      HEADER_NAV_ITEMS.map((i) => [i.id, i.href]),
      [
        ['posiciones', '/tabla-posiciones'],
        ['equipos', '/equipos'],
        ['jugadores', '/jugadores'],
        ['votaciones', '/votaciones'],
        ['minijuegos', '/minijuegos'],
        ['galeria', '/galeria'],
        ['inscripciones', '/inscripciones'],
      ]
    );
    assert.equal(getSectionPath('inicio'), '/');
  });

  it('round-trips every NavSection between getSectionPath and resolveSectionFromPath', () => {
    const sections = Object.keys(SECTION_ROUTE_PATHS) as NavSection[];
    for (const section of sections) {
      const path = getSectionPath(section);
      assert.equal(resolveSectionFromPath(path), section, `Round-trip failed for ${section} (${path})`);
      assert.ok(getSectionTitle(section).includes('Campeonato Intercarreras UFRO'));
    }
  });

  it('normalizes trailing slashes, uppercase letters, duplicate slashes, and legacy aliases', () => {
    assert.equal(normalizePathname('/Tabla-Posiciones/'), '/tabla-posiciones');
    assert.equal(normalizePathname('///EQUIPOS///?tab=1'), '/equipos');
    assert.equal(resolveSectionFromPath('/TABLA-POSICIONES/'), 'posiciones');
    assert.equal(resolveSectionFromPath('/posiciones'), 'posiciones');
    assert.equal(resolveSectionFromPath('/GALERIA/'), 'galeria');
    assert.equal(resolveSectionFromPath('/politica-de-privacidad'), 'privacidad');
    assert.equal(resolveSectionFromPath('/ruta-inexistente'), 'inicio');
  });

  it('resolves direct entity deep-link URLs for teams, matches, and news preserving case-sensitive IDs', () => {
    assert.deepEqual(resolveRouteFromPath('/equipos/team-IngCivil-2026'), {
      section: 'equipos',
      entity: { type: 'team', id: 'team-IngCivil-2026' },
    });
    assert.deepEqual(resolveRouteFromPath('/partidos/match_F7_12/'), {
      section: 'posiciones',
      entity: { type: 'match', id: 'match_F7_12' },
    });
    assert.deepEqual(resolveRouteFromPath('/noticias/news-987?utm_source=whatsapp'), {
      section: 'inicio',
      entity: { type: 'news', id: 'news-987' },
    });
    assert.deepEqual(resolveRouteFromPath('/equipos/club%20ufro%2F1'), {
      section: 'equipos',
      entity: { type: 'team', id: 'club ufro/1' },
    });
    assert.equal(getEntityPath('team', 'team-IngCivil-2026'), '/equipos/team-IngCivil-2026');
    assert.equal(getEntityPath('match', 'match_F7_12'), '/partidos/match_F7_12');
    assert.equal(getEntityPath('news', 'news-987'), '/noticias/news-987');
    assert.equal(
      buildShareUrl('https://intercarreras.ufro.cl/', 'match', 'match_F7_12'),
      'https://intercarreras.ufro.cl/partidos/match_F7_12'
    );
  });

  it('identifies primary left clicks for SPA interception while preserving modifier clicks for new tabs', () => {
    assert.equal(
      isPrimarySpaNavigationClick({
        defaultPrevented: false,
        button: 0,
        metaKey: false,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
      }),
      true
    );
    assert.equal(
      isPrimarySpaNavigationClick({
        defaultPrevented: false,
        button: 0,
        metaKey: true,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
      }),
      false
    );
    assert.equal(
      isPrimarySpaNavigationClick({
        defaultPrevented: false,
        button: 1,
        metaKey: false,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
      }),
      false
    );
  });
});
