import { describe, expect, it } from 'vitest';

import { characterLabel, cleanText, codepointHex, confusableSkeleton, printableRatio, restrictionLevel, utf8Hex } from './index';
import { fileMetadata } from '$lib/files';
import { exportedReport, markdownReport, reportFileName } from '$lib/report';

const options = { nfc: true, nfkc: true, aggressive: true, normalizeSpaces: true, normalizeTabs: true, stripGlue: true, typography: true };
const safeOptions = { nfc: true, nfkc: false, aggressive: false, normalizeSpaces: false, normalizeTabs: false, stripGlue: false, typography: false };
const clean = (text: string) => cleanText(text, options);
const cleanSafely = (text: string) => cleanText(text, safeOptions);

describe('forensic report primitives', () => {
  it('uses explicit code-point labels, bounded byte formatting, and printable ratios', () => {
    expect(codepointHex('😀')).toBe('U+1F600');
    expect(utf8Hex(new Uint8Array([0x69, 0x6e, 0x76]))).toBe('69 6E 76');
    expect(printableRatio('ok\u0000')).toBe(67);
  });

  it('creates UTS #39 comparison skeletons without changing source text', () => {
    expect(confusableSkeleton('pаypal')).toBe(confusableSkeleton('paypal'));
  });

  it('reports distinct identifier-like tokens with a shared skeleton', () => {
    expect(cleanSafely('const admin = true; const аdmin = false;')[1].forensic_findings).toContainEqual(expect.objectContaining({
      kind: 'identifier-skeleton-collision', confidence: 'high', detail: expect.stringContaining('"admin", "аdmin"')
    }));
  });

  it('classifies UTS #39 restriction levels and reports mixed decimal systems', () => {
    expect(restrictionLevel('admin')).toBe('ascii-only');
    expect(restrictionLevel('日本語')).toBe('single-script');
    expect(restrictionLevel('pаypal')).toBe('minimally-restrictive');
    const findings = cleanSafely('const pаypal = 1; const account١۲ = 2;')[1].forensic_findings;
    expect(findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'identifier-restriction-level', confidence: 'medium', detail: expect.stringContaining('minimally-restrictive') }),
      expect.objectContaining({ kind: 'mixed-number-system', confidence: 'high', detail: expect.stringContaining('U+0660, U+06F0') })
    ]));
  });
});

