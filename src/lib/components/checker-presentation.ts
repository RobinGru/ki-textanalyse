import type { Finding } from '$lib/cleaner';
import { codepoints } from '$lib/cleaner/constants';

export const findingLabels: Record<string, string> = {
  invisible: 'unsichtbare Zeichen', controls: 'Steuerzeichen', bidi: 'Richtungssteuerungen',
  'deprecated-bidi-control': 'veraltete Bidi-Steuerzeichen', tags: 'versteckte Tag-Zeichen',
  variation: 'Variationsselektoren', 'private-use': 'private Zeichensemantik',
  spaces: 'ungewöhnliche Leerzeichen', typography: 'typografische Ersetzungen',
  confusables: 'schriftsystemübergreifende Lookalikes'
};

export const findingColors: Record<string, string> = {
  invisible: 'badge-success', controls: 'badge-error', bidi: 'badge-error',
  'deprecated-bidi-control': 'badge-error', tags: 'badge-error', variation: 'badge-warning',
  'private-use': 'badge-warning', spaces: 'badge-warning', typography: 'badge-info',
  confusables: 'badge-error'
};

export function payloadCodepoints(payload: string) {
  return codepoints(payload).map((character) => `U+${character.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}`).join(' ');
}

export function payloadHex(payload: string) {
  return [...new TextEncoder().encode(payload)].map((byte) => byte.toString(16).toUpperCase().padStart(2, '0')).join(' ');
}

export function forensicKindLabel(kind: string) {
  return {
    'unicode-tag': 'Unicode-Tag-Sequenz', 'variation-selector': 'Variation-Selector-Run',
    'zero-width-binary': 'Zero-Width-Binärhypothese', 'zero-width-ternary': 'Zero-Width-Ternärhypothese',
    'zero-width-quaternary': 'Zero-Width-Quaternärhypothese', 'bidi-scope': 'Bidi-Scope',
    'combining-mark-run': 'Combining-Mark-Run', 'trailing-whitespace': 'Zeilenend-Leerraum',
    'replacement-character': 'Replacement Character', 'mid-text-bom': 'BOM im Text',
    noncharacter: 'Noncharacter', 'unpaired-surrogate': 'Ungepaartes Surrogat',
    'identifier-skeleton-collision': 'Identifier-Skeleton-Kollision'
  }[kind] ?? kind;
}

export function displayComparisonValue(value: string | null) {
  if (value === null || value === '') return 'entfernt';
  if (value === ' ') return 'Leerzeichen';
  if (value === '\n') return 'Zeilenumbruch';
  if (value === '\t') return 'Tabulator';
  return value;
}

export function countFindingsByCategory(findings: Finding[]) {
  return Object.entries(findings.reduce<Record<string, number>>((counts, finding) => ({
    ...counts,
    [finding.category]: (counts[finding.category] ?? 0) + 1
  }), {}));
}
