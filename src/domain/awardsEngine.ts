import type {
  ChampionshipMvpVoteRecord,
  DisciplineId,
  DisciplineTotyConfig,
  Player,
  PositionAwardVoteRecord,
  SportType,
  Team,
  TotyBallotRecord,
} from '../types/tournament';

export interface PositionCategoryMeta {
  key: string;
  label: string;
  awardTitle: string;
  shortCode: string;
  totyRow: number; // Tactical visual row (0 = back/goal, higher = attack)
  matchKeywords: string[];
}

export const SPORT_POSITIONS: Record<SportType, PositionCategoryMeta[]> = {
  futbol7: [
    {
      key: 'arquero',
      label: 'Arquero / Portero',
      awardTitle: 'Mejor Arquero',
      shortCode: 'ARQ',
      totyRow: 0,
      matchKeywords: ['arquero', 'portero', 'guardameta', 'golero', 'arq', 'gk'],
    },
    {
      key: 'defensa',
      label: 'Defensa',
      awardTitle: 'Mejor Defensa',
      shortCode: 'DEF',
      totyRow: 1,
      matchKeywords: ['defensa', 'central', 'lateral', 'zaguero', 'carrilero', 'def', 'libero'],
    },
    {
      key: 'mediocampista',
      label: 'Mediocampista',
      awardTitle: 'Mejor Mediocampista',
      shortCode: 'MED',
      totyRow: 2,
      matchKeywords: ['medio', 'volante', 'interior', 'enganche', 'contencion', 'pivote', 'med', 'mixto'],
    },
    {
      key: 'delantero',
      label: 'Delantero',
      awardTitle: 'Mejor Delantero',
      shortCode: 'DEL',
      totyRow: 3,
      matchKeywords: ['delantero', 'extremo', 'punta', 'atacante', 'ariete', 'centrodelantero', 'del'],
    },
  ],
  basquetbol: [
    {
      key: 'base',
      label: 'Base (PG)',
      awardTitle: 'Mejor Base',
      shortCode: 'PG',
      totyRow: 0,
      matchKeywords: ['base', 'armador', 'point', 'pg', 'conductor'],
    },
    {
      key: 'escolta',
      label: 'Escolta (SG)',
      awardTitle: 'Mejor Escolta',
      shortCode: 'SG',
      totyRow: 1,
      matchKeywords: ['escolta', 'shooting', 'sg', 'tirador', 'perimetral'],
    },
    {
      key: 'alero',
      label: 'Alero (SF)',
      awardTitle: 'Mejor Alero',
      shortCode: 'SF',
      totyRow: 1,
      matchKeywords: ['alero', 'small', 'sf', 'ala '],
    },
    {
      key: 'ala_pivot',
      label: 'Ala-Pívot (PF)',
      awardTitle: 'Mejor Ala-Pívot',
      shortCode: 'PF',
      totyRow: 2,
      matchKeywords: ['ala-pivot', 'ala pivot', 'alapivot', 'power', 'pf'],
    },
    {
      key: 'pivot',
      label: 'Pívot (C)',
      awardTitle: 'Mejor Pívot',
      shortCode: 'C',
      totyRow: 2,
      matchKeywords: ['pivot', 'pívot', 'centro', 'center', 'poste', 'interior'],
    },
  ],
  basquetbol3x3: [
    {
      key: 'base',
      label: 'Base / Perimetral',
      awardTitle: 'Mejor Base / Perimetral',
      shortCode: 'PER',
      totyRow: 0,
      matchKeywords: ['base', 'escolta', 'perimetral', 'guard', 'armador', 'pg', 'sg'],
    },
    {
      key: 'alero',
      label: 'Alero / Versátil',
      awardTitle: 'Mejor Alero',
      shortCode: 'ALE',
      totyRow: 1,
      matchKeywords: ['alero', 'ala', 'wing', 'sf', 'pf'],
    },
    {
      key: 'pivot',
      label: 'Pívot / Interior',
      awardTitle: 'Mejor Pívot',
      shortCode: 'PIV',
      totyRow: 2,
      matchKeywords: ['pivot', 'pívot', 'interior', 'centro', 'poste', 'center'],
    },
  ],
  voleibol: [
    {
      key: 'armador',
      label: 'Armador / Levantador',
      awardTitle: 'Mejor Armador',
      shortCode: 'ARM',
      totyRow: 0,
      matchKeywords: ['armador', 'levantador', 'colocador', 'setter', 'arm'],
    },
    {
      key: 'punta',
      label: 'Punta Receptor',
      awardTitle: 'Mejor Punta Receptor',
      shortCode: 'PTA',
      totyRow: 1,
      matchKeywords: ['punta', 'receptor', 'exterior', 'banda', 'outside', 'atacante'],
    },
    {
      key: 'central',
      label: 'Central / Bloqueador',
      awardTitle: 'Mejor Central',
      shortCode: 'CEN',
      totyRow: 2,
      matchKeywords: ['central', 'bloqueador', 'middle', 'medio'],
    },
    {
      key: 'opuesto',
      label: 'Opuesto',
      awardTitle: 'Mejor Opuesto',
      shortCode: 'OPU',
      totyRow: 1,
      matchKeywords: ['opuesto', 'opposite', 'salida'],
    },
    {
      key: 'libero',
      label: 'Líbero',
      awardTitle: 'Mejor Líbero',
      shortCode: 'LIB',
      totyRow: 0,
      matchKeywords: ['libero', 'líbero', 'defensa'],
    },
  ],
};

