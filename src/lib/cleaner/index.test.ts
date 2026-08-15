import { describe, expect, it } from 'vitest';

import { cleanText } from './index';
import { fileMetadata } from '$lib/files';

const options = { nfkc: true, aggressive: true, normalizeSpaces: true, stripGlue: true, typography: true };
const clean = (text: string) => cleanText(text, options);

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
});

describe('fileMetadata', () => {
  it('derives safe output names for supported uploads', () => {
    expect(fileMetadata('brief.md')).toEqual({ sourceStem: 'brief', sourceExtension: 'md', outputName: 'brief.cleaned.md' });
    expect(fileMetadata('notes.markdown')).toEqual({ sourceStem: 'notes', sourceExtension: 'md', outputName: 'notes.cleaned.md' });
    expect(fileMetadata('export.txt')).toEqual({ sourceStem: 'export', sourceExtension: 'txt', outputName: 'export.cleaned.txt' });
    expect(fileMetadata('ohne-endung')).toEqual({ sourceStem: 'ohne-endung', sourceExtension: 'txt', outputName: 'ohne-endung.cleaned.txt' });
  });
});
