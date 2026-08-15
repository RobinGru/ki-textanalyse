import { codepoints, isTag, confusables, isLatin, isCyrillicOrGreek, isPrivateUse, isControl, isEmojiBase, isEmojiModifier, isVariationSelector, isHan, emojiGlue, scriptJoiners, isJoiningLetter, mongolianFvs, isMongolianLetter, khmerVowels, isKhmerLetter, hangulFillers, isHangulJamo, orthographicCf, lineSeparators, isStrip, spaces, isCjk, isFrenchSpacing, typography, isGlue, names } from './constants.js';
import { ideographicVariationDataVersion, registeredIdeographicVariationSequences, registeredVariationSequences, unicodeVariationDataVersion } from './generated-variation-sequences.js';
import { confusableDataVersion, confusableMappings, maxConfusableSourceLength } from './generated-confusables.js';
import type { CleaningOptions, CleaningReport, DomainSpoofFinding, Finding, FindingConfidence, FindingStatus, ForensicFinding, NormalizationFinding, ZeroWidthPayload } from './types.js';

export type { CleaningOptions, CleaningReport, DomainSpoofFinding, Finding, FindingConfidence, FindingStatus, ForensicFinding, NormalizationFinding, ZeroWidthPayload } from './types.js';

export const MAX_PAYLOAD_BYTES = 4_096;

export function codepointHex(character: string): string {
  return `U+${character.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}`;
}

export function utf8Hex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).toUpperCase().padStart(2, '0')).join(' ');
}

export function printableRatio(text: string): number {
  const characters = codepoints(text);
  if (!characters.length) return 0;
  return Math.round((characters.filter((character) => character === '\t' || character === '\n' || character === '\r' || !/\p{C}/u.test(character)).length / characters.length) * 100);
}

/** UTS #39-style comparison key; it is never used as displayed or replacement text. */
export function confusableSkeleton(text: string): string {
  const characters = codepoints(text.normalize('NFD').toLocaleLowerCase('und'));
  const output: string[] = [];
  for (let index = 0; index < characters.length;) {
    let mapping: string | undefined;
    let length = Math.min(maxConfusableSourceLength, characters.length - index);
    while (length > 0 && !mapping) {
      mapping = confusableMappings.get(characters.slice(index, index + length).join(''));
      if (!mapping) length -= 1;
    }
    output.push(mapping ?? characters[index]);
    index += mapping ? length : 1;
  }
  return output.join('').normalize('NFD');
}

export function identifierCollisionAnalysis(text: string): ForensicFinding[] {
  const chars = codepoints(text);
  const offsets = codeUnitOffsets(chars);
  const codeUnitToCodePoint = new Map<number, number>();
  offsets.forEach((offset, index) => codeUnitToCodePoint.set(offset, index));
  const groups = new Map<string, Array<{ value: string; start: number; end: number }>>();
  for (const match of text.matchAll(/[\p{L}_$][\p{L}\p{N}_$]*/gu)) {
    const start = codeUnitToCodePoint.get(match.index!);
    const end = codeUnitToCodePoint.get(match.index! + match[0].length);
    if (start === undefined || end === undefined) continue;
    const skeleton = confusableSkeleton(match[0]);
    const values = groups.get(skeleton) ?? [];
    values.push({ value: match[0], start, end });
    groups.set(skeleton, values);
  }
  const findings: ForensicFinding[] = [];
  for (const [skeleton, values] of groups) {
    const distinct = [...new Set(values.map(({ value }) => value))];
    if (distinct.length < 2 || !distinct.some((value) => /[^\u0000-\u007f]/.test(value))) continue;
    const first = values[0];
    findings.push(forensicResult('identifier-skeleton-collision', chars, offsets, first.start, first.end, 'high', 'unusual', { detail: `Identifier-ähnliche Tokens ${distinct.map((value) => JSON.stringify(value)).join(', ')} teilen das UTS-#39-Skeleton ${JSON.stringify(skeleton)}.` }));
  }
  return findings;
}

export type RestrictionLevel = 'ascii-only' | 'single-script' | 'highly-restrictive' | 'moderately-restrictive' | 'minimally-restrictive' | 'unrestricted';

const restrictionScripts = ['Latin', 'Han', 'Hiragana', 'Katakana', 'Bopomofo', 'Hangul', 'Arabic', 'Armenian', 'Bengali', 'Devanagari', 'Ethiopic', 'Georgian', 'Gujarati', 'Gurmukhi', 'Hebrew', 'Kannada', 'Khmer', 'Lao', 'Malayalam', 'Myanmar', 'Oriya', 'Sinhala', 'Tamil', 'Telugu', 'Thai', 'Tibetan', 'Cyrillic', 'Greek'] as const;
type RestrictionScript = typeof restrictionScripts[number];
const scriptExtensionMatchers = new Map<RestrictionScript, RegExp>(restrictionScripts.map((script) => [script, new RegExp(`\\p{Script_Extensions=${script}}`, 'u')]));
const commonOrInherited = /\p{Script=Common}|\p{Script=Inherited}/u;
const identifierTokenPattern = /[\p{L}_$][\p{L}\p{N}_$]*/gu;