describe('cleanText', () => {
  it('labels known general categories without treating regular text as unassigned', () => {
    expect(characterLabel('A')).toContain('(Lu)');
    expect(characterLabel('\uE000')).toContain('(Co)');
  });

  it('removes C0/C1 controls and reports them', () => {
    const [output, report] = clean('A\u0000B\u0008C\u001FD\u007FE\u009FF');
    expect(output).toBe('ABCDEF');
    expect(report.removed_count).toBe(5);
    expect(report.findings.filter((finding) => finding.category === 'controls')).toHaveLength(5);
  });

  it('normalizes tabs and carriage returns without merging text', () => {
    const [output, report] = clean('A\tB\rC');
    expect(output).toBe('A B\nC');
    expect(report.findings.filter((finding) => finding.category === 'controls')).toHaveLength(2);
    expect(cleanSafely('a\tb')[0]).toBe('a\tb');
  });

  it('normalizes every line-ending form to one newline', () => {
    expect(cleanSafely('a\r\nb\rc\u0085d\u2028e\u2029f')[0]).toBe('a\nb\nc\nd\ne\nf');
  });

  it('does not alter comma spacing outside reported character changes', () => {
    const [output, report] = cleanSafely('1,234, 567');
    expect(output).toBe('1,234, 567');
    expect(report.findings).toEqual([]);
  });

  it('reports unmatched bidi controls per paragraph and dense suspicious lines', () => {
    expect(clean('A\u202EB')[1].unmatched_bidi_count).toBe(1);
    expect(clean('A\u202A\u2069B')[1].unmatched_bidi_count).toBe(2);
    expect(clean('A\u202A\n\u202CB')[1].unmatched_bidi_count).toBe(2);
    const [, legacyReport] = clean('A\u206AB');
    expect(legacyReport.findings[0].category).toBe('deprecated-bidi-control');
    const [output, report] = clean('a\u200Bb\u200Bc\u200Bd');
    expect(output).toBe('abcd');
    expect(report.suspicious_lines).toEqual([{ line: 1, count: 3, density: 43 }]);
  });

  it('records Bidi scope boundaries and unmatched closers for forensic review', () => {
    const complete = clean('a\u202Eb\u202Cc')[1].forensic_findings;
    expect(complete).toContainEqual(expect.objectContaining({
      kind: 'bidi-scope', start: 1, end: 4, code_unit_start: 1, code_unit_end: 4, status: 'complete', detail: expect.stringContaining('RIGHT-TO-LEFT OVERRIDE')
    }));
    const incomplete = clean('a\u202Eb')[1];
    expect(incomplete.unmatched_bidi_count).toBe(1);
    expect(incomplete.forensic_findings).toContainEqual(expect.objectContaining({ kind: 'bidi-scope', start: 1, end: 2, status: 'incomplete', detail: expect.stringContaining('kein passendes PDF') }));
    expect(clean('a\u202Cb')[1].forensic_findings).toContainEqual(expect.objectContaining({ kind: 'bidi-scope', start: 1, status: 'incomplete', detail: expect.stringContaining('PDF ohne') }));
  });

  it('uses UAX #9 explicit-scope rules and labels security-sensitive Bidi contexts', () => {
    const url = clean('https://safe.example/ab\u202Ecod.exe\u202C')[1].forensic_findings.find((finding) => finding.kind === 'bidi-scope');
    expect(url).toMatchObject({
      status: 'complete',
      context: 'url',
      logical_preview: '⟦RLO⟧cod.exe⟦PDF⟧',
      detail: expect.stringContaining('Sicherheitsrelevanter Kontext: URL')
    });
    expect(url?.visual_preview).toBe('\u202Ecod.exe\u202C');

    const filename = clean('Anhang: Rechnung\u202Ecod.exe\u202C.pdf')[1].forensic_findings.find((finding) => finding.kind === 'bidi-scope');
    expect(filename).toMatchObject({ context: 'filename', detail: expect.stringContaining('Dateiname/Pfad') });

    const code = clean('`const file = "ok\u202Ecod.exe\u202C"`')[1].forensic_findings.find((finding) => finding.kind === 'bidi-scope');
    expect(code).toMatchObject({ context: 'code', detail: expect.stringContaining('Code') });

    // PDF cannot close an embedding outside the most recent isolate; PDI closes its inner embedding implicitly.
    const invalidPdf = clean('\u202A\u2066x\u202C\u2069')[1];
    expect(invalidPdf.forensic_findings).toContainEqual(expect.objectContaining({ start: 3, status: 'incomplete', detail: expect.stringContaining('PDF ohne') }));
    const pdiClosed = clean('\u2066\u202Ex\u2069')[1].forensic_findings;
    expect(pdiClosed).toContainEqual(expect.objectContaining({ start: 1, status: 'complete', detail: expect.stringContaining('implizit durch PDI') }));
  });

  it('normalizes typography and contextual mixed-script homoglyphs', () => {
    expect(clean('„«Hallo»“ ‹Test› ‚x‘')[0]).toBe('""Hallo"" "Test" \'x\'');
    expect(clean('p\u0430y')[0]).toBe('pay');
    expect(clean('привет мир')[0]).toBe('привет мир');
  });

  it('preserves complete emoji sequences in the safe profile', () => {
    expect(clean('👩‍👩‍👧‍👦')[0]).toBe('👩👩👧👦');
    expect(cleanSafely('❤️ ☕️ 👩🏽‍🤝‍👨🏼 👨‍👩‍👧‍👦')[0]).toBe('❤️ ☕️ 👩🏽‍🤝‍👨🏼 👨‍👩‍👧‍👦');
  });

  it('preserves RGI subdivision flags, Indic and Persian joiners in the safe profile', () => {
    expect(cleanSafely('🏴󠁧󠁢󠁳󠁣󠁴󠁿')[0]).toBe('🏴󠁧󠁢󠁳󠁣󠁴󠁿');
    const output = cleanSafely('म‍क می‌روم')[0];
    expect(output).toContain('म‍क');
    expect(output).toContain('\u200c');
  });

  it('preserves ideographic variation sequences and reports private-use characters safely', () => {
    const [output, report] = cleanSafely('A\uE000B \u4E00\u{E0100}');
    expect(output).toBe('A\uE000B \u4E00\u{E0100}');
    expect(report.findings).toMatchObject([{ codepoint: 'U+E000', action: 'report', category: 'private-use' }]);
  });

  it('removes private-use characters only in the aggressive profile', () => {
    expect(clean('A\uE000B')[0]).toBe('AB');
  });

  it('is idempotent when invisible characters split mixed-script words', () => {
    const once = clean('ра\u200Bypal')[0];
    expect(once).toBe('paypal');
    expect(clean(once)[0]).toBe(once);
  });

  it('preserves non-Latin scripts and normalizes combining characters', () => {
    expect(clean('العربية 世界 हिन्दी')[0]).toBe('العربية 世界 हिन्दी');
    const [output, report] = cleanText('cafe\u0301 ｐaypal', { ...options, nfkc: false });
    expect(output).toBe('café ｐaypal');
    expect(report.normalizations).toEqual([{ start: 3, end: 5, form: 'NFC', before: 'é', after: 'é' }]);
    const [, compatibilityReport] = clean('ｐaypal');
    expect(compatibilityReport.normalizations).toEqual([{ start: 0, end: 1, form: 'NFKC', before: 'ｐ', after: 'p' }]);
    expect(compatibilityReport.replaced_count).toBe(1);
  });

  it('handles very large inputs while reporting every removed character', () => {
    const input = 'Wort\u200B'.repeat(30_000);
    const [output, report] = clean(input);
    expect(output).toBe('Wort'.repeat(30_000));
    expect(report.removed_count).toBe(30_000);
  });

  it('cleans common artifacts from copied PDF, Office, and messenger text', () => {
    const input = '\ufeff„Bericht“\u00a0–\u00a0Teil\u2028Hallo\u200b\u200e Welt';
    expect(clean(input)[0]).toBe('"Bericht" - Teil\nHallo Welt');
  });
});

