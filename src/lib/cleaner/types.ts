/**
 * Stable, UI-independent contract for the Unicode cleaning engine.
 *
 * Keep report fields additive: exported JSON reports are consumed outside the
 * Svelte UI and may be used by automation or AI-assisted review workflows.
 */
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

export type FindingConfidence = 'info' | 'low' | 'medium' | 'high';
export type FindingStatus = 'complete' | 'incomplete' | 'invalid' | 'registered' | 'unusual';

/** Ranges use code-point indexes; UTF-16 offsets are supplied for browser APIs. */
export interface ForensicFinding {
  kind: string;
  start: number;
  end: number;
  code_unit_start: number;
  code_unit_end: number;
  raw_codepoints: string[];
  confidence: FindingConfidence;
  status: FindingStatus;
  carrier?: string;
  decoded_text?: string;
  bytes_hex?: string;
  encoding?: string;
  printable_ratio?: number;
  logical_preview?: string;
  visual_preview?: string;
  context?: 'url' | 'filename' | 'code';
  detail?: string;
}

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
  risk: 'medium' | 'high';
  reason: 'mixed-script-confusable' | 'punycode-label';
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
  forensic_findings: ForensicFinding[];
}
