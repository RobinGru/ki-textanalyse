<script lang="ts">
  import { cleanText, characterLabel, decide, mixedConfusableIndexes, tagAnalysis, type CleaningReport } from '$lib/cleaner';
  import { codepoints, isGlue } from '$lib/cleaner/constants';
  import { fileMetadata } from '$lib/files';

  const maxMarkedCodepoints = 20_000;
  const labels: Record<string, string> = { invisible: 'unsichtbare Zeichen', controls: 'Steuerzeichen', bidi: 'Richtungssteuerungen', tags: 'versteckte Tag-Zeichen', variation: 'Variation-Selectoren', spaces: 'ungewöhnliche Leerzeichen', typography: 'typografische Ersetzungen', confusables: 'Mixed-Script-Lookalikes' };
  const colors: Record<string, string> = { invisible: 'badge-success', controls: 'badge-error', bidi: 'badge-error', tags: 'badge-error', variation: 'badge-warning', spaces: 'badge-warning', typography: 'badge-info', confusables: 'badge-error' };

  let inputElement: HTMLDivElement;
  let outputElement: HTMLTextAreaElement;
  let inputText = '';
  let outputText = '';
  let report: CleaningReport | null = null;
  let marked = false;
  let markingNote = '';
  let copyStatus = '';
  let copyStatusType: 'success' | 'error' = 'success';
  let copyStatusTimer: ReturnType<typeof setTimeout> | undefined;
  let copyButtonTimer: ReturnType<typeof setTimeout> | undefined;
  let copyButtonLabel = 'Ausgabe kopieren';
  let copyTemporarilyDisabled = false;
  let liveTimer: ReturnType<typeof setTimeout> | undefined;
  let sourceStem = 'text';
  let sourceExtension = 'txt';
  let outputName = 'text.cleaned.txt';
  let nfkc = true;
  let aggressive = true;
  let normalizeSpaces = true;
  let stripGlue = true;
  let typography = true;

  $: options = { nfkc, aggressive, normalizeSpaces, stripGlue, typography };
  $: inputLength = `${codepoints(inputText).length} Zeichen`;
  $: outputLength = `${codepoints(outputText).length} Zeichen`;
  $: categories = report ? Object.entries(report.findings.reduce<Record<string, number>>((counts, finding) => ({ ...counts, [finding.category]: (counts[finding.category] ?? 0) + 1 }), {})) : [];

  function hideCopyStatus() {
    if (copyStatusTimer) clearTimeout(copyStatusTimer);
    copyStatus = '';
  }

  function showCopyStatus(message: string, type: 'success' | 'error') {
    if (copyStatusTimer) clearTimeout(copyStatusTimer);
    copyStatus = message;
    copyStatusType = type;
    copyStatusTimer = setTimeout(() => copyStatus = '', 4000);
  }

  function setInputText(text: string) {
    inputText = text;
    inputElement.textContent = text;
    marked = false;
    markingNote = '';
    hideCopyStatus();
  }

  function markOriginalText() {
    const chars = codepoints(inputText);
    if (chars.length > maxMarkedCodepoints) {
      inputElement.textContent = inputText;
      marked = false;
      markingNote = `Markierungen sind ab ${maxMarkedCodepoints.toLocaleString('de-DE')} Zeichen deaktiviert, damit die Eingabe flüssig bleibt.`;
      return;
    }

    const fragment = document.createDocumentFragment();
    let previousKept: string | null = null;
    const tags = tagAnalysis(inputText);
    const confusableIndexes = mixedConfusableIndexes(chars);
    for (let index = 0; index < chars.length; index += 1) {
      const character = chars[index];
      const [action, result] = decide(character, previousKept, options, chars[index + 1] ?? '', tags.trusted.has(index), confusableIndexes.has(index));
      const changedByNfkc = options.nfkc && character.normalize('NFKC') !== character;
      if (action === 'strip') {
        const marker = document.createElement('span');
        marker.className = 'changed-character removed-marker';
        marker.title = `${characterLabel(character)} wird entfernt`;
        marker.textContent = `⟦U+${character.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}⟧`;
        fragment.append(marker);
      } else if (action === 'replace' || changedByNfkc) {
        const marker = document.createElement('span');
        marker.className = 'changed-character';
        marker.title = `${characterLabel(character)} wird verändert`;
        marker.textContent = character;
        fragment.append(marker);
      } else {
        fragment.append(document.createTextNode(character));
      }
      if (action === 'replace' || (!isGlue(character.codePointAt(0)!) && action === 'keep')) previousKept = result;
    }
    inputElement.replaceChildren(fragment);
    marked = true;
    markingNote = '';
  }

  function runCleaner(markInput = false) {
    if (!inputText.length) {
      outputText = '';
      report = null;
      return;
    }
    const [cleaned, nextReport] = cleanText(inputText, options);
    outputText = cleaned;
    report = nextReport;
    if (markInput) markOriginalText();
  }

  function onInput() {
    inputText = inputElement.innerText;
    marked = false;
    markingNote = '';
    hideCopyStatus();
    if (liveTimer) clearTimeout(liveTimer);
    liveTimer = setTimeout(() => runCleaner(), 180);
  }

  function onOptionChange() {
    runCleaner();
  }

  async function onFileChange(event: Event) {
    const file = (event.currentTarget as HTMLInputElement).files?.[0];
    if (!file) return;
    setInputText(await file.text());
    ({ sourceStem, sourceExtension, outputName } = fileMetadata(file.name));
    outputText = '';
    report = null;
  }

  function insertSample() {
    setInputText('# Beispieltext\n\n① Dieser​ längere Beispieltext zeigt, wie unsichtbare Zeichen, ungewöhnliche Abstände, kyrillische Homoglyphen wie pаy und Emoji-Selektoren in ⚖️ erkannt werden. Er enthält mehrere vollständige Sätze, damit die Markierungen und die bereinigte Ausgabe auch bei realistischen Textmengen gut überprüft werden können.');
    sourceStem = 'text';
    sourceExtension = 'txt';
    outputName = 'text.cleaned.txt';
    outputText = '';
    report = null;
    inputElement.focus();
  }

  async function copyOutput() {
    if (!outputText) return;
    try {
      await navigator.clipboard.writeText(outputText);
    } catch {
      outputElement.focus();
      outputElement.select();
      const copied = document.execCommand('copy');
      outputElement.setSelectionRange(0, 0);
      if (!copied) {
        showCopyStatus('Kopieren wurde vom Browser blockiert. Bitte markiere die Ausgabe und kopiere sie manuell.', 'error');
        return;
      }
    }
    showCopyStatus('Bereinigte Ausgabe wurde kopiert.', 'success');
    if (copyButtonTimer) clearTimeout(copyButtonTimer);
    copyButtonLabel = 'Kopiert';
    copyTemporarilyDisabled = true;
    copyButtonTimer = setTimeout(() => {
      copyButtonLabel = 'Ausgabe kopieren';
      copyTemporarilyDisabled = false;
    }, 1600);
  }

  function downloadOutput() {
    const url = URL.createObjectURL(new Blob([outputText], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = outputName;
    link.click();
    URL.revokeObjectURL(url);
  }
</script>

<section class="card compact-card bg-base-100 shadow-sm"><div class="card-body gap-5">
  <div class="file-grid">
    <details class="collapse collapse-arrow tools-collapse"><summary class="collapse-title">Datei hochladen</summary><div class="collapse-content"><input class="file-input w-full" type="file" accept="text/plain,text/markdown,.txt,.md,.markdown" aria-describedby="file-description" onchange={onFileChange} /><p id="file-description" class="label">Text- oder Markdown-Datei auswählen.</p><div class="upload-actions"><button class="btn" type="button" disabled={!outputText} onclick={downloadOutput}>Bereinigte Datei herunterladen</button></div></div></details>
    <details class="collapse collapse-arrow options-collapse"><summary class="collapse-title">Optionen</summary><div class="collapse-content"><div class="options">
      <label class="label cursor-pointer justify-start gap-3"><input class="checkbox" type="checkbox" bind:checked={nfkc} onchange={onOptionChange} /><span>Unicode-NFKC nach dem Bereinigen anwenden</span></label>
      <label class="label cursor-pointer justify-start gap-3"><input class="checkbox" type="checkbox" bind:checked={aggressive} onchange={onOptionChange} /><span>Kyrillische und Fullwidth-Latin-Homoglyphen in ASCII umwandeln</span></label>
      <label class="label cursor-pointer justify-start gap-3"><input class="checkbox" type="checkbox" bind:checked={normalizeSpaces} onchange={onOptionChange} /><span>Ungewöhnliche Leerzeichen in normale Leerzeichen umwandeln</span></label>
      <label class="label cursor-pointer justify-start gap-3"><input class="checkbox" type="checkbox" bind:checked={stripGlue} onchange={onOptionChange} /><span>Streng: Emoji-Verkettungen und skriptspezifische unsichtbare Zeichen ebenfalls entfernen</span></label>
      <label class="label cursor-pointer justify-start gap-3"><input class="checkbox" type="checkbox" bind:checked={typography} onchange={onOptionChange} /><span>Typografie in ASCII normalisieren (Anführungszeichen, Gedankenstriche, Ellipsen)</span></label>
    </div></div></details>
  </div>
  <div class="workspace-grid">
    <section class="card workspace-panel bg-base-100 shadow-sm" aria-labelledby="input-title"><div class="card-body"><div class="panel-heading"><h2 id="input-title" class="card-title">Zu prüfender Text</h2><p class="label panel-length">{inputLength}</p></div><div bind:this={inputElement} class:marked class="textarea editor input-editor" role="textbox" aria-labelledby="input-title" aria-describedby="input-marking-note" aria-multiline="true" contenteditable="true" spellcheck="false" data-placeholder="Text hier einfügen …" onfocus={() => marked && setInputText(inputText)} oninput={onInput}></div>{#if markingNote}<p id="input-marking-note" class="label marking-note" role="status">{markingNote}</p>{/if}<div class="card-actions actions"><button class="btn" type="button" onclick={insertSample}>Beispieltext einfügen</button><button class="btn btn-primary" type="button" onclick={() => runCleaner(true)}>Text prüfen und bereinigen</button></div></div></section>
    <aside class="card workspace-panel bg-base-100 shadow-sm" aria-labelledby="stats-title"><div class="card-body"><div class="panel-heading"><h2 id="stats-title" class="card-title">Erkannte Auffälligkeiten</h2></div>{#if !report}<p class="report-empty">Füge Text ein, um potenzielle Wasserzeichenmuster zu prüfen.</p>{:else}<div class="detection-list" aria-live="polite">{#each categories as [category, count]}<span class={`badge ${colors[category]} detection-chip`}><span>{labels[category]}</span><strong>{count}</strong></span>{/each}{#if report.unmatched_bidi_count}<span class="badge badge-error detection-chip"><span>nicht geschlossene Bidi-Paare</span><strong>{report.unmatched_bidi_count}</strong></span>{/if}{#each report.suspicious_lines as line}<span class="badge badge-warning detection-chip"><span>Zeile {line.line}: Auffälligkeiten</span><strong>{line.count}</strong></span>{/each}<div class="badge detection-chip summary-line"><span><strong>{report.removed_count}</strong> entfernt</span><span><strong>{report.replaced_count}</strong> ersetzt</span></div></div>{/if}</div></aside>
  </div>
  <section class="card workspace-panel bg-base-100 shadow-sm" aria-labelledby="output-title"><div class="card-body"><div class="panel-heading"><h2 id="output-title" class="card-title">Bereinigter Text</h2><div class="panel-meta"><p class="label panel-length">{outputLength}</p><button class="btn btn-sm" type="button" disabled={!outputText || copyTemporarilyDisabled} onclick={copyOutput}>{copyButtonLabel}</button></div></div><textarea bind:this={outputElement} class="textarea editor" spellcheck="false" readonly aria-labelledby="output-title" aria-live="polite" placeholder="Die Ausgabe erscheint nach dem Bereinigen." value={outputText}></textarea>{#if copyStatus}<p class={`label copy-status copy-status-${copyStatusType}`} role="status" aria-live="polite">{copyStatus}</p>{/if}</div></section>
</div></section>