describe('zero-width binary payloads', () => {
  const encode = (payload: string) => [...new TextEncoder().encode(payload)]
    .map((byte) => byte.toString(2).padStart(8, '0').replaceAll('0', '\u200b').replaceAll('1', '\u200c'))
    .join('\u200d');
  const encodeBase = (payload: string, alphabet: string[]) => [...new TextEncoder().encode(payload)]
    .flatMap((byte) => {
      const width = alphabet.length === 3 ? 6 : 4;
      const digits: number[] = [];
      let value = byte;
      for (let index = 0; index < width; index += 1) {
        digits.unshift(value % alphabet.length);
        value = Math.floor(value / alphabet.length);
      }
      return digits.map((digit) => alphabet[digit]);
    })
    .join('');

  it('decodes printable multi-byte UTF-8 payloads with code-point ranges', () => {
    const input = `ok${encode('€')}!`;
    expect(clean(input)[1].zero_width_payloads).toEqual([{ payload: '€', start: 2, end: 28 }]);
  });

  it('rejects incomplete and non-printable zero-width runs', () => {
    const incomplete = '\u200b'.repeat(7);
    const nul = '\u200b'.repeat(8);
    expect(clean(`a${incomplete}b${nul}c`)[1].zero_width_payloads).toEqual([]);
  });

  it('does not decode normal emoji ZWJ sequences', () => {
    expect(clean('👩‍👩‍👧‍👦')[1].zero_width_payloads).toEqual([]);
  });

  it('adds bounded forensic metadata for decodable and incomplete runs', () => {
    const report = clean(`ok${encode('test')}`)[1];
    expect(report.forensic_findings).toContainEqual(expect.objectContaining({
      kind: 'zero-width-binary', status: 'complete', decoded_text: 'test', encoding: 'UTF-8', printable_ratio: 100
    }));
    expect(clean(`a${'\u200b'.repeat(16)}b`)[1].forensic_findings).toContainEqual(expect.objectContaining({
      kind: 'zero-width-binary', status: 'incomplete'
    }));
  });

  it('tests named ternary and quaternary zero-width hypotheses conservatively', () => {
    const ternary = encodeBase('test', ['\u200b', '\u200c', '\u200d']);
    const quaternary = encodeBase('dGVzdA==', ['\u200b', '\u200c', '\u200d', '\u2060']);
    const findings = clean(`x${ternary}y${quaternary}z`)[1].forensic_findings;
    expect(findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'zero-width-ternary', status: 'complete', decoded_text: 'test', encoding: 'ASCII' }),
      expect.objectContaining({ kind: 'zero-width-quaternary', status: 'complete', decoded_text: 'test', encoding: 'Base64 → UTF-8' })
    ]));
  });

  it('does not treat short, partial, or implausible multi-symbol runs as decoded payloads', () => {
    const short = encodeBase('a', ['\u200b', '\u200c', '\u200d', '\u2060']);
    const invalid = '\u2060'.repeat(16);
    const findings = clean(`x${short}y${invalid}z`)[1].forensic_findings;
    expect(findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'zero-width-quaternary', status: 'incomplete' })
    ]));
    expect(findings).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'zero-width-quaternary', status: 'complete' })
    ]));
  });

  it('caps multi-symbol payload hypotheses at the shared byte limit', () => {
    const overLimit = encodeBase('x'.repeat(4_097), ['\u200b', '\u200c', '\u200d', '\u2060']);
    expect(clean(overLimit)[1].forensic_findings).toContainEqual(expect.objectContaining({
      kind: 'zero-width-quaternary', status: 'incomplete', detail: expect.stringContaining('4096 Bytes begrenzt')
    }));
  });
});

