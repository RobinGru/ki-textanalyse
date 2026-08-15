import assert from 'node:assert/strict';
import test from 'node:test';

import { cleanText } from '../assets/js/cleaner.js';
import { fileMetadata } from '../assets/js/files.js';

const options = {
  nfkc: true,
  aggressive: true,
  normalizeSpaces: true,
  stripGlue: true,
  typography: true,
};

function clean(text) {
  return cleanText(text, options);
}

test('removes C0/C1 controls and reports them', () => {
  const [output, report] = clean('A\u0000B\u0008C\u001FD\u007FE\u009FF');

  assert.equal(output, 'ABCDEF');
  assert.equal(report.removed_count, 5);
  assert.equal(report.findings.filter((finding) => finding.category === 'controls').length, 5);
});

test('normalizes tabs and carriage returns without merging text', () => {
  const [output, report] = clean('A\tB\rC');

  assert.equal(output, 'A B\nC');
  assert.equal(report.findings.filter((finding) => finding.category === 'controls').length, 2);
});

test('reports unmatched bidi controls separately', () => {
  const [output, report] = clean('A\u202EB');

  assert.equal(output, 'AB');
  assert.equal(report.unmatched_bidi_count, 1);
});

test('reports dense suspicious lines', () => {
  const [output, report] = clean('a\u200Bb\u200Bc\u200Bd');

  assert.equal(output, 'abcd');
  assert.deepEqual(report.suspicious_lines, [{ line: 1, count: 3, density: 43 }]);
});

test('normalizes quote variants and guillemets to ASCII quotes', () => {
  const [output] = clean('„«Hallo»“ ‹Test› ‚x‘');

  assert.equal(output, '""Hallo"" "Test" \'x\'');
});

test('only replaces contextual mixed-script homoglyphs', () => {
  assert.equal(clean('p\u0430y')[0], 'pay');
  assert.equal(clean('привет мир')[0], 'привет мир');
});

test('derives safe output names for supported uploads', () => {
  assert.deepEqual(fileMetadata('brief.md'), { sourceStem: 'brief', sourceExtension: 'md', outputName: 'brief.cleaned.md' });
  assert.deepEqual(fileMetadata('notes.markdown'), { sourceStem: 'notes', sourceExtension: 'md', outputName: 'notes.cleaned.md' });
  assert.deepEqual(fileMetadata('export.txt'), { sourceStem: 'export', sourceExtension: 'txt', outputName: 'export.cleaned.txt' });
  assert.deepEqual(fileMetadata('ohne-endung'), { sourceStem: 'ohne-endung', sourceExtension: 'txt', outputName: 'ohne-endung.cleaned.txt' });
});
