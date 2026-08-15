import { codepoints, isTag, confusables, isLatin, isCyrillicOrGreek, isPrivateUse, isControl, isEmojiBase, isEmojiModifier, isVariationSelector, isHan, emojiGlue, scriptJoiners, isJoiningLetter, mongolianFvs, isMongolianLetter, khmerVowels, isKhmerLetter, hangulFillers, isHangulJamo, orthographicCf, lineSeparators, isStrip, spaces, isCjk, isFrenchSpacing, typography, isGlue, names } from './constants.js';

export interface CleaningOptions {
  nfc: boolean;
  nfkc: boolean;
  aggressive: boolean;
  normalizeSpaces: boolean;
  normalizeTabs: boolean;
  stripGlue: boolean;
  typography: boolean;
}

export interface NormalizationFinding {
  start: number;
  end: number;
  form: 'NFC' | 'NFKC';
  before: string;
  after: string;
}

export interface Finding {
  position: number;
  codepoint: string;
  category: string;
  action: string;
  replacement: string | null;
  reason: string;
}

/** A decoded zero-width binary payload. `end` is exclusive. */
export interface ZeroWidthPayload {
  payload: string;
  start: number;
  end: number;
}

export interface DomainSpoofFinding {
  domain: string;
  label: string;
  skeleton: string;
  character_indexes: number[];
}

export interface CleaningReport {
  input_length: number;
  output_length: number;
  removed: Record<string, number>;
  replaced: Record<string, number>;
  removed_count: number;
  replaced_count: number;
  hidden_messages: string[];
  normalizations: NormalizationFinding[];
  zero_width_payloads: ZeroWidthPayload[];
  domain_spoofs: DomainSpoofFinding[];
  unmatched_bidi_count: number;
  suspicious_lines: Array<{ line: number; count: number; density: number }>;
  findings: Finding[];
}

/**
 * Decodes only maximal runs of ZWSP/ZWNJ bits separated by ZWJ byte boundaries.
 * This intentionally excludes ordinary emoji ZWJ sequences, which contain emoji
 * code points and therefore cannot form a zero-width-only run.
 */
export function zeroWidthBinaryAnalysis(chars: string[]): ZeroWidthPayload[] {
  const payloads: ZeroWidthPayload[] = [];
  const isZeroWidthBinary = (character: string) => [0x200b, 0x200c, 0x200d].includes(character.codePointAt(0)!);

  for (let start = 0; start < chars.length;) {
    if (!isZeroWidthBinary(chars[start])) {
      start += 1;
      continue;
    }

    let end = start;
    while (end < chars.length && isZeroWidthBinary(chars[end])) end += 1;
    const bytes = chars.slice(start, end).join('').split('\u200d');
    if (bytes.length > 0 && bytes.every((byte) => byte.length === 8 && /^[\u200b\u200c]{8}$/.test(byte))) {
      const values = bytes.map((byte) => Number.parseInt([...byte].map((character) => character === '\u200c' ? '1' : '0').join(''), 2));
      try {
        const payload = new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(values));
        if ([...payload].every((character) => character === '\t' || character === '\n' || character === '\r' || !/\p{C}/u.test(character))) {
          payloads.push({ payload, start, end });
        }
      } catch {
        // Invalid UTF-8 is not a payload.
      }
    }
    start = end;
  }
  return payloads;
}

export function domainSpoofAnalysis(text: string, chars = codepoints(text)): DomainSpoofFinding[] {
  const codeUnitToCodePoint = new Map<number, number>();
  let codeUnitIndex = 0;
  chars.forEach((character, index) => {
    codeUnitToCodePoint.set(codeUnitIndex, index);
    codeUnitIndex += character.length;
  });
  const findings: DomainSpoofFinding[] = [];
  const seen = new Set<string>();
  const patterns = [
    /[\p{L}\p{N}._%+-]+@((?:[\p{L}\p{N}-]+\.)+[\p{L}\p{N}-]+)/gu,
    /(?:https?:\/\/|www\.)((?:[\p{L}\p{N}-]+\.)+[\p{L}\p{N}-]+)/gu
  ];

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const domain = match[1];
      const domainOffset = match.index! + match[0].lastIndexOf(domain);
      let labelOffset = codeUnitToCodePoint.get(domainOffset)!;
      for (const label of domain.split('.')) {
        const labelChars = codepoints(label);
        const mixed = labelChars.some((character) => /^[A-Za-z]$/.test(character)) && labelChars.some(isCyrillicOrGreek);
        const suspicious = labelChars.filter(isCyrillicOrGreek);
        if (mixed && suspicious.length > 0 && suspicious.every((character) => confusables.has(character.codePointAt(0)!))) {
          const character_indexes = labelChars.flatMap((character, index) => confusables.has(character.codePointAt(0)!) ? [labelOffset + index] : []);
          const key = `${domainOffset}:${label}`;
          if (!seen.has(key)) {
            seen.add(key);
            findings.push({ domain, label, skeleton: labelChars.map((character) => confusables.get(character.codePointAt(0)!) ?? character).join(''), character_indexes });
          }
        }
        labelOffset += labelChars.length + 1;
      }
    }
  }
  return findings;
}