function scriptExtensions(character: string): Set<RestrictionScript> {
  if (commonOrInherited.test(character)) return new Set();
  return new Set(restrictionScripts.filter((script) => scriptExtensionMatchers.get(script)!.test(character)));
}

function scriptSetsForIdentifier(identifier: string): Set<RestrictionScript>[] {
  return codepoints(identifier).map(scriptExtensions).filter((scripts) => scripts.size > 0);
}

function isCoveredBy(scriptSets: Set<RestrictionScript>[], allowed: readonly RestrictionScript[]): boolean {
  return scriptSets.every((scripts) => [...scripts].some((script) => allowed.includes(script)));
}

/**
 * Classifies identifier-like tokens using the UTS #39 restriction-level script
 * rules. Runtime XID syntax is used as the local identifier profile; the app
 * deliberately does not claim the separate UTS #39 Identifier_Status profile.
 */
export function restrictionLevel(identifier: string): RestrictionLevel {
  if (![...identifier].every((character) => /\p{XID_Continue}/u.test(character) || character === '_' || character === '$')) return 'unrestricted';
  if (![...identifier].some((character) => character.codePointAt(0)! > 0x7f)) return 'ascii-only';
  const scriptSets = scriptSetsForIdentifier(identifier);
  if (!scriptSets.length || scriptSets.reduce((intersection, scripts) => new Set([...intersection].filter((script) => scripts.has(script)))).size > 0) return 'single-script';
  if (
    isCoveredBy(scriptSets, ['Latin', 'Han', 'Hiragana', 'Katakana']) ||
    isCoveredBy(scriptSets, ['Latin', 'Han', 'Bopomofo']) ||
    isCoveredBy(scriptSets, ['Latin', 'Han', 'Hangul'])
  ) return 'highly-restrictive';
  const moderateScripts = restrictionScripts.filter((script) => !['Latin', 'Cyrillic', 'Greek'].includes(script));
  if (moderateScripts.some((script) => isCoveredBy(scriptSets, ['Latin', script]))) return 'moderately-restrictive';
  return 'minimally-restrictive';
}

function decimalSystemZero(character: string): number | undefined {
  const cp = character.codePointAt(0)!;
  if (!/\p{Nd}/u.test(character)) return undefined;
  // Decimal digit blocks are contiguous zero-to-nine sequences in Unicode.
  // The starts below cover Unicode 17's decimal-number repertoire.
  const starts = [0x0030, 0x0660, 0x06f0, 0x07c0, 0x0966, 0x09e6, 0x0a66, 0x0ae6, 0x0b66, 0x0be6, 0x0c66, 0x0ce6, 0x0d66, 0x0de6, 0x0e50, 0x0ed0, 0x0f20, 0x1040, 0x1090, 0x17e0, 0x1810, 0x1946, 0x19d0, 0x1a80, 0x1a90, 0x1b50, 0x1bb0, 0x1c40, 0x1c50, 0xa620, 0xa8d0, 0xa900, 0xa9d0, 0xa9f0, 0xaa50, 0xabf0, 0xff10, 0x104a0, 0x10d30, 0x10d40, 0x11066, 0x110f0, 0x11136, 0x111d0, 0x112f0, 0x11450, 0x114d0, 0x11650, 0x116c0, 0x11730, 0x118e0, 0x11950, 0x11bf0, 0x11c50, 0x11d50, 0x11da0, 0x11de0, 0x11f50, 0x16130, 0x16a60, 0x16ac0, 0x16b50, 0x16d70, 0x1ccf0, 0x1d7ce, 0x1d7d8, 0x1d7e2, 0x1d7ec, 0x1d7f6, 0x1e140, 0x1e2f0, 0x1e4f0, 0x1e5f1, 0x1e950, 0x1fbf0];
  return starts.find((start) => cp >= start && cp < start + 10);
}