describe('tag and variation-selector forensic findings', () => {
  const selectorBytes = (payload: string) => [...new TextEncoder().encode(payload)]
    .map((byte) => String.fromCodePoint(byte < 16 ? 0xfe00 + byte : 0xe0100 + byte - 16)).join('');

  it('reports complete tags with offsets and preserves known subdivision flags', () => {
    const payload = '\u{E0070}\u{E0061}\u{E0079}\u{E006C}\u{E006F}\u{E0061}\u{E0064}\u{E007F}';
    const report = clean(`x${payload}`)[1];
    expect(report.forensic_findings).toContainEqual(expect.objectContaining({
      kind: 'unicode-tag', start: 1, end: 9, code_unit_start: 1, decoded_text: 'payload', status: 'complete', bytes_hex: '70 61 79 6C 6F 61 64'
    }));
    const flag = clean('🏴󠁧󠁢󠁳󠁣󠁴󠁿')[1].forensic_findings[0];
    expect(flag).toMatchObject({ kind: 'unicode-tag', status: 'registered', decoded_text: 'gbsct' });
  });

  it('only treats long variation-selector runs as a payload hypothesis', () => {
    const report = clean(`A${selectorBytes('test')}`)[1];
    expect(report.forensic_findings).toContainEqual(expect.objectContaining({
      kind: 'variation-selector', carrier: 'A', status: 'complete', decoded_text: 'test', bytes_hex: '74 65 73 74'
    }));
    expect(clean('☕️')[1].forensic_findings).toContainEqual(expect.objectContaining({
      kind: 'variation-selector', status: 'registered', detail: expect.stringContaining('Emoji-Variationssequenz')
    }));
    expect(clean('A️')[1].forensic_findings).toContainEqual(expect.objectContaining({
      kind: 'variation-selector', status: 'unusual'
    }));
    expect(cleanSafely('\u3402\u{E0100}')[1].forensic_findings).toContainEqual(expect.objectContaining({
      kind: 'variation-selector', status: 'registered', detail: expect.stringContaining('Ideographische Variationssequenz')
    }));
  });
});

