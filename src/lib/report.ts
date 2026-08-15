import type { CleaningOptions, CleaningReport } from './cleaner';

export type ReportFormat = 'json' | 'markdown';

export interface ExportedCleaningReport {
  report_version: 1;
  generated_at: string;
  options: CleaningOptions;
  report: CleaningReport;
}

export function reportFileName(sourceStem: string, format: ReportFormat): string {
  return `${sourceStem}.report.${format === 'json' ? 'json' : 'md'}`;
}

export function exportedReport(report: CleaningReport, options: CleaningOptions, generatedAt = new Date().toISOString()): ExportedCleaningReport {
  return { report_version: 1, generated_at: generatedAt, options, report };
}

const inline = (value: string) => JSON.stringify(value).replaceAll('|', '\\|');

export function markdownReport(report: CleaningReport, options: CleaningOptions, generatedAt = new Date().toISOString()): string {
  const exported = exportedReport(report, options, generatedAt);
  const lines = [
    '# Prüfbericht',
    '',
    `Erstellt: ${exported.generated_at}`,
    '',
    '> Der Bericht enthält keine vollständige Eingabe oder bereinigte Ausgabe.',
    '> Funde sind technische Hinweise und kein Urheberschaftsnachweis.',
    '',
    '## Zusammenfassung',
    '',
    `- Eingabe: ${report.input_length} Codepoints`,
    `- Ausgabe: ${report.output_length} Codepoints`,
    `- Entfernt: ${report.removed_count}`,
    `- Ersetzt: ${report.replaced_count}`,
    `- Nicht geschlossene Bidi-Paare: ${report.unmatched_bidi_count}`,
    '',
    '## Optionen',
    '',
    ...Object.entries(options).map(([name, enabled]) => `- ${name}: ${enabled ? 'aktiv' : 'inaktiv'}`),
    '',
    '## Dekodierte Zero-Width-Payloads',
    ''
  ];

  if (report.zero_width_payloads.length) {
    lines.push('| Positionen | UTF-8-Payload |', '| --- | --- |');
    lines.push(...report.zero_width_payloads.map(({ start, end, payload }) => `| ${start + 1}–${end} | ${inline(payload)} |`));
  } else {
    lines.push('Keine formatgültigen Payloads gefunden.');
  }

  lines.push('', '## Verdächtige Domains', '');
  if (report.domain_spoofs.length) {
    lines.push('| Domain | Label | ASCII-Skelett | Positionen |', '| --- | --- | --- | --- |');
    lines.push(...report.domain_spoofs.map(({ domain, label, skeleton, character_indexes }) => `| ${inline(domain)} | ${inline(label)} | ${inline(skeleton)} | ${character_indexes.map((index) => index + 1).join(', ')} |`));
  } else {
    lines.push('Keine verdächtigen Domain-Labels gefunden.');
  }

  lines.push('', '## Zeichenänderungen', '');
  if (report.findings.length) {
    lines.push('| Position | Codepoint | Kategorie | Aktion | Grund |', '| --- | --- | --- | --- | --- |');
    lines.push(...report.findings.map((finding) => `| ${finding.position + 1} | ${finding.codepoint} | ${finding.category} | ${finding.action} | ${inline(finding.reason)} |`));
  } else {
    lines.push('Keine direkt bereinigten Zeichen gefunden.');
  }

  return `${lines.join('\n')}\n`;
}