/** Reports only risky UTS #39 script/number conditions; it never rewrites identifiers. */
export function identifierSecurityAnalysis(text: string): ForensicFinding[] {
  const chars = codepoints(text);
  const offsets = codeUnitOffsets(chars);
  const codeUnitToCodePoint = new Map<number, number>();
  offsets.forEach((offset, index) => codeUnitToCodePoint.set(offset, index));
  const findings: ForensicFinding[] = [];
  for (const match of text.matchAll(identifierTokenPattern)) {
    const start = codeUnitToCodePoint.get(match.index!);
    const end = codeUnitToCodePoint.get(match.index! + match[0].length);
    if (start === undefined || end === undefined) continue;
    const level = restrictionLevel(match[0]);
    if (level === 'minimally-restrictive' || level === 'unrestricted') {
      findings.push(forensicResult('identifier-restriction-level', chars, offsets, start, end, level === 'unrestricted' ? 'high' : 'medium', 'unusual', { detail: `Token ${JSON.stringify(match[0])} hat nach UTS #39 den Restriction Level ${level}; Skriptmischung prüfen.` }));
    }
    const zeros = new Set(codepoints(match[0]).map(decimalSystemZero).filter((zero): zero is number => zero !== undefined));
    if (zeros.size > 1) {
      findings.push(forensicResult('mixed-number-system', chars, offsets, start, end, 'high', 'unusual', { detail: `Token ${JSON.stringify(match[0])} mischt ${zeros.size} Unicode-Dezimalzahlensysteme (${[...zeros].map((zero) => `U+${zero.toString(16).toUpperCase().padStart(4, '0')}`).join(', ')}).` }));
    }
  }
  return findings;
}

/** A decoded zero-width binary payload. `end` is exclusive. */
function codeUnitOffsets(chars: string[]): number[] {
  const offsets = [0];
  for (const character of chars) offsets.push(offsets[offsets.length - 1] + character.length);
  return offsets;
}

function forensicResult(kind: string, chars: string[], offsets: number[], start: number, end: number, confidence: FindingConfidence, status: FindingStatus, values: Partial<ForensicFinding> = {}): ForensicFinding {
  return {
    kind,
    start,
    end,
    code_unit_start: offsets[start],
    code_unit_end: offsets[end],
    raw_codepoints: chars.slice(start, Math.min(end, start + MAX_PAYLOAD_BYTES)).map(codepointHex),
    confidence,
    status,
    ...values
  };
}

/** Decodes the documented ZWSP/ZWNJ binary convention, never arbitrary text. */
export function zeroWidthForensicAnalysis(chars: string[]): ForensicFinding[] {
  const findings: ForensicFinding[] = [];
  const isZeroWidthBinary = (character: string) => [0x200b, 0x200c, 0x200d].includes(character.codePointAt(0)!);
  const offsets = codeUnitOffsets(chars);

  for (let start = 0; start < chars.length;) {
    if (!isZeroWidthBinary(chars[start])) {
      start += 1;
      continue;
    }

    let end = start;
    while (end < chars.length && isZeroWidthBinary(chars[end])) end += 1;
    const bytes = chars.slice(start, end).join('').split('\u200d');
    const validEncoding = bytes.length > 0 && bytes.every((byte) => byte.length === 8 && /^[\u200b\u200c]{8}$/.test(byte));
    if (end - start >= 16 && !validEncoding) {
      findings.push(forensicResult('zero-width-binary', chars, offsets, start, end, 'low', 'incomplete', { detail: 'Kein vollständiger 8-Bit-Run mit U+200B/U+200C und U+200D als Trenner.' }));
    } else if (validEncoding && bytes.length > MAX_PAYLOAD_BYTES) {
      findings.push(forensicResult('zero-width-binary', chars, offsets, start, end, 'medium', 'incomplete', { detail: `Dekodierung auf ${MAX_PAYLOAD_BYTES} Bytes begrenzt.` }));
    } else if (validEncoding) {
      const values = new Uint8Array(bytes.map((byte) => Number.parseInt([...byte].map((character) => character === '\u200c' ? '1' : '0').join(''), 2)));
      try {
        const payload = new TextDecoder('utf-8', { fatal: true }).decode(values);
        const ratio = printableRatio(payload);
        findings.push(forensicResult('zero-width-binary', chars, offsets, start, end, ratio >= 85 ? 'high' : 'low', ratio >= 85 ? 'complete' : 'invalid', { decoded_text: ratio >= 85 ? payload : undefined, bytes_hex: utf8Hex(values), encoding: 'UTF-8', printable_ratio: ratio, detail: ratio >= 85 ? 'Dekodiert nach der ZWSP/ZWNJ-Binärhypothese.' : 'UTF-8 ist nicht ausreichend druckbar.' }));
      } catch {
        findings.push(forensicResult('zero-width-binary', chars, offsets, start, end, 'low', 'invalid', { bytes_hex: utf8Hex(values), detail: 'Die Binärhypothese ergibt kein gültiges UTF-8.' }));
      }
    }
    start = end;
  }
  return findings;
}