export function mixedConfusableIndexes(chars) {
      const indexes = new Set();
      let start = 0;
      while (start < chars.length) {
        while (start < chars.length && !/[\p{L}\p{M}]/u.test(chars[start])) start += 1;
        let end = start;
        while (end < chars.length && /[\p{L}\p{M}\p{Cf}'’-]/u.test(chars[end])) end += 1;
        const word = chars.slice(start, end);
        if (word.some(isLatin) && word.some(isCyrillicOrGreek) && word.filter(isCyrillicOrGreek).every((character) => confusables.has(character.codePointAt(0)))) {
          word.forEach((character, offset) => { if (confusables.has(character.codePointAt(0))) indexes.add(start + offset); });
        }
        start = end + 1;
      }
      return indexes;
    }

export function tagAnalysis(text) {
      const chars = codepoints(text);
      const trusted = new Set();
      const hiddenMessages = [];
      for (let i = 0; i < chars.length; i += 1) {
        if (!isTag(chars[i].codePointAt(0))) continue;
        let end = i;
        let payload = '';
        while (end < chars.length && isTag(chars[end].codePointAt(0))) {
          const cp = chars[end].codePointAt(0);
          if (cp >= 0xe0020 && cp <= 0xe007e) payload += String.fromCodePoint(cp - 0xe0000);
          end += 1;
        }
        const previous = chars[i - 1]?.codePointAt(0);
        const endsWithCancel = chars[end - 1]?.codePointAt(0) === 0xe007f;
        if (previous === 0x1f3f4 && endsWithCancel && new Set(['gbeng', 'gbsct', 'gbwls']).has(payload)) {
          for (let position = i; position < end; position += 1) trusted.add(position);
        } else if (payload.trim()) {
          hiddenMessages.push(payload);
        }
        i = end - 1;
      }
      return { trusted, hiddenMessages };
    }

const generalCategories = ['Lu', 'Ll', 'Lt', 'Lm', 'Lo', 'Mn', 'Mc', 'Me', 'Nd', 'Nl', 'No', 'Pc', 'Pd', 'Ps', 'Pe', 'Pi', 'Pf', 'Po', 'Sm', 'Sc', 'Sk', 'So', 'Zs', 'Zl', 'Zp', 'Cc', 'Cf', 'Cs', 'Co', 'Cn'];

export function generalCategory(character: string) {
      return generalCategories.find((category) => new RegExp(`\\p{General_Category=${category}}`, 'u').test(character)) ?? 'Cn';
    }

export function characterLabel(character) {
      const cp = character.codePointAt(0)!;
      let name = names.get(cp);
      if (!name && cp >= 0xfe00 && cp <= 0xfe0f) name = `VARIATION SELECTOR-${cp - 0xfdff}`;
      if (!name && cp >= 0xe0100 && cp < 0xe01f0) name = `VARIATION SELECTOR-${cp - 0xe00ef}`;
      if (!name && isPrivateUse(cp)) name = 'PRIVATE USE CHARACTER';
      if (!name) name = 'NAME UNAVAILABLE';
      return `U+${cp.toString(16).toUpperCase().padStart(4, '0')} ${name} (${generalCategory(character)})`;
    }

export function decide(character, previousKept, options, nextCharacter = '', trustedTag = false, contextualConfusable = false, trustedEmojiGlue = false, ideographicVariation = false) {
      const cp = character.codePointAt(0);
      if (!options.stripGlue && emojiGlue.has(cp) && trustedEmojiGlue) return ['keep', character];
      if (!options.stripGlue) {
        if (scriptJoiners.has(cp) && previousKept !== null && nextCharacter && isJoiningLetter(previousKept.codePointAt(0)) && isJoiningLetter(nextCharacter.codePointAt(0))) return ['keep', character];
        if (ideographicVariation) return ['keep', character];
        if (isTag(cp) && trustedTag) return ['keep', character];
        if (mongolianFvs.has(cp) && previousKept !== null && isMongolianLetter(previousKept.codePointAt(0))) return ['keep', character];
        if (khmerVowels.has(cp) && previousKept !== null && isKhmerLetter(previousKept.codePointAt(0))) return ['keep', character];
        if (hangulFillers.has(cp) && previousKept !== null && isHangulJamo(previousKept.codePointAt(0))) return ['keep', character];
        if (orthographicCf.has(cp)) return ['keep', character];
      }
      if (lineSeparators.has(cp) || cp === 0x0d) return ['replace', '\n'];
      if (cp === 0x09) return options.normalizeTabs ? ['replace', ' '] : ['keep', character];
      if (isControl(cp)) return ['strip', ''];
      if (isPrivateUse(cp)) return options.aggressive ? ['strip', ''] : ['keep', character];
      if (isStrip(cp)) return ['strip', ''];
      if (options.normalizeSpaces && spaces.has(cp)) {
        if (cp === 0x3000 && (isCjk(previousKept ?? '') || isCjk(nextCharacter))) return ['keep', character];
        if ((cp === 0x00a0 || cp === 0x202f) && isFrenchSpacing(previousKept, nextCharacter)) return ['keep', character];
        return ['replace', ' '];
      }
      if (options.typography && typography.has(cp)) return ['replace', typography.get(cp)];
      if (options.aggressive && contextualConfusable && confusables.has(cp)) return ['replace', confusables.get(cp)];
      if (/\p{Cf}/u.test(character) && !spaces.has(cp)) return ['strip', ''];
      return ['keep', character];
    }

    function findingCategory(cp, contextualConfusable) {
      if (isControl(cp) || cp === 0x09 || cp === 0x0d || lineSeparators.has(cp)) return 'controls';
      if (isTag(cp)) return 'tags';
      if (cp >= 0x206a && cp <= 0x206f) return 'deprecated-bidi-control';
      if (isPrivateUse(cp)) return 'private-use';
      if ([0x061c, 0x200e, 0x200f].includes(cp) || (cp >= 0x202a && cp <= 0x202e) || (cp >= 0x2066 && cp <= 0x2069)) return 'bidi';
      if (spaces.has(cp)) return 'spaces';
      if (typography.has(cp)) return 'typography';
      if (contextualConfusable) return 'confusables';
      if ((cp >= 0xfe00 && cp <= 0xfe0f) || (cp >= 0xe0100 && cp <= 0xe01ef) || (cp >= 0x180b && cp <= 0x180f)) return 'variation';
      return 'invisible';
    }

    export function emojiSequenceIndexes(chars: string[]) {
      const trusted = new Set<number>();
      const findBase = (index: number, step: -1 | 1) => {
        for (let cursor = index; cursor >= 0 && cursor < chars.length; cursor += step) {
          const cp = chars[cursor].codePointAt(0)!;
          if (isVariationSelector(cp) || isEmojiModifier(cp)) continue;
          return isEmojiBase(cp);
        }
        return false;
      };
      for (let index = 0; index < chars.length; index += 1) {
        const cp = chars[index].codePointAt(0)!;
        if (cp === 0x200d && findBase(index - 1, -1) && findBase(index + 1, 1)) trusted.add(index);
        if ((cp === 0xfe0e || cp === 0xfe0f) && findBase(index - 1, -1)) trusted.add(index);
      }
      return trusted;
    }

    export function ideographicVariationIndexes(chars: string[]) {
      const trusted = new Set<number>();
      for (let index = 1; index < chars.length; index += 1) {
        const cp = chars[index].codePointAt(0)!;
        if (cp >= 0xe0100 && cp <= 0xe01ef && isHan(chars[index - 1])) trusted.add(index);
      }
      return trusted;
    }

    function countUnmatchedBidi(text) {
      let embeddings: number[] = [];
      let isolates: number[] = [];
      let unmatched = 0;
      const finishParagraph = () => {
        unmatched += embeddings.length + isolates.length;
        embeddings = [];
        isolates = [];
      };
      for (const character of codepoints(text)) {
        if (character === '\n') {
          finishParagraph();
          continue;
        }
        const cp = character.codePointAt(0)!;
        if ([0x202a, 0x202b, 0x202d, 0x202e].includes(cp)) embeddings.push(cp);
        else if (cp === 0x202c) {
          if (embeddings.length) embeddings.pop(); else unmatched += 1;
        } else if ([0x2066, 0x2067, 0x2068].includes(cp)) isolates.push(cp);
        else if (cp === 0x2069) {
          if (isolates.length) isolates.pop(); else unmatched += 1;
        }
      }
      finishParagraph();
      return unmatched;
    }

    function suspiciousLines(chars: string[], findings: Finding[]) {
      const positions = findings.map((finding) => finding.position).sort((a, b) => a - b);
      const lines = [];
      let positionIndex = 0;
      let start = 0;
      let lineNumber = 1;
      for (let end = 0; end <= chars.length; end += 1) {
        if (end !== chars.length && chars[end] !== '\n') continue;
        while (positionIndex < positions.length && positions[positionIndex] < start) positionIndex += 1;
        let count = 0;
        while (positionIndex < positions.length && positions[positionIndex] < end) {
          count += 1;
          positionIndex += 1;
        }
        const length = end - start;
        if (length > 0 && count >= 3) lines.push({ line: lineNumber, count, density: Math.round((count / length) * 100) });
        start = end + 1;
        lineNumber += 1;
      }
      return lines;
    }

export function normalizationFindings(text: string, form: 'NFC' | 'NFKC'): NormalizationFinding[] {
      const codeUnitToCodePoint = new Map<number, number>();
      let codeUnit = 0;
      let codePoint = 0;
      for (const character of codepoints(text)) {
        codeUnitToCodePoint.set(codeUnit, codePoint);
        codeUnit += character.length;
        codePoint += 1;
      }
      codeUnitToCodePoint.set(codeUnit, codePoint);
      const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
      const findings: NormalizationFinding[] = [];
      for (const { segment, index } of segmenter.segment(text)) {
        const after = segment.normalize(form);
        if (after !== segment) findings.push({ start: codeUnitToCodePoint.get(index)!, end: codeUnitToCodePoint.get(index + segment.length)!, form, before: segment, after });
      }
      return findings;
    }

export function cleanText(text: string, options: CleaningOptions): [string, CleaningReport] {
      const normalizedText = text.replace(/\r\n|\r|\u0085|\u2028|\u2029/g, '\n');
      const removed = new Map();
      const replaced = new Map();
      const output = [];
      let previousKept = null;
      const increment = (map, key) => map.set(key, (map.get(key) ?? 0) + 1);
      const lineEndingFindings: Finding[] = [];
      const originalChars = codepoints(text);
      for (let index = 0; index < originalChars.length; index += 1) {
        const character = originalChars[index];
        const cp = character.codePointAt(0)!;
        if (cp !== 0x0d && !lineSeparators.has(cp)) continue;
        lineEndingFindings.push({ position: index, codepoint: `U+${cp.toString(16).toUpperCase().padStart(4, '0')}`, category: 'controls', action: 'replace', replacement: '\n', reason: characterLabel(character) });
        increment(replaced, characterLabel(character));
        if (cp === 0x0d && originalChars[index + 1] === '\n') index += 1;
      }
      const chars = codepoints(normalizedText);
      const tags = tagAnalysis(normalizedText);
      const confusableIndexes = mixedConfusableIndexes(chars);
      const emojiGlueIndexes = emojiSequenceIndexes(chars);
      const ideographicVariations = ideographicVariationIndexes(chars);
      const zeroWidthPayloads = zeroWidthBinaryAnalysis(chars);
      const domainSpoofs = domainSpoofAnalysis(normalizedText, chars);
      const findings: Finding[] = [...lineEndingFindings];
      for (let index = 0; index < chars.length; index += 1) {
        const character = chars[index];
        const cp = character.codePointAt(0)!;
        const [action, result] = decide(character, previousKept, options, chars[index + 1] ?? '', tags.trusted.has(index), confusableIndexes.has(index), emojiGlueIndexes.has(index), ideographicVariations.has(index));
        if (action !== 'keep' || (isPrivateUse(cp) && !options.aggressive)) findings.push({ position: index, codepoint: `U+${cp.toString(16).toUpperCase().padStart(4, '0')}`, category: findingCategory(cp, confusableIndexes.has(index)), action: action === 'keep' ? 'report' : action, replacement: action === 'keep' ? character : result || null, reason: characterLabel(character) });
        if (action === 'keep') {
          output.push(result);
          if (!isGlue(character.codePointAt(0))) previousKept = result;
        } else if (action === 'replace') {
          output.push(result);
          increment(replaced, characterLabel(character));
          previousKept = result;
        } else {
          increment(removed, characterLabel(character));
        }
      }
      let cleaned = output.join('');
      const form = options.nfkc ? 'NFKC' : options.nfc ? 'NFC' : null;
      const normalizations = form ? normalizationFindings(cleaned, form) : [];
      if (form) cleaned = cleaned.normalize(form);
      if (normalizations.length) replaced.set(`${form}_normalize`, normalizations.length);
      const asObject = (map) => Object.fromEntries(map);
      const removedCount = [...removed.values()].reduce((sum, count) => sum + count, 0);
      const replacedCount = [...replaced.values()].reduce((sum, count) => sum + count, 0);
      return [cleaned, { input_length: codepoints(text).length, output_length: codepoints(cleaned).length, removed: asObject(removed), replaced: asObject(replaced), removed_count: removedCount, replaced_count: replacedCount, hidden_messages: tags.hiddenMessages, normalizations, zero_width_payloads: zeroWidthPayloads, domain_spoofs: domainSpoofs, unmatched_bidi_count: countUnmatchedBidi(normalizedText), suspicious_lines: suspiciousLines(chars, findings), findings }];
    }
