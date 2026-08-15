import { describe, expect, it } from 'vitest';

import { cleanText } from './index';
import { fileMetadata } from '$lib/files';
import { exportedReport, markdownReport, reportFileName } from '$lib/report';

const options = { nfkc: true, aggressive: true, normalizeSpaces: true, stripGlue: true, typography: true };
const safeOptions = { nfkc: false, aggressive: false, normalizeSpaces: false, stripGlue: false, typography: false };
const clean = (text: string) => cleanText(text, options);
const cleanSafely = (text: string) => cleanText(text, safeOptions);

describe('cleanText', () => {
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
  });

  it('normalizes every line-ending form to one newline', () => {
    expect(cleanSafely('a\r\nb\rc\u0085d\u2028e\u2029f')[0]).toBe('a\nb\nc\nd\ne\nf');
  });

  it('does not alter comma spacing outside reported character changes', () => {
    const [output, report] = cleanSafely('1,234, 567');
    expect(output).toBe('1,234, 567');
    expect(report.findings).toEqual([]);
  });

  it('reports unmatched bidi controls and dense suspicious lines', () => {
    expect(clean('A\u202EB')[1].unmatched_bidi_count).toBe(1);
    const [output, report] = clean('a\u200Bb\u200Bc\u200Bd');
    expect(output).toBe('abcd');
    expect(report.suspicious_lines).toEqual([{ line: 1, count: 3, density: 43 }]);
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
    const [output, report] = clean('cafe\u0301');
    expect(output).toBe('café');
    expect(report.replaced.NFKC_normalize).toBe(1);
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
});

describe('domain spoof findings', () => {
  it('reports confusable labels in URLs and email domains', () => {
    const url = clean('Visit https://pаypal.com')[1].domain_spoofs;
    const email = clean('Contact user@pаypal.com')[1].domain_spoofs;

    expect(url).toEqual([{ domain: 'pаypal.com', label: 'pаypal', skeleton: 'paypal', character_indexes: [15] }]);
    expect(email).toEqual([{ domain: 'pаypal.com', label: 'pаypal', skeleton: 'paypal', character_indexes: [14] }]);
  });
});

describe('report exports', () => {
  it('serializes metadata without the source or cleaned text', () => {
    const report = clean('https://pаypal.com')[1];
    const exported = exportedReport(report, options, '2026-08-15T00:00:00.000Z');
    const markdown = markdownReport(report, options, '2026-08-15T00:00:00.000Z');

    expect(exported).toMatchObject({ report_version: 1, generated_at: '2026-08-15T00:00:00.000Z', options, report });
    expect(reportFileName('brief', 'json')).toBe('brief.report.json');
    expect(reportFileName('brief', 'markdown')).toBe('brief.report.md');
    expect(markdown).toContain('> Der Bericht enthält keine vollständige Eingabe oder bereinigte Ausgabe.');
    expect(markdown).toContain('pаypal.com');
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