const ZERO_WIDTH_MULTISYMBOL_HYPOTHESES = [
  { kind: 'zero-width-ternary', label: 'ZWSP/ZWNJ/ZWJ-Ternärhypothese', alphabet: ['\u200b', '\u200c', '\u200d'], width: 6 },
  { kind: 'zero-width-quaternary', label: 'ZWSP/ZWNJ/ZWJ/WORD-JOINER-Quaternärhypothese', alphabet: ['\u200b', '\u200c', '\u200d', '\u2060'], width: 4 }
] as const;

function plausibleZeroWidthPayload(bytes: Uint8Array): Pick<ForensicFinding, 'decoded_text' | 'bytes_hex' | 'encoding' | 'printable_ratio' | 'detail' | 'confidence' | 'status'> {
  const bytesHex = utf8Hex(bytes);
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    const ratio = printableRatio(text);
    if (ratio < 85) return { bytes_hex: bytesHex, encoding: 'UTF-8', printable_ratio: ratio, confidence: 'low', status: 'invalid', detail: 'Die Hypothese ergibt UTF-8, das nicht ausreichend druckbar ist.' };
    const isAscii = /^[\x09\x0A\x0D\x20-\x7E]+$/.test(text);
    const isBase64 = isAscii && text.length >= 8 && text.length % 4 === 0 && /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(text);
    if (isBase64) {
      try {
        const decoded = Uint8Array.from(atob(text), (character) => character.codePointAt(0)!);
        const decodedText = new TextDecoder('utf-8', { fatal: true }).decode(decoded);
        const decodedRatio = printableRatio(decodedText);
        if (decodedRatio >= 85) return { decoded_text: decodedText, bytes_hex: bytesHex, encoding: 'Base64 → UTF-8', printable_ratio: decodedRatio, confidence: 'high', status: 'complete', detail: 'Die Hypothese ergibt druckbares Base64-kodiertes UTF-8.' };
      } catch {
        // A Base64-looking ASCII string remains an ASCII payload hypothesis.
      }
    }
    return { decoded_text: text, bytes_hex: bytesHex, encoding: isAscii ? 'ASCII' : 'UTF-8', printable_ratio: ratio, confidence: 'high', status: 'complete', detail: `Die Hypothese ergibt druckbares ${isAscii ? 'ASCII' : 'UTF-8'}.` };
  } catch {
    return { bytes_hex: bytesHex, confidence: 'low', status: 'invalid', detail: 'Die Hypothese ergibt kein gültiges UTF-8.' };
  }
}

/** Tests named 3-/4-symbol zero-width encodings; a result is evidence, not attribution. */
export function zeroWidthMultiSymbolForensicAnalysis(chars: string[]): ForensicFinding[] {
  const findings: ForensicFinding[] = [];
  const offsets = codeUnitOffsets(chars);
  const stegoCharacters = new Set(ZERO_WIDTH_MULTISYMBOL_HYPOTHESES[1].alphabet);
  for (let start = 0; start < chars.length;) {
    if (!stegoCharacters.has(chars[start] as never)) { start += 1; continue; }
    let end = start;
    while (end < chars.length && stegoCharacters.has(chars[end] as never)) end += 1;
    const run = chars.slice(start, end);
    const symbols = new Set(run);
    for (const hypothesis of ZERO_WIDTH_MULTISYMBOL_HYPOTHESES) {
      const isCandidate = run.every((character) => hypothesis.alphabet.includes(character as never));
      if (!isCandidate || symbols.size < 2) continue;
      const minimumSymbols = hypothesis.width * 4;
      if (run.length < minimumSymbols || symbols.size !== hypothesis.alphabet.length || run.length % hypothesis.width !== 0) {
        findings.push(forensicResult(hypothesis.kind, chars, offsets, start, end, 'low', 'incomplete', { detail: `${hypothesis.label}: mindestens vier vollständige Bytes und alle ${hypothesis.alphabet.length} Symbole sind erforderlich.` }));
        continue;
      }
      const byteCount = run.length / hypothesis.width;
      if (byteCount > MAX_PAYLOAD_BYTES) {
        findings.push(forensicResult(hypothesis.kind, chars, offsets, start, end, 'medium', 'incomplete', { detail: `${hypothesis.label}: Dekodierung auf ${MAX_PAYLOAD_BYTES} Bytes begrenzt.` }));
        continue;
      }
      const values = new Uint8Array(byteCount);
      let validBytes = true;
      for (let byteIndex = 0; byteIndex < byteCount; byteIndex += 1) {
        let value = 0;
        for (const character of run.slice(byteIndex * hypothesis.width, (byteIndex + 1) * hypothesis.width)) value = value * hypothesis.alphabet.length + hypothesis.alphabet.indexOf(character as never);
        if (value > 0xff) { validBytes = false; break; }
        values[byteIndex] = value;
      }
      if (!validBytes) {
        findings.push(forensicResult(hypothesis.kind, chars, offsets, start, end, 'low', 'invalid', { detail: `${hypothesis.label}: ein Symbolblock liegt außerhalb des Bytebereichs.` }));
        continue;
      }
      const payload = plausibleZeroWidthPayload(values);
      findings.push(forensicResult(hypothesis.kind, chars, offsets, start, end, payload.confidence, payload.status, { decoded_text: payload.decoded_text, bytes_hex: payload.bytes_hex, encoding: payload.encoding, printable_ratio: payload.printable_ratio, detail: `${hypothesis.label}: ${payload.detail}` }));
    }
    start = end;
  }
  return findings;
}