describe('text hygiene forensic findings', () => {
  it('reports high-complexity graphemes and transport artifacts without changing their policy', () => {
    const report = cleanSafely(`a${'\u0301'.repeat(9)} \nB\uFFFDC\uFEFFD\uFDD0E\uD800`)[1];
    expect(report.forensic_findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'combining-mark-run', status: 'unusual' }),
      expect.objectContaining({ kind: 'trailing-whitespace', status: 'unusual' }),
      expect.objectContaining({ kind: 'replacement-character', status: 'unusual' }),
      expect.objectContaining({ kind: 'mid-text-bom', status: 'unusual' }),
      expect.objectContaining({ kind: 'noncharacter', status: 'unusual' }),
      expect.objectContaining({ kind: 'unpaired-surrogate', status: 'invalid' })
    ]));
  });
});

describe('domain spoof findings', () => {
  it('reports confusable labels in URLs and email domains', () => {
    const url = clean('Visit https://pаypal.com')[1].domain_spoofs;
    const email = clean('Contact user@pаypal.com')[1].domain_spoofs;

    expect(url).toEqual([{ domain: 'pаypal.com', label: 'pаypal', skeleton: 'paypal', character_indexes: [15], risk: 'high', reason: 'mixed-script-confusable' }]);
    expect(email).toEqual([{ domain: 'pаypal.com', label: 'pаypal', skeleton: 'paypal', character_indexes: [14], risk: 'high', reason: 'mixed-script-confusable' }]);
  });

  it('labels Punycode domains for review without claiming spoofing', () => {
    expect(clean('Visit https://xn--bcher-kva.example')[1].domain_spoofs).toEqual([{
      domain: 'xn--bcher-kva.example', label: 'xn--bcher-kva', skeleton: 'xn--bcher-kva', character_indexes: [14], risk: 'medium', reason: 'punycode-label'
    }]);
  });
});

describe('report exports', () => {
  it('serializes metadata without the source or cleaned text', () => {
    const report = clean('ｐaypal\u{E0070}\u{E0061} https://pаypal.com')[1];
    const exported = exportedReport(report, options, '2026-08-15T00:00:00.000Z');
    const markdown = markdownReport(report, options, '2026-08-15T00:00:00.000Z');

    expect(exported).toMatchObject({ report_version: 1, generated_at: '2026-08-15T00:00:00.000Z', options, report });
    expect(reportFileName('brief', 'json')).toBe('brief.report.json');
    expect(reportFileName('brief', 'markdown')).toBe('brief.report.md');
    expect(markdown).toContain('> Der Bericht enthält keine vollständige Eingabe oder bereinigte Ausgabe.');
    expect(markdown).toContain('pаypal.com');
    expect(markdown).toContain('## Unicode-Normalisierungen');
    expect(markdown).toContain('## Dekodierte Tag-Payloads');
    expect(markdown).toContain('U+0070 U+0061');
  });
});

describe('fileMetadata', () => {
  it('derives safe output names for supported uploads', () => {
    expect(fileMetadata('brief.md')).toEqual({ sourceStem: 'brief', sourceExtension: 'md', outputName: 'brief.cleaned.md' });
    expect(fileMetadata('notes.markdown')).toEqual({ sourceStem: 'notes', sourceExtension: 'md', outputName: 'notes.cleaned.md' });
    expect(fileMetadata('export.txt')).toEqual({ sourceStem: 'export', sourceExtension: 'txt', outputName: 'export.cleaned.txt' });
    expect(fileMetadata('ohne-endung')).toEqual({ sourceStem: 'ohne-endung', sourceExtension: 'txt', outputName: 'ohne-endung.cleaned.txt' });
  });
});
