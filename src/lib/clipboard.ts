export type ClipboardFindingKind = 'hidden-element' | 'hidden-input' | 'html-comment' | 'metadata-attribute' | 'word-break' | 'zero-width' | 'inline-style' | 'stylesheet-rule' | 'embedded-font' | 'text-difference';
export type ClipboardFindingSeverity = 'info' | 'warning';

export interface ClipboardFinding {
  kind: ClipboardFindingKind;
  severity: ClipboardFindingSeverity;
  detail: string;
}

export interface ClipboardAnalysis {
  plain: string;
  html: string;
  domText: string;
  visibleText: string;
  findings: ClipboardFinding[];
}

const invisibleCharacters = /[\u200B-\u200D\u2060\uFEFF]/u;
const hidingStyle = /(?:display\s*:\s*none|visibility\s*:\s*hidden|content-visibility\s*:\s*hidden|opacity\s*:\s*0(?:\D|$)|font-size\s*:\s*0(?:\D|$)|(?:left|top|right|bottom)\s*:\s*-\s*(?:999|[1-9]\d{3,})px)/i;

function normalized(text: string) {
  return text.replace(/\s+/g, ' ').trim();
}

function isHidden(element: Element) {
  if (element.hasAttribute('hidden')) return true;
  const style = element.getAttribute('style') ?? '';
  return hidingStyle.test(style);
}

function hasMatchingInlineColors(style: string) {
  const color = style.match(/(?:^|;)\s*color\s*:\s*([^;]+)/i)?.[1]?.trim().toLowerCase();
  const background = style.match(/(?:^|;)\s*background(?:-color)?\s*:\s*([^;]+)/i)?.[1]?.trim().toLowerCase();
  return Boolean(color && background && color === background);
}

function visibleTextFrom(node: Node, hidden = false): string {
  if (node.nodeType === Node.TEXT_NODE) return hidden ? '' : (node.textContent ?? '');
  if (node.nodeType !== Node.ELEMENT_NODE && node.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return '';
  const element = node as Element;
  const nextHidden = hidden || (node.nodeType === Node.ELEMENT_NODE && isHidden(element));
  return [...node.childNodes].map((child) => visibleTextFrom(child, nextHidden)).join('');
}

function elementDescription(element: Element) {
  const id = element.getAttribute('id');
  const className = element.getAttribute('class');
  return `<${element.tagName.toLowerCase()}${id ? `#${id}` : ''}${className ? `.${className.split(/\s+/)[0]}` : ''}>`;
}

/** Parses clipboard HTML in an inert document; the returned data is never inserted into the page. */
export function analyzeClipboardPayload({ plain, html }: { plain: string; html: string }): ClipboardAnalysis {
  if (!html) return { plain, html, domText: plain, visibleText: plain, findings: [] };

  const document = new DOMParser().parseFromString(html, 'text/html');
  const findings: ClipboardFinding[] = [];
  const add = (kind: ClipboardFindingKind, severity: ClipboardFindingSeverity, detail: string) => findings.push({ kind, severity, detail });

  const domText = document.body.textContent ?? '';
  const visibleText = visibleTextFrom(document.body);
  for (const element of document.body.querySelectorAll('*')) {
    const description = elementDescription(element);
    if (element.matches('input[type="hidden"]')) add('hidden-input', 'warning', `${description} ist ein verstecktes Eingabefeld.`);
    else if (isHidden(element)) add('hidden-element', 'warning', `${description} ist durch ein Attribut oder einen Inline-Stil ausgeblendet.`);
    const style = element.getAttribute('style') ?? '';
    if (style && hidingStyle.test(style)) add('inline-style', 'warning', `${description} enthält einen möglicherweise versteckenden Inline-Stil.`);
    if (hasMatchingInlineColors(style)) add('inline-style', 'warning', `${description} verwendet dieselbe Inline-Farbe für Text und Hintergrund.`);
    if (element.tagName === 'WBR') add('word-break', 'info', `${description} enthält eine optionale Worttrennung.`);
    for (const attribute of [...element.attributes]) {
      if ((attribute.name === 'aria-label' || attribute.name === 'alt' || attribute.name === 'title' || attribute.name.startsWith('data-')) && attribute.value.trim()) {
        add('metadata-attribute', 'info', `${description} enthält ${attribute.name} mit Textinhalt.`);
      }
    }
  }
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_COMMENT);
  while (walker.nextNode()) {
    if (walker.currentNode.textContent?.trim()) add('html-comment', 'warning', 'Ein HTML-Kommentar enthält Text.');
  }
  if (invisibleCharacters.test(html)) add('zero-width', 'warning', 'Der HTML-Quelltext enthält Zero-Width- oder BOM-Zeichen.');
  for (const style of document.querySelectorAll('style')) {
    const css = style.textContent ?? '';
    if (hidingStyle.test(css)) add('stylesheet-rule', 'warning', 'Ein eingebettetes Stylesheet enthält eine möglicherweise versteckende Regel.');
    if (/@font-face\b/i.test(css)) add('embedded-font', 'info', 'Ein eingebettetes Stylesheet definiert eine Schriftart; Glyphen-Zuordnungen werden nicht ausgewertet.');
  }
  if (normalized(plain) !== normalized(visibleText)) add('text-difference', 'warning', 'text/plain und der heuristisch sichtbare HTML-Text unterscheiden sich.');

  return { plain, html, domText, visibleText, findings };
}