export function zeroWidthBinaryAnalysis(chars: string[]): ZeroWidthPayload[] {
  return zeroWidthForensicAnalysis(chars)
    .filter((finding) => finding.status === 'complete' && finding.decoded_text !== undefined)
    .map((finding) => ({ payload: finding.decoded_text!, start: finding.start, end: finding.end }));
}

function variationSelectorByte(character: string): number {
  const cp = character.codePointAt(0)!;
  return cp <= 0xfe0f ? cp - 0xfe00 : cp - 0xe0100 + 16;
}

export function variationSelectorForensicAnalysis(chars: string[]): ForensicFinding[] {
  const findings: ForensicFinding[] = [];
  const offsets = codeUnitOffsets(chars);
  const isSelector = (character: string) => {
    const cp = character.codePointAt(0)!;
    return (cp >= 0xfe00 && cp <= 0xfe0f) || (cp >= 0xe0100 && cp <= 0xe01ef);
  };
  for (let start = 0; start < chars.length;) {
    if (!isSelector(chars[start])) { start += 1; continue; }
    let end = start;
    while (end < chars.length && isSelector(chars[end])) end += 1;
    const carrier = start > 0 ? chars[start - 1] : undefined;
    if (end - start === 1) {
      const key = carrier ? [carrier, chars[start]].map((character) => character.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')).join('-') : '';
      const registered = registeredVariationSequences.get(key) ?? (registeredIdeographicVariationSequences.has(key) ? 'ideographic' : undefined);
      const source = registered === 'ideographic' ? `IVD ${ideographicVariationDataVersion}` : `Unicode ${unicodeVariationDataVersion}`;
      findings.push(forensicResult('variation-selector', chars, offsets, start, end, 'info', registered ? 'registered' : 'unusual', { carrier, detail: registered ? `${registered === 'emoji' ? 'Emoji-' : `${registered === 'ideographic' ? 'Ideographische' : 'Standardisierte'} `}Variationssequenz laut ${source}.` : `Nicht in den eingebundenen Emoji-/Standardvarianten von Unicode ${unicodeVariationDataVersion} oder der IVD ${ideographicVariationDataVersion}.` }));
    } else if (end - start > MAX_PAYLOAD_BYTES) {
      findings.push(forensicResult('variation-selector', chars, offsets, start, end, 'medium', 'incomplete', { carrier, detail: `Selector-Run überschreitet das Limit von ${MAX_PAYLOAD_BYTES} Bytes.` }));
    } else {
      const values = new Uint8Array(chars.slice(start, end).map(variationSelectorByte));
      try {
        const payload = new TextDecoder('utf-8', { fatal: true }).decode(values);
        const ratio = printableRatio(payload);
        findings.push(forensicResult('variation-selector', chars, offsets, start, end, ratio >= 85 ? 'high' : 'low', ratio >= 85 ? 'complete' : 'invalid', { carrier, decoded_text: ratio >= 85 ? payload : undefined, bytes_hex: utf8Hex(values), encoding: 'UTF-8', printable_ratio: ratio, detail: ratio >= 85 ? 'Langer Selector-Run nach der Byte-Mapping-Hypothese dekodiert.' : 'Die Byte-Mapping-Hypothese ist nicht ausreichend druckbar.' }));
      } catch {
        findings.push(forensicResult('variation-selector', chars, offsets, start, end, 'low', 'invalid', { carrier, bytes_hex: utf8Hex(values), detail: 'Die Byte-Mapping-Hypothese ergibt kein gültiges UTF-8.' }));
      }
    }
    start = end;
  }
  return findings;
}

export function tagForensicAnalysis(chars: string[]): ForensicFinding[] {
  const findings: ForensicFinding[] = [];
  const offsets = codeUnitOffsets(chars);
  const knownSubdivisionFlags = new Set(['gbeng', 'gbsct', 'gbwls']);
  for (let start = 0; start < chars.length;) {
    if (!isTag(chars[start].codePointAt(0)!)) { start += 1; continue; }
    let end = start;
    let payload = '';
    while (end < chars.length && isTag(chars[end].codePointAt(0)!)) {
      const cp = chars[end].codePointAt(0)!;
      if (cp >= 0xe0020 && cp <= 0xe007e) payload += String.fromCodePoint(cp - 0xe0000);
      end += 1;
    }
    const complete = chars[end - 1]?.codePointAt(0) === 0xe007f;
    const carrier = start > 0 ? chars[start - 1] : undefined;
    const registered = carrier?.codePointAt(0) === 0x1f3f4 && complete && knownSubdivisionFlags.has(payload);
    const bounded = payload.length <= MAX_PAYLOAD_BYTES;
    findings.push(forensicResult('unicode-tag', chars, offsets, start, end, registered ? 'info' : complete ? 'high' : 'medium', registered ? 'registered' : !complete || !bounded ? 'incomplete' : 'complete', { carrier, decoded_text: bounded ? payload : undefined, bytes_hex: bounded ? utf8Hex(new TextEncoder().encode(payload)) : undefined, encoding: 'ASCII', printable_ratio: bounded ? printableRatio(payload) : undefined, detail: registered ? 'Bekannte RGI-Subdivision-Flag-Sequenz.' : !complete ? 'Cancel-Tag fehlt.' : !bounded ? `Payload auf ${MAX_PAYLOAD_BYTES} Bytes begrenzt.` : 'Tag-Sequenz ist keine bekannte Subdivision-Flag.' }));
    start = end;
  }
  return findings;
}

export function textHygieneForensicAnalysis(chars: string[]): ForensicFinding[] {
  const findings: ForensicFinding[] = [];
  const offsets = codeUnitOffsets(chars);
  const isNoncharacter = (cp: number) => (cp >= 0xfdd0 && cp <= 0xfdef) || (cp & 0xffff) === 0xfffe || (cp & 0xffff) === 0xffff;
  for (let start = 0; start < chars.length;) {
    const character = chars[start];
    const cp = character.codePointAt(0)!;
    if (/\p{M}/u.test(character)) {
      let end = start;
      while (end < chars.length && /\p{M}/u.test(chars[end])) end += 1;
      if (end - start > 8) findings.push(forensicResult('combining-mark-run', chars, offsets, start, end, end - start > 16 ? 'high' : 'medium', 'unusual', { carrier: start > 0 ? chars[start - 1] : undefined, detail: `${end - start} kombinierende Zeichen in einem zusammenhängenden Run.` }));
      start = end;
      continue;
    }
    if (character === ' ' || character === '\t') {
      let end = start;
      while (end < chars.length && (chars[end] === ' ' || chars[end] === '\t')) end += 1;
      if (end === chars.length || chars[end] === '\n') findings.push(forensicResult('trailing-whitespace', chars, offsets, start, end, 'low', 'unusual', { detail: 'Leerraum am Zeilenende.' }));
      start = end;
      continue;
    }
    if (cp === 0xfffd) findings.push(forensicResult('replacement-character', chars, offsets, start, start + 1, 'medium', 'unusual', { detail: 'U+FFFD deutet auf einen vorherigen Dekodier- oder Übertragungsfehler hin.' }));
    else if (cp === 0xfeff && start > 0) findings.push(forensicResult('mid-text-bom', chars, offsets, start, start + 1, 'medium', 'unusual', { detail: 'Byte Order Mark außerhalb der Textposition 0.' }));
    else if (isNoncharacter(cp)) findings.push(forensicResult('noncharacter', chars, offsets, start, start + 1, 'high', 'unusual', { detail: 'Unicode-Noncharacter ist kein reguläres Textzeichen.' }));
    else if (cp >= 0xd800 && cp <= 0xdfff) findings.push(forensicResult('unpaired-surrogate', chars, offsets, start, start + 1, 'high', 'invalid', { detail: 'Ungepaartes UTF-16-Surrogat.' }));
    start += 1;
  }
  return findings;
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
        const punycode = label.toLowerCase().startsWith('xn--');
        if (punycode || (mixed && suspicious.length > 0 && suspicious.every((character) => confusables.has(character.codePointAt(0)!)))) {
          const character_indexes = punycode ? [labelOffset] : labelChars.flatMap((character, index) => confusables.has(character.codePointAt(0)!) ? [labelOffset + index] : []);
          const key = `${domainOffset}:${label}`;
          if (!seen.has(key)) {
            seen.add(key);
            findings.push({ domain, label, skeleton: confusableSkeleton(label), character_indexes, risk: punycode ? 'medium' : 'high', reason: punycode ? 'punycode-label' : 'mixed-script-confusable' });
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

    const bidiNames = new Map([
      [0x202a, 'LEFT-TO-RIGHT EMBEDDING (LRE)'], [0x202b, 'RIGHT-TO-LEFT EMBEDDING (RLE)'],
      [0x202d, 'LEFT-TO-RIGHT OVERRIDE (LRO)'], [0x202e, 'RIGHT-TO-LEFT OVERRIDE (RLO)'],
      [0x2066, 'LEFT-TO-RIGHT ISOLATE (LRI)'], [0x2067, 'RIGHT-TO-LEFT ISOLATE (RLI)'],
      [0x2068, 'FIRST STRONG ISOLATE (FSI)']
    ]);

    const bidiControlLabels = new Map([
      ...bidiNames,
      [0x202c, 'POP DIRECTIONAL FORMATTING (PDF)'],
      [0x2069, 'POP DIRECTIONAL ISOLATE (PDI)'],
      [0x200e, 'LEFT-TO-RIGHT MARK (LRM)'],
      [0x200f, 'RIGHT-TO-LEFT MARK (RLM)'],
      [0x061c, 'ARABIC LETTER MARK (ALM)']
    ]);

    function logicalBidiPreview(chars: string[]): string {
      return chars.map((character) => {
        const name = bidiControlLabels.get(character.codePointAt(0)!);
        return name ? `⟦${name.match(/\(([^)]+)\)/)?.[1] ?? name}⟧` : character;
      }).join('');
    }

    function bidiContextRanges(text: string, chars: string[]) {
      const offsets = codeUnitOffsets(chars);
      const codeUnitToCodePoint = new Map<number, number>();
      offsets.forEach((offset, index) => codeUnitToCodePoint.set(offset, index));
      const ranges: Array<{ start: number; end: number; context: 'url' | 'filename' | 'code' }> = [];
      const add = (pattern: RegExp, context: 'url' | 'filename' | 'code') => {
        for (const match of text.matchAll(pattern)) {
          const start = codeUnitToCodePoint.get(match.index!);
          const end = codeUnitToCodePoint.get(match.index! + match[0].length);
          if (start !== undefined && end !== undefined) ranges.push({ start, end, context });
        }
      };
      // Code is intentionally recognized only when fenced or delimited; guessing prose as code would inflate risk.
      add(/```[\s\S]*?```|`[^`\n]+`/g, 'code');
      add(/(?:https?:\/\/|www\.)[^\s<>"']+/gu, 'url');
      // Paths and common filename extensions are security-sensitive display targets.
      add(/(?<![\p{L}\p{N}_-])(?:(?:[A-Za-z]:)?[\\/])?(?:[\p{L}\p{N}_.\-\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]+[\\/])*[\p{L}\p{N}_.\-\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]+\.[A-Za-z0-9]{1,12}(?![\p{L}\p{N}_-])/gu, 'filename');
      return ranges;
    }

    function bidiContextAt(index: number, ranges: ReturnType<typeof bidiContextRanges>) {
      // Code has priority: a URL inside a literal should be presented as code, not as a clickable-looking URL.
      return ranges.find((range) => range.context === 'code' && range.start <= index && index < range.end)?.context
        ?? ranges.find((range) => range.context === 'url' && range.start <= index && index < range.end)?.context
        ?? ranges.find((range) => range.context === 'filename' && range.start <= index && index < range.end)?.context;
    }

    export function bidiForensicAnalysis(chars: string[]): ForensicFinding[] {
      const findings: ForensicFinding[] = [];
      const offsets = codeUnitOffsets(chars);
      const contextRanges = bidiContextRanges(chars.join(''), chars);
      type Scope = { start: number; cp: number; type: 'embedding' | 'isolate' };
      let stack: Scope[] = [];
      const addScope = (scope: Scope, end: number | undefined, closer: 'PDF' | 'PDI', paragraphEnd: number, implicit = false) => {
        const closed = end !== undefined;
        const previewEnd = closed ? end + 1 : paragraphEnd;
        const rawPreview = chars.slice(scope.start, previewEnd).join('');
        const missingCloser = scope.type === 'embedding' ? '\u202c' : '\u2069';
        const context = bidiContextAt(scope.start, contextRanges);
        // Keep the finding range compatible with the historic contract for an unclosed scope:
        // only its opening control is a definite range; the preview explains its paragraph-wide effect.
        findings.push(forensicResult('bidi-scope', chars, offsets, scope.start, closed ? previewEnd : scope.start + 1, closed ? 'medium' : 'high', closed ? 'complete' : 'incomplete', {
          logical_preview: logicalBidiPreview(chars.slice(scope.start, previewEnd)),
          // Closing an incomplete preview prevents its control from affecting the surrounding UI.
          visual_preview: closed ? rawPreview : `${rawPreview}${missingCloser}`,
          context,
          detail: `${bidiNames.get(scope.cp)}${closed ? `${implicit ? ' implizit' : ''} durch ${closer} beendet.` : `; kein passendes ${closer} im selben Absatz.`}${context ? ` Sicherheitsrelevanter Kontext: ${context === 'url' ? 'URL' : context === 'filename' ? 'Dateiname/Pfad' : 'Code'}.` : ''}`
        }));
      };
      const addUnmatchedCloser = (index: number, closer: 'PDF' | 'PDI') => {
        const context = bidiContextAt(index, contextRanges);
        findings.push(forensicResult('bidi-scope', chars, offsets, index, index + 1, 'high', 'incomplete', {
          logical_preview: logicalBidiPreview(chars.slice(index, index + 1)),
          visual_preview: '',
          context,
          detail: `${closer} ohne passenden öffnenden Bidi-Scope.${context ? ` Sicherheitsrelevanter Kontext: ${context === 'url' ? 'URL' : context === 'filename' ? 'Dateiname/Pfad' : 'Code'}.` : ''}`
        }));
      };
      const finishParagraph = (paragraphEnd: number) => {
        // UAX #9 resets explicit embedding/isolate state at a paragraph boundary.
        stack.forEach((scope) => addScope(scope, undefined, scope.type === 'embedding' ? 'PDF' : 'PDI', paragraphEnd));
        stack = [];
      };
      for (let index = 0; index < chars.length; index += 1) {
        if (chars[index] === '\n') { finishParagraph(index); continue; }
        const cp = chars[index].codePointAt(0)!;
        if ([0x202a, 0x202b, 0x202d, 0x202e].includes(cp)) stack.push({ start: index, cp, type: 'embedding' });
        else if (cp === 0x202c) {
          const isolateBoundary = stack.map((scope) => scope.type).lastIndexOf('isolate');
          let scopeIndex = stack.length - 1;
          // PDF closes only an embedding opened in the current isolate context (UAX #9 X7).
          while (scopeIndex > isolateBoundary && stack[scopeIndex].type !== 'embedding') scopeIndex -= 1;
          if (scopeIndex > isolateBoundary && stack[scopeIndex].type === 'embedding') {
            const [scope] = stack.splice(scopeIndex, 1);
            addScope(scope, index, 'PDF', index);
          } else addUnmatchedCloser(index, 'PDF');
        } else if ([0x2066, 0x2067, 0x2068].includes(cp)) stack.push({ start: index, cp, type: 'isolate' });
        else if (cp === 0x2069) {
          let scopeIndex = stack.length - 1;
          while (scopeIndex >= 0 && stack[scopeIndex].type !== 'isolate') scopeIndex -= 1;
          if (scopeIndex < 0) { addUnmatchedCloser(index, 'PDI'); continue; }
          // PDI ends the matching isolate and any embeddings that were opened inside it (UAX #9 X5a).
          const inner = stack.splice(scopeIndex);
          for (const scope of inner) addScope(scope, index, 'PDI', index, scope.type === 'embedding');
        }
      }
      finishParagraph(chars.length);
      return findings.sort((left, right) => left.start - right.start || left.end - right.end);
    }

    function countUnmatchedBidi(text) {
      return bidiForensicAnalysis(codepoints(text)).filter((finding) => finding.status === 'incomplete').length;
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
      const bidiFindings = bidiForensicAnalysis(chars);
      const identifierCollisions = identifierCollisionAnalysis(normalizedText);
      const identifierSecurity = identifierSecurityAnalysis(normalizedText);
      const forensicFindings = [
        ...tagForensicAnalysis(chars),
        ...variationSelectorForensicAnalysis(chars),
        ...zeroWidthForensicAnalysis(chars),
        ...zeroWidthMultiSymbolForensicAnalysis(chars),
        ...bidiFindings,
        ...textHygieneForensicAnalysis(chars),
        ...identifierCollisions,
        ...identifierSecurity
      ];
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
      return [cleaned, { input_length: codepoints(text).length, output_length: codepoints(cleaned).length, removed: asObject(removed), replaced: asObject(replaced), removed_count: removedCount, replaced_count: replacedCount, hidden_messages: tags.hiddenMessages, normalizations, zero_width_payloads: zeroWidthPayloads, domain_spoofs: domainSpoofs, unmatched_bidi_count: bidiFindings.filter((finding) => finding.status === 'incomplete').length, suspicious_lines: suspiciousLines(chars, findings), findings, forensic_findings: forensicFindings }];
    }
