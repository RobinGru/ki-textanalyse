import { codepoints, isTag, confusables, isLatin, isCyrillicOrGreek, isPrivateUse, isControl, isEmojiBase, emojiGlue, scriptJoiners, isJoiningLetter, mongolianFvs, isMongolianLetter, khmerVowels, isKhmerLetter, hangulFillers, isHangulJamo, orthographicCf, lineSeparators, isStrip, spaces, isCjk, isFrenchSpacing, typography, isGlue, names } from './constants.js';

export interface CleaningOptions {
  nfkc: boolean;
  aggressive: boolean;
  normalizeSpaces: boolean;
  stripGlue: boolean;
  typography: boolean;
}

export interface Finding {
  position: number;
  codepoint: string;
  category: string;
  action: string;
  replacement: string | null;
  reason: string;
}

export interface CleaningReport {
  input_length: number;
  output_length: number;
  removed: Record<string, number>;
  replaced: Record<string, number>;
  removed_count: number;
  replaced_count: number;
  hidden_messages: string[];
  unmatched_bidi_count: number;
  suspicious_lines: Array<{ line: number; count: number; density: number }>;
  findings: Finding[];
}

export function mixedConfusableIndexes(chars) {
      const indexes = new Set();
      let start = 0;
      while (start < chars.length) {
        while (start < chars.length && !/[\p{L}\p{M}]/u.test(chars[start])) start += 1;
        let end = start;
        while (end < chars.length && /[\p{L}\p{M}'’-]/u.test(chars[end])) end += 1;
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

export function characterLabel(character) {
      const cp = character.codePointAt(0);
      let name = names.get(cp);
      if (!name && cp >= 0xfe00 && cp <= 0xfe0f) name = `VARIATION SELECTOR-${cp - 0xfdff}`;
      if (!name && cp >= 0xe0100 && cp < 0xe01f0) name = `VARIATION SELECTOR-${cp - 0xe00ef}`;
      if (!name && isPrivateUse(cp)) name = 'UNKNOWN';
      if (!name) name = 'UNKNOWN';
      const category = /\p{Cf}/u.test(character) ? 'Cf' : /\p{Co}/u.test(character) ? 'Co' : /\p{Zs}/u.test(character) ? 'Zs' : 'Cn';
      return `U+${cp.toString(16).toUpperCase().padStart(4, '0')} ${name} (${category})`;
    }

export function decide(character, previousKept, options, nextCharacter = '', trustedTag = false, contextualConfusable = false) {
      const cp = character.codePointAt(0);
      if (emojiGlue.has(cp) && !options.stripGlue && previousKept !== null && nextCharacter && isEmojiBase(previousKept.codePointAt(0)) && isEmojiBase(nextCharacter.codePointAt(0))) return ['keep', character];
      if (!options.stripGlue) {
        if (scriptJoiners.has(cp) && previousKept !== null && isJoiningLetter(previousKept.codePointAt(0))) return ['keep', character];
        if (isTag(cp) && trustedTag) return ['keep', character];
        if (mongolianFvs.has(cp) && previousKept !== null && isMongolianLetter(previousKept.codePointAt(0))) return ['keep', character];
        if (khmerVowels.has(cp) && previousKept !== null && isKhmerLetter(previousKept.codePointAt(0))) return ['keep', character];
        if (hangulFillers.has(cp) && previousKept !== null && isHangulJamo(previousKept.codePointAt(0))) return ['keep', character];
        if (orthographicCf.has(cp)) return ['keep', character];
      }
      if (lineSeparators.has(cp) || cp === 0x0d) return ['replace', '\n'];
      if (cp === 0x09) return ['replace', ' '];
      if (isControl(cp)) return ['strip', ''];
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
      if ([0x061c, 0x200e, 0x200f].includes(cp) || (cp >= 0x202a && cp <= 0x202e) || (cp >= 0x2066 && cp <= 0x2069)) return 'bidi';
      if (spaces.has(cp)) return 'spaces';
      if (typography.has(cp)) return 'typography';
      if (contextualConfusable) return 'confusables';
      if ((cp >= 0xfe00 && cp <= 0xfe0f) || (cp >= 0xe0100 && cp <= 0xe01ef) || (cp >= 0x180b && cp <= 0x180f)) return 'variation';
      return 'invisible';
    }

    function countUnmatchedBidi(text) {
      const pairs = new Map([[0x202a, 0x202c], [0x202b, 0x202c], [0x202d, 0x202c], [0x202e, 0x202c], [0x2066, 0x2069], [0x2067, 0x2069], [0x2068, 0x2069]]);
      const closers = new Set(pairs.values());
      const stack = [];
      let unmatched = 0;
      for (const character of codepoints(text)) {
        const cp = character.codePointAt(0);
        if (pairs.has(cp)) stack.push(pairs.get(cp));
        else if (closers.has(cp)) {
          if (stack.pop() !== cp) unmatched += 1;
        }
      }
      return unmatched + stack.length;
    }

    function suspiciousLines(chars, findings) {
      const positions = new Set<number>(findings.map((finding) => finding.position));
      const lines = [];
      let start = 0;
      let lineNumber = 1;
      for (let end = 0; end <= chars.length; end += 1) {
        if (end !== chars.length && chars[end] !== '\n' && chars[end] !== '\r') continue;
        const length = end - start;
        const count = [...positions].filter((position) => position >= start && position < end).length;
        if (length > 0 && count >= 3) lines.push({ line: lineNumber, count, density: Math.round((count / length) * 100) });
        start = end + 1;
        lineNumber += 1;
      }
      return lines;
    }

export function cleanText(text: string, options: CleaningOptions): [string, CleaningReport] {
      const removed = new Map();
      const replaced = new Map();
      const output = [];
      let previousKept = null;
      const increment = (map, key) => map.set(key, (map.get(key) ?? 0) + 1);
      const chars = codepoints(text);
      const tags = tagAnalysis(text);
      const confusableIndexes = mixedConfusableIndexes(chars);
      const findings: Finding[] = [];
      for (let index = 0; index < chars.length; index += 1) {
        const character = chars[index];
        const [action, result] = decide(character, previousKept, options, chars[index + 1] ?? '', tags.trusted.has(index), confusableIndexes.has(index));
        if (action !== 'keep') findings.push({ position: index, codepoint: `U+${character.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`, category: findingCategory(character.codePointAt(0), confusableIndexes.has(index)), action, replacement: result || null, reason: characterLabel(character) });
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
      if (options.typography) cleaned = cleaned.replace(/[ \t]*,[ \t]*/g, ', ');
      if (options.nfkc) {
        const before = cleaned;
        cleaned = cleaned.normalize('NFKC');
        if (cleaned !== before) replaced.set('NFKC_normalize', Math.abs(codepoints(before).length - codepoints(cleaned).length) || 1);
      }
      const asObject = (map) => Object.fromEntries(map);
      const removedCount = [...removed.values()].reduce((sum, count) => sum + count, 0);
      const replacedCount = [...replaced].filter(([key]) => key !== 'NFKC_normalize').reduce((sum, [, count]) => sum + count, 0);
      return [cleaned, { input_length: codepoints(text).length, output_length: codepoints(cleaned).length, removed: asObject(removed), replaced: asObject(replaced), removed_count: removedCount, replaced_count: replacedCount, hidden_messages: tags.hiddenMessages, unmatched_bidi_count: countUnmatchedBidi(text), suspicious_lines: suspiciousLines(chars, findings), findings }];
    }