function normalizeStr(val: string): string {
  return val
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export interface TotyFormationSlot {
  slotKey: string;
  positionKey: string;
  label: string;
  shortCode: string;
  row: number; // Tactical visual row (0 = bottom/goal/libero, higher = top/attack/net)
  rowLabel: string;
  isLibero?: boolean;
}

export interface TotyFormationConfig {
  sportType: SportType;
  formationName: string;
  summaryText: string;
  slots: TotyFormationSlot[];
}

export const TOTY_FORMATIONS: Record<SportType, TotyFormationConfig> = {
  futbol7: {
    sportType: 'futbol7',
    formationName: 'Formación 1-2-2-2',
    summaryText: '1 Portero · 2 Defensas · 2 Mediocampistas · 2 Delanteros',
    slots: [
      {
        slotKey: 'arquero',
        positionKey: 'arquero',
        label: 'Portero',
        shortCode: 'ARQ',
        row: 0,
        rowLabel: 'Portería (1)',
      },
      {
        slotKey: 'defensa_1',
        positionKey: 'defensa',
        label: 'Defensa 1',
        shortCode: 'DEF 1',
        row: 1,
        rowLabel: 'Defensa (2)',
      },
      {
        slotKey: 'defensa_2',
        positionKey: 'defensa',
        label: 'Defensa 2',
        shortCode: 'DEF 2',
        row: 1,
        rowLabel: 'Defensa (2)',
      },
      {
        slotKey: 'mediocampista_1',
        positionKey: 'mediocampista',
        label: 'Mediocampista 1',
        shortCode: 'MED 1',
        row: 2,
        rowLabel: 'Mediocampo (2)',
      },
      {
        slotKey: 'mediocampista_2',
        positionKey: 'mediocampista',
        label: 'Mediocampista 2',
        shortCode: 'MED 2',
        row: 2,
        rowLabel: 'Mediocampo (2)',
      },
      {
        slotKey: 'delantero_1',
        positionKey: 'delantero',
        label: 'Delantero 1',
        shortCode: 'DEL 1',
        row: 3,
        rowLabel: 'Delantera (2)',
      },
      {
        slotKey: 'delantero_2',
        positionKey: 'delantero',
        label: 'Delantero 2',
        shortCode: 'DEL 2',
        row: 3,
        rowLabel: 'Delantera (2)',
      },
    ],
  },
  basquetbol: {
    sportType: 'basquetbol',
    formationName: 'Quinteto Ideal 5x5',
    summaryText: 'Base (PG) · Escolta (SG) · Alero (SF) · Ala-Pívot (PF) · Pívot (C)',
    slots: [
      {
        slotKey: 'base',
        positionKey: 'base',
        label: 'Base (PG)',
        shortCode: 'PG',
        row: 0,
        rowLabel: 'Conducción (1)',
      },
      {
        slotKey: 'escolta',
        positionKey: 'escolta',
        label: 'Escolta (SG)',
        shortCode: 'SG',
        row: 1,
        rowLabel: 'Perímetro / Alas (2)',
      },
      {
        slotKey: 'alero',
        positionKey: 'alero',
        label: 'Alero (SF)',
        shortCode: 'SF',
        row: 1,
        rowLabel: 'Perímetro / Alas (2)',
      },
      {
        slotKey: 'ala_pivot',
        positionKey: 'ala_pivot',
        label: 'Ala-Pívot (PF)',
        shortCode: 'PF',
        row: 2,
        rowLabel: 'Juego Interior (2)',
      },
      {
        slotKey: 'pivot',
        positionKey: 'pivot',
        label: 'Pívot (C)',
        shortCode: 'C',
        row: 2,
        rowLabel: 'Juego Interior (2)',
      },
    ],
  },
  basquetbol3x3: {
    sportType: 'basquetbol3x3',
    formationName: 'Trío Ideal 3x3',
    summaryText: 'Base / Perimetral · Alero / Versátil · Pívot / Interior',
    slots: [
      {
        slotKey: 'base',
        positionKey: 'base',
        label: 'Base / Perimetral',
        shortCode: 'PER',
        row: 0,
        rowLabel: 'Perímetro (1)',
      },
      {
        slotKey: 'alero',
        positionKey: 'alero',
        label: 'Alero / Versátil',
        shortCode: 'ALE',
        row: 1,
        rowLabel: 'Frente de Ataque (2)',
      },
      {
        slotKey: 'pivot',
        positionKey: 'pivot',
        label: 'Pívot / Interior',
        shortCode: 'PIV',
        row: 1,
        rowLabel: 'Frente de Ataque (2)',
      },
    ],
  },
  voleibol: {
    sportType: 'voleibol',
    formationName: 'Sexteto Titular + Líbero',
    summaryText: '1 Armador · 2 Puntas · 2 Centrales · 1 Opuesto + 1 Líbero',
    slots: [
      {
        slotKey: 'armador',
        positionKey: 'armador',
        label: 'Armador / Levantador',
        shortCode: 'ARM',
        row: 1,
        rowLabel: 'Segunda Línea (3)',
      },
      {
        slotKey: 'punta_1',
        positionKey: 'punta',
        label: 'Punta Receptor 1',
        shortCode: 'PTA 1',
        row: 2,
        rowLabel: 'Primera Línea / Red (3)',
      },
      {
        slotKey: 'punta_2',
        positionKey: 'punta',
        label: 'Punta Receptor 2',
        shortCode: 'PTA 2',
        row: 1,
        rowLabel: 'Segunda Línea (3)',
      },
      {
        slotKey: 'central_1',
        positionKey: 'central',
        label: 'Central 1',
        shortCode: 'CEN 1',
        row: 2,
        rowLabel: 'Primera Línea / Red (3)',
      },
      {
        slotKey: 'central_2',
        positionKey: 'central',
        label: 'Central 2',
        shortCode: 'CEN 2',
        row: 1,
        rowLabel: 'Segunda Línea (3)',
      },
      {
        slotKey: 'opuesto',
        positionKey: 'opuesto',
        label: 'Opuesto',
        shortCode: 'OPU',
        row: 2,
        rowLabel: 'Primera Línea / Red (3)',
      },
      {
        slotKey: 'libero',
        positionKey: 'libero',
        label: 'Líbero',
        shortCode: 'LIB',
        row: 0,
        rowLabel: 'Especialista Defensivo (+1)',
        isLibero: true,
      },
    ],
  },
};

export const TOTY_MAX_SLOTS = 10;
export const TOTY_MAX_PER_POSITION = 6;

export interface TotyFormationPreset {
  id: string;
  label: string;
  formationName: string;
  positionCounts: Record<string, number>;
}

export const TOTY_FORMATION_PRESETS: Record<SportType, TotyFormationPreset[]> = {
  futbol7: [
    {
      id: 'f7-1-2-2-2',
      label: '1-2-2-2 (Oficial · 7)',
      formationName: 'Formación 1-2-2-2',
      positionCounts: { arquero: 1, defensa: 2, mediocampista: 2, delantero: 2 },
    },
    {
      id: 'f7-1-3-2-1',
      label: '1-3-2-1 (Defensiva · 7)',
      formationName: 'Formación 1-3-2-1',
      positionCounts: { arquero: 1, defensa: 3, mediocampista: 2, delantero: 1 },
    },
    {
      id: 'f7-1-2-3-1',
      label: '1-2-3-1 (Control · 7)',
      formationName: 'Formación 1-2-3-1',
      positionCounts: { arquero: 1, defensa: 2, mediocampista: 3, delantero: 1 },
    },
    {
      id: 'f7-1-3-1-2',
      label: '1-3-1-2 (Vertical · 7)',
      formationName: 'Formación 1-3-1-2',
      positionCounts: { arquero: 1, defensa: 3, mediocampista: 1, delantero: 2 },
    },
  ],
  basquetbol: [
    {
      id: 'bk-classic',
      label: 'Quinteto Clásico (5)',
      formationName: 'Quinteto Ideal 5x5',
      positionCounts: { base: 1, escolta: 1, alero: 1, ala_pivot: 1, pivot: 1 },
    },
    {
      id: 'bk-small-ball',
      label: 'Small Ball (2 PG · 5)',
      formationName: 'Quinteto Small Ball',
      positionCounts: { base: 2, escolta: 1, alero: 1, ala_pivot: 1, pivot: 0 },
    },
    {
      id: 'bk-twin-towers',
      label: 'Torres Gemelas (2 C · 5)',
      formationName: 'Quinteto Torres Gemelas',
      positionCounts: { base: 1, escolta: 1, alero: 1, ala_pivot: 0, pivot: 2 },
    },
  ],
  basquetbol3x3: [
    {
      id: 'bk3-classic',
      label: 'Trío Clásico (3)',
      formationName: 'Trío Ideal 3x3',
      positionCounts: { base: 1, alero: 1, pivot: 1 },
    },
    {
      id: 'bk3-perimeter',
      label: 'Perimetral (2 PER · 3)',
      formationName: 'Trío Perimetral 3x3',
      positionCounts: { base: 2, alero: 0, pivot: 1 },
    },
  ],
  voleibol: [
    {
      id: 'vl-6-libero',
      label: 'Sexteto + Líbero (7)',
      formationName: 'Sexteto Titular + Líbero',
      positionCounts: { armador: 1, punta: 2, central: 2, opuesto: 1, libero: 1 },
    },
    {
      id: 'vl-6-only',
      label: 'Sexteto sin Líbero (6)',
      formationName: 'Sexteto Titular 6',
      positionCounts: { armador: 1, punta: 2, central: 2, opuesto: 1, libero: 0 },
    },
  ],
};

const POSITION_PLURAL_LABELS: Record<string, { singular: string; plural: string }> = {
  arquero: { singular: 'Portero', plural: 'Porteros' },
  defensa: { singular: 'Defensa', plural: 'Defensas' },
  mediocampista: { singular: 'Mediocampista', plural: 'Mediocampistas' },
  delantero: { singular: 'Delantero', plural: 'Delanteros' },
  base: { singular: 'Base', plural: 'Bases' },
  escolta: { singular: 'Escolta', plural: 'Escoltas' },
  alero: { singular: 'Alero', plural: 'Aleros' },
  ala_pivot: { singular: 'Ala-Pívot', plural: 'Ala-Pívots' },
  pivot: { singular: 'Pívot', plural: 'Pívots' },
  armador: { singular: 'Armador', plural: 'Armadores' },
  punta: { singular: 'Punta', plural: 'Puntas' },
  central: { singular: 'Central', plural: 'Centrales' },
  opuesto: { singular: 'Opuesto', plural: 'Opuestos' },
  libero: { singular: 'Líbero', plural: 'Líberos' },
};

const ROW_BASE_LABELS: Record<SportType, Record<number, string>> = {
  futbol7: {
    0: 'Portería',
    1: 'Defensa',
    2: 'Mediocampo',
    3: 'Delantera',
  },
  basquetbol: {
    0: 'Conducción',
    1: 'Perímetro / Alas',
    2: 'Juego Interior',
  },
  basquetbol3x3: {
    0: 'Perímetro',
    1: 'Frente de Ataque',
    2: 'Juego Interior',
  },
  voleibol: {
    0: 'Especialista Defensivo',
    1: 'Segunda Línea',
    2: 'Primera Línea / Red',
  },
};

export function getDefaultPositionCountsForSport(sportType: SportType): Record<string, number> {
  const defaultFormation = TOTY_FORMATIONS[sportType] ?? TOTY_FORMATIONS.futbol7;
  const categories = getPositionsForSport(sportType);
  const counts: Record<string, number> = {};
  for (const cat of categories) {
    counts[cat.key] = 0;
  }
  for (const slot of defaultFormation.slots) {
    counts[slot.positionKey] = (counts[slot.positionKey] ?? 0) + 1;
  }
  return counts;
}

export function formatTotyFormationSummary(
  sportType: SportType,
  positionCounts: Record<string, number>
): string {
  const categories = getPositionsForSport(sportType);
  const parts: string[] = [];
  for (const cat of categories) {
    const count = Math.max(0, Math.trunc(Number(positionCounts[cat.key]) || 0));
    if (count <= 0) continue;
    const labels = POSITION_PLURAL_LABELS[cat.key];
    const word = labels ? (count === 1 ? labels.singular : labels.plural) : cat.label;
    parts.push(`${count} ${word}`);
  }
  return parts.join(' · ');
}

export function suggestTotyFormationName(
  sportType: SportType,
  positionCounts: Record<string, number>
): string {
  if (sportType === 'futbol7') {
    const arq = Math.max(0, Math.trunc(Number(positionCounts.arquero) || 0));
    const def = Math.max(0, Math.trunc(Number(positionCounts.defensa) || 0));
    const med = Math.max(0, Math.trunc(Number(positionCounts.mediocampista) || 0));
    const del = Math.max(0, Math.trunc(Number(positionCounts.delantero) || 0));
    return `Formación ${arq}-${def}-${med}-${del}`;
  }
  const total = Object.values(positionCounts).reduce(
    (sum, n) => sum + Math.max(0, Math.trunc(Number(n) || 0)),
    0
  );
  if (sportType === 'basquetbol') {
    return total === 5 ? 'Quinteto Ideal 5x5' : `Formación Ideal (${total})`;
  }
  if (sportType === 'basquetbol3x3') {
    return total === 3 ? 'Trío Ideal 3x3' : `Formación 3x3 (${total})`;
  }
  const lib = Math.max(0, Math.trunc(Number(positionCounts.libero) || 0));
  const field = total - lib;
  if (field === 6 && lib === 1) return 'Sexteto Titular + Líbero';
  if (lib > 0) return `Formación ${field} + ${lib} Líbero`;
  return `Formación Voleibol (${total})`;
}

export function validateDisciplineTotyConfig(
  sportType: SportType,
  positionCounts: Record<string, number>,
  formationName: string
): {
  valid: boolean;
  totalSlots: number;
  error?: string;
  sanitizedCounts: Record<string, number>;
  sanitizedName: string;
} {
  const categories = getPositionsForSport(sportType);
  const allowedKeys = new Set(categories.map((c) => c.key));
  const sanitizedCounts: Record<string, number> = {};

  for (const key of Object.keys(positionCounts)) {
    if (!allowedKeys.has(key)) {
      return {
        valid: false,
        totalSlots: 0,
        error: `La posición "${key}" no corresponde a este deporte.`,
        sanitizedCounts: {},
        sanitizedName: formationName.trim(),
      };
    }
    const rawVal = Number(positionCounts[key]);
    if (!Number.isFinite(rawVal) || rawVal < 0 || Math.trunc(rawVal) !== rawVal) {
      return {
        valid: false,
        totalSlots: 0,
        error: 'Cada posición debe tener un número entero mayor o igual a 0.',
        sanitizedCounts: {},
        sanitizedName: formationName.trim(),
      };
    }
    if (rawVal > TOTY_MAX_PER_POSITION) {
      return {
        valid: false,
        totalSlots: 0,
        error: `El máximo permitido por posición es ${TOTY_MAX_PER_POSITION}.`,
        sanitizedCounts: {},
        sanitizedName: formationName.trim(),
      };
    }
  }

  let totalSlots = 0;
  for (const cat of categories) {
    const count = Math.max(0, Math.trunc(Number(positionCounts[cat.key]) || 0));
    sanitizedCounts[cat.key] = count;
    totalSlots += count;
  }

  if (totalSlots < 1) {
    return {
      valid: false,
      totalSlots,
      error: 'La formación debe incluir al menos 1 puesto titular.',
      sanitizedCounts,
      sanitizedName: formationName.trim(),
    };
  }

  if (totalSlots > TOTY_MAX_SLOTS) {
    return {
      valid: false,
      totalSlots,
      error: `La formación no puede superar ${TOTY_MAX_SLOTS} puestos totales.`,
      sanitizedCounts,
      sanitizedName: formationName.trim(),
    };
  }

  const trimmedName = formationName.trim().slice(0, 80);
  const sanitizedName =
    trimmedName.length >= 2 ? trimmedName : suggestTotyFormationName(sportType, sanitizedCounts);

  return {
    valid: true,
    totalSlots,
    sanitizedCounts,
    sanitizedName,
  };
}

function countsMatchDefault(
  sportType: SportType,
  counts: Record<string, number>
): boolean {
  const defaults = getDefaultPositionCountsForSport(sportType);
  return Object.keys(defaults).every(
    (k) => (Math.trunc(Number(counts[k]) || 0) === defaults[k])
  );
}

/**
 * Builds the effective TOTY formation for a discipline, honoring an Admin's saved
 * `DisciplineTotyConfig` when present and falling back to the official sport default.
 */
export function buildTotyFormationConfig(
  sportType: SportType,
  customConfig?: DisciplineTotyConfig | null
): TotyFormationConfig {
  const defaultFormation = TOTY_FORMATIONS[sportType] ?? TOTY_FORMATIONS.futbol7;
  if (!customConfig || !customConfig.positionCounts) {
    return defaultFormation;
  }

  const validation = validateDisciplineTotyConfig(
    sportType,
    customConfig.positionCounts,
    customConfig.formationName || defaultFormation.formationName
  );
  if (!validation.valid) {
    return defaultFormation;
  }

  // If the admin's counts match the official sport default, preserve canonical tactical rows
  if (countsMatchDefault(sportType, validation.sanitizedCounts)) {
    return {
      ...defaultFormation,
      formationName: validation.sanitizedName || defaultFormation.formationName,
    };
  }

  const categories = getPositionsForSport(sportType);
  const rawSlots: Omit<TotyFormationSlot, 'rowLabel'>[] = [];

  for (const cat of categories) {
    const count = validation.sanitizedCounts[cat.key] ?? 0;
    if (count <= 0) continue;
    const singular = POSITION_PLURAL_LABELS[cat.key]?.singular ?? cat.label;
    for (let i = 1; i <= count; i++) {
      const isSingle = count === 1;
      let row = cat.totyRow;
      if (sportType === 'voleibol') {
        if (cat.key === 'libero') {
          row = 0;
        } else if (cat.key === 'armador') {
          row = 1;
        } else if (cat.key === 'opuesto') {
          row = 2;
        } else {
          // Alternate multi-slot puntas/centrales between front net (2) and back line (1)
          row = i % 2 === 1 ? 2 : 1;
        }
      } else if (sportType === 'basquetbol3x3') {
        row = cat.key === 'base' ? 0 : 1;
      }

      rawSlots.push({
        slotKey: isSingle ? cat.key : `${cat.key}_${i}`,
        positionKey: cat.key,
        label: isSingle ? cat.label : `${singular} ${i}`,
        shortCode: isSingle ? cat.shortCode : `${cat.shortCode} ${i}`,
        row,
        isLibero: cat.key === 'libero',
      });
    }
  }

  const rowCounts = new Map<number, number>();
  for (const s of rawSlots) {
    rowCounts.set(s.row, (rowCounts.get(s.row) ?? 0) + 1);
  }

  const rowLabels = ROW_BASE_LABELS[sportType] ?? ROW_BASE_LABELS.futbol7;
  const slots: TotyFormationSlot[] = rawSlots.map((s) => {
    const baseLabel = rowLabels[s.row] ?? `Línea ${s.row + 1}`;
    const cnt = rowCounts.get(s.row) ?? 1;
    return {
      ...s,
      rowLabel: s.isLibero ? `${baseLabel} (+${cnt})` : `${baseLabel} (${cnt})`,
    };
  });

  return {
    sportType,
    formationName: validation.sanitizedName,
    summaryText: formatTotyFormationSummary(sportType, validation.sanitizedCounts),
    slots,
  };
}

export function getTotyFormationForSport(
  sportType: SportType,
  customConfig?: DisciplineTotyConfig | null
): TotyFormationConfig {
  return buildTotyFormationConfig(sportType, customConfig);
}

/**
 * Normalizes a saved TOTY ballot into the current formation's `slotKey -> playerId` shape:
 * - Preserves direct matches for current `slotKey`s.
 * - Migrates legacy single-position keys (e.g. `defensa` -> `defensa_1`) AND contracted multi-slot keys (`defensa_1` -> `defensa`).
 * - Guarantees no duplicate playerId occupies two slots in the same ballot.
 */
export function normalizeTotyBallotSelections(
  rawSelections: Record<string, string> | undefined,
  sportType: SportType,
  customConfig?: DisciplineTotyConfig | null
): Record<string, string> {
  if (!rawSelections) return {};
  const formation = getTotyFormationForSport(sportType, customConfig);
  const normalized: Record<string, string> = {};
  const usedPlayerIds = new Set<string>();

  // 1. Direct slotKey assignments first
  for (const slot of formation.slots) {
    const pid = rawSelections[slot.slotKey];
    if (typeof pid === 'string' && pid.trim() && !usedPlayerIds.has(pid.trim())) {
      normalized[slot.slotKey] = pid.trim();
      usedPlayerIds.add(pid.trim());
    }
  }

  // 2. Fallback migration from legacy/alternate keys of the same positionKey
  // (e.g., 'defensa' -> 'defensa_1' when expanded, or 'defensa_1' -> 'defensa' when contracted)
  for (const slot of formation.slots) {
    if (normalized[slot.slotKey]) continue;

    const candidateKeys: string[] = [slot.positionKey];
    for (let i = 1; i <= TOTY_MAX_PER_POSITION; i++) {
      candidateKeys.push(`${slot.positionKey}_${i}`);
    }

    for (const key of candidateKeys) {
      const legacyPid = rawSelections[key];
      if (
        typeof legacyPid === 'string' &&
        legacyPid.trim() &&
        !usedPlayerIds.has(legacyPid.trim())
      ) {
        normalized[slot.slotKey] = legacyPid.trim();
        usedPlayerIds.add(legacyPid.trim());
        break;
      }
    }
  }

  return normalized;
}

export function getPositionsForSport(sportType: SportType): PositionCategoryMeta[] {
  return SPORT_POSITIONS[sportType] ?? SPORT_POSITIONS.futbol7;
}

/**
 * Matches a player's free-text `posicion` string to the canonical positionKey for their sport.
 * Checks longer/more specific keywords first (e.g., 'ala-pivot' before 'pivot' or 'alero').
 */
export function matchPlayerToPositionKey(
  playerPosicion: string,
  sportType: SportType
): string | null {
  const norm = normalizeStr(playerPosicion || '');
  if (!norm) return null;

  const categories = getPositionsForSport(sportType);

  // Exact key or label match first
  for (const cat of categories) {
    if (norm === cat.key || norm === normalizeStr(cat.label)) {
      return cat.key;
    }
  }

  // Sort keywords by length descending so 'ala-pivot' matches before 'pivot'
  const weighted: { key: string; kw: string }[] = [];
  for (const cat of categories) {
    for (const kw of cat.matchKeywords) {
      weighted.push({ key: cat.key, kw: normalizeStr(kw) });
    }
  }
  weighted.sort((a, b) => b.kw.length - a.kw.length);

  for (const item of weighted) {
    if (norm.includes(item.kw)) {
      return item.key;
    }
  }
  return null;
}

/**
 * Returns eligible players for a specific position within a discipline:
 * - `matched`: players whose `posicion` matches the positionKey.
 * - `all`: all players in the discipline (used as fallback when teams haven't standardized position names).
 */
export function getEligiblePlayersForPosition(
  disciplinePlayers: Player[],
  sportType: SportType,
  positionKey: string
): { matched: Player[]; all: Player[] } {
  const matched = disciplinePlayers.filter(
    (p) => matchPlayerToPositionKey(p.posicion, sportType) === positionKey
  );
  return {
    matched,
    all: disciplinePlayers,
  };
}

export interface RankedVoteCandidate {
  playerId: string;
  playerName: string;
  teamId: string;
  teamName: string;
  teamSigla: string;
  teamEscudo?: string;
  posicion: string;
  dorsal: number;
  votes: number;
  percentage: number;
}

/**
 * Aggregates Championship MVP votes strictly among the Admin-nominated players (up to 5).
 */
export function aggregateChampionshipMvpVotes(
  disciplineId: DisciplineId,
  nomineeIds: string[],
  votes: ChampionshipMvpVoteRecord[],
  players: Player[],
  teams: Team[]
): { totalVotes: number; candidates: RankedVoteCandidate[] } {
  const playerMap = new Map(players.map((p) => [p.id, p]));
  const teamMap = new Map(teams.map((t) => [t.id, t]));
  const uniqueNominees = Array.from(new Set(nomineeIds)).slice(0, 5);
  const nomineeSet = new Set(uniqueNominees);

  const counts = new Map<string, number>();
  uniqueNominees.forEach((id) => counts.set(id, 0));

  const discVotes = votes.filter(
    (v) => v.disciplineId === disciplineId && nomineeSet.has(v.playerId)
  );

  for (const v of discVotes) {
    counts.set(v.playerId, (counts.get(v.playerId) ?? 0) + 1);
  }

  const totalVotes = discVotes.length;

  const candidates: RankedVoteCandidate[] = uniqueNominees
    .map((pid) => {
      const player = playerMap.get(pid);
      const team = player ? teamMap.get(player.teamId) : undefined;
      const count = counts.get(pid) ?? 0;
      return {
        playerId: pid,
        playerName: player
          ? `${player.nombre} ${player.apellidoPaterno}`.trim()
          : pid,
        teamId: player?.teamId ?? '',
        teamName: team?.nombre ?? 'Equipo UFRO',
        teamSigla: team?.sigla ?? 'UFRO',
        teamEscudo: team?.escudo,
        posicion: player?.posicion ?? 'Jugador',
        dorsal: player?.dorsal ?? 0,
        votes: count,
        percentage: totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0,
      };
    })
    .sort((a, b) => b.votes - a.votes || a.playerName.localeCompare(b.playerName, 'es'));

  return { totalVotes, candidates };
}

export interface PositionAwardStanding {
  position: PositionCategoryMeta;
  totalVotes: number;
  leader: RankedVoteCandidate | null;
  rankings: RankedVoteCandidate[];
}

/**
 * Aggregates Position Award votes for every position of a discipline's sport.
 */
export function aggregatePositionAwardVotes(
  disciplineId: DisciplineId,
  sportType: SportType,
  votes: PositionAwardVoteRecord[],
  players: Player[],
  teams: Team[]
): PositionAwardStanding[] {
  const categories = getPositionsForSport(sportType);
  const playerMap = new Map(players.map((p) => [p.id, p]));
  const teamMap = new Map(teams.map((t) => [t.id, t]));

  return categories.map((pos) => {
    const posVotes = votes.filter(
      (v) => v.disciplineId === disciplineId && v.positionKey === pos.key
    );
    const totalVotes = posVotes.length;
    const countMap = new Map<string, { votes: number; fallbackName: string; fallbackTeamId: string }>();

    for (const v of posVotes) {
      const current = countMap.get(v.playerId);
      if (current) {
        current.votes += 1;
      } else {
        countMap.set(v.playerId, {
          votes: 1,
          fallbackName: v.playerName,
          fallbackTeamId: v.teamId,
        });
      }
    }

    const rankings: RankedVoteCandidate[] = Array.from(countMap.entries())
      .map(([playerId, info]) => {
        const player = playerMap.get(playerId);
        const teamId = player?.teamId ?? info.fallbackTeamId;
        const team = teamMap.get(teamId);
        return {
          playerId,
          playerName: player
            ? `${player.nombre} ${player.apellidoPaterno}`.trim()
            : info.fallbackName,
          teamId,
          teamName: team?.nombre ?? 'Equipo UFRO',
          teamSigla: team?.sigla ?? 'UFRO',
          teamEscudo: team?.escudo,
          posicion: player?.posicion ?? pos.label,
          dorsal: player?.dorsal ?? 0,
          votes: info.votes,
          percentage: totalVotes > 0 ? Math.round((info.votes / totalVotes) * 100) : 0,
        };
      })
      .sort((a, b) => b.votes - a.votes || a.playerName.localeCompare(b.playerName, 'es'));

    return {
      position: pos,
      totalVotes,
      leader: rankings[0] ?? null,
      rankings,
    };
  });
}

export interface TotySlotResult {
  slot: TotyFormationSlot;
  position: PositionCategoryMeta;
  totalVotesForSlot: number;
  winner: RankedVoteCandidate | null;
  runnerUps: RankedVoteCandidate[];
  isTiedWithRunnerUp: boolean;
}

export interface TotyPositionBreakdown {
  position: PositionCategoryMeta;
  slotsAllocated: number;
  ballotsContributing: number;
  winnerIds: string[];
  hasCutoffTie: boolean;
  candidates: RankedVoteCandidate[];
}

export interface CommunityTotyResult {
  disciplineId: DisciplineId;
  formation: TotyFormationConfig;
  totalBallots: number;
  slots: TotySlotResult[];
  positionBreakdowns: TotyPositionBreakdown[];
}

/**
 * Computes the full-formation Community Team of the Year (TOTY) for a discipline,
 * honoring any Admin-configured formation for that discipline (`customConfig`) or
 * falling back to the official sport default.
 *
 * For multi-slot positions (e.g. 2 defensas, 2 delanteros, 2 puntas, 2 centrales), votes
 * across all slots of that position are pooled so candidates don't split votes between
 * slot 1 and slot 2, and the top N distinct players fill those N spots cleanly.
 */
export function computeCommunityToty(
  disciplineId: DisciplineId,
  sportType: SportType,
  ballots: TotyBallotRecord[],
  players: Player[],
  teams: Team[],
  customConfig?: DisciplineTotyConfig | null
): CommunityTotyResult {
  const formation = getTotyFormationForSport(sportType, customConfig);
  const categories = getPositionsForSport(sportType);
  const categoryMap = new Map(categories.map((c) => [c.key, c]));
  const playerMap = new Map(players.map((p) => [p.id, p]));
  const teamMap = new Map(teams.map((t) => [t.id, t]));
  const discBallots = ballots.filter((b) => b.disciplineId === disciplineId);

  // Group formation slots by positionKey
  const slotsByPosition = new Map<string, TotyFormationSlot[]>();
  for (const slot of formation.slots) {
    const arr = slotsByPosition.get(slot.positionKey) ?? [];
    arr.push(slot);
    slotsByPosition.set(slot.positionKey, arr);
  }

  // Aggregate unique votes per position pool across all ballots
  // Even if the admin reconfigured slot counts (e.g. 2 -> 3 or 2 -> 1), read all raw keys matching posKey
  const poolStats = new Map<
    string,
    { ballotsContributing: number; ranked: RankedVoteCandidate[] }
  >();

  for (const [posKey] of slotsByPosition.entries()) {
    const posMeta = categoryMap.get(posKey) ?? categories[0];
    const counts = new Map<string, number>();
    let ballotsContributing = 0;

    for (const ballot of discBallots) {
      const uniquePicksInGroup = new Set<string>();
      const rawSel = ballot.selections ?? {};
      for (const [k, v] of Object.entries(rawSel)) {
        if (typeof v !== 'string' || !v.trim()) continue;
        if (k === posKey || k.startsWith(`${posKey}_`)) {
          uniquePicksInGroup.add(v.trim());
        }
      }
      if (uniquePicksInGroup.size === 0) continue;
      ballotsContributing += 1;
      for (const pid of uniquePicksInGroup) {
        counts.set(pid, (counts.get(pid) ?? 0) + 1);
      }
    }

    const ranked: RankedVoteCandidate[] = Array.from(counts.entries())
      .map(([playerId, count]) => {
        const player = playerMap.get(playerId);
        const team = player ? teamMap.get(player.teamId) : undefined;
        return {
          playerId,
          playerName: player
            ? `${player.nombre} ${player.apellidoPaterno}`.trim()
            : playerId,
          teamId: player?.teamId ?? '',
          teamName: team?.nombre ?? 'Equipo UFRO',
          teamSigla: team?.sigla ?? 'UFRO',
          teamEscudo: team?.escudo,
          posicion: player?.posicion ?? posMeta.label,
          dorsal: player?.dorsal ?? 0,
          votes: count,
          percentage:
            ballotsContributing > 0
              ? Math.min(100, Math.round((count / ballotsContributing) * 100))
              : 0,
        };
      })
      .sort((a, b) => b.votes - a.votes || a.playerName.localeCompare(b.playerName, 'es'));

    poolStats.set(posKey, { ballotsContributing, ranked });
  }

  // Assign distinct winners across the full formation so no player appears twice on the pitch/court
  const globallyAssignedIds = new Set<string>();
  const slotResultMap = new Map<string, TotySlotResult>();
  const positionBreakdowns: TotyPositionBreakdown[] = [];

  for (const [posKey, groupSlots] of slotsByPosition.entries()) {
    const posMeta = categoryMap.get(posKey) ?? categories[0];
    const pool = poolStats.get(posKey) ?? { ballotsContributing: 0, ranked: [] };
    const available = pool.ranked.filter((c) => !globallyAssignedIds.has(c.playerId));
    const chosenForGroup = available.slice(0, groupSlots.length);
    chosenForGroup.forEach((c) => globallyAssignedIds.add(c.playerId));
    const remainingRunnerUps = available.slice(groupSlots.length, groupSlots.length + 5);
    const lastChosen = chosenForGroup[chosenForGroup.length - 1];
    const firstRunnerUp = remainingRunnerUps[0];
    const hasCutoffTie = Boolean(
      lastChosen && firstRunnerUp && lastChosen.votes > 0 && lastChosen.votes === firstRunnerUp.votes
    );

    positionBreakdowns.push({
      position: posMeta,
      slotsAllocated: groupSlots.length,
      ballotsContributing: pool.ballotsContributing,
      winnerIds: chosenForGroup.map((c) => c.playerId),
      hasCutoffTie,
      candidates: pool.ranked,
    });

    groupSlots.forEach((slot, idx) => {
      const winner = chosenForGroup[idx] ?? null;
      const isLastSlotInGroup = idx === groupSlots.length - 1;
      slotResultMap.set(slot.slotKey, {
        slot,
        position: posMeta,
        totalVotesForSlot: pool.ballotsContributing,
        winner,
        runnerUps: idx === 0 ? remainingRunnerUps : [],
        isTiedWithRunnerUp: isLastSlotInGroup && hasCutoffTie,
      });
    });
  }

  const slots: TotySlotResult[] = formation.slots.map(
    (slot) =>
      slotResultMap.get(slot.slotKey) ?? {
        slot,
        position: categoryMap.get(slot.positionKey) ?? categories[0],
        totalVotesForSlot: 0,
        winner: null,
        runnerUps: [],
        isTiedWithRunnerUp: false,
      }
  );

  return {
    disciplineId,
    formation,
    totalBallots: discBallots.length,
    slots,
    positionBreakdowns,
  };
}
