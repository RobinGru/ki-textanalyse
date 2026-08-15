<script lang="ts">
  import { onMount } from 'svelte';
  import { Check, Clipboard, Download, FileUp, ScanSearch, Sparkles } from '@lucide/svelte';
  import { cleanText, characterLabel, decide, emojiSequenceIndexes, ideographicVariationIndexes, mixedConfusableIndexes, tagAnalysis, type CleaningReport } from '$lib/cleaner';
  import { codepoints, isGlue } from '$lib/cleaner/constants';
  import { fileMetadata } from '$lib/files';
  import { exportedReport, markdownReport, reportFileName, type ReportFormat } from '$lib/report';

  const maxMarkedCodepoints = 20_000;
  const maxComparisonEntries = 250;
  const labels: Record<string, string> = { invisible: 'unsichtbare Zeichen', controls: 'Steuerzeichen', bidi: 'Richtungssteuerungen', 'deprecated-bidi-control': 'veraltete Bidi-Steuerzeichen', tags: 'versteckte Tag-Zeichen', variation: 'Variationsselektoren', 'private-use': 'private Zeichensemantik', spaces: 'ungewöhnliche Leerzeichen', typography: 'typografische Ersetzungen', confusables: 'schriftsystemübergreifende Lookalikes' };
  const colors: Record<string, string> = { invisible: 'badge-success', controls: 'badge-error', bidi: 'badge-error', 'deprecated-bidi-control': 'badge-error', tags: 'badge-error', variation: 'badge-warning', 'private-use': 'badge-warning', spaces: 'badge-warning', typography: 'badge-info', confusables: 'badge-error' };

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
  let nfc = true;
  let nfkc = false;
  let aggressive = true;
  let normalizeSpaces = true;
  let normalizeTabs = true;
  let stripGlue = true;
  let typography = true;

  $: options = { nfc, nfkc, aggressive, normalizeSpaces, normalizeTabs, stripGlue, typography };
  $: inputLength = `${codepoints(inputText).length} Zeichen`;
  $: outputLength = `${codepoints(outputText).length} Zeichen`;
  $: categories = report ? Object.entries(report.findings.reduce<Record<string, number>>((counts, finding) => ({ ...counts, [finding.category]: (counts[finding.category] ?? 0) + 1 }), {})) : [];
  $: comparisonEntries = report ? report.findings.slice(0, maxComparisonEntries).map((finding) => ({
    ...finding,
    before: codepoints(inputText)[finding.position] ?? '',
  })) : [];
  $: comparisonIsTruncated = Boolean(report && report.findings.length > maxComparisonEntries);

  onMount(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('share-target') !== '1') return;

    const shared = [params.get('title'), params.get('text'), params.get('url')]
      .filter((value): value is string => Boolean(value))
      .join('\n\n');
    if (!shared) return;

    setInputText(shared);
    runCleaner();
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.hash}`);
  });

  function payloadCodepoints(payload: string) {
    return codepoints(payload).map((character) => `U+${character.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}`).join(' ');
  }

  function payloadHex(payload: string) {
    return [...new TextEncoder().encode(payload)].map((byte) => byte.toString(16).toUpperCase().padStart(2, '0')).join(' ');
  }

  function displayComparisonValue(value: string | null) {
    if (value === null || value === '') return 'entfernt';
    if (value === ' ') return 'Leerzeichen';
    if (value === '\n') return 'Zeilenumbruch';
    if (value === '\t') return 'Tabulator';
    return value;
  }

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
    const emojiGlueIndexes = emojiSequenceIndexes(chars);
    const ideographicVariations = ideographicVariationIndexes(chars);
    for (let index = 0; index < chars.length; index += 1) {
      const character = chars[index];
      const [action, result] = decide(character, previousKept, options, chars[index + 1] ?? '', tags.trusted.has(index), confusableIndexes.has(index), emojiGlueIndexes.has(index), ideographicVariations.has(index));
      const changedByNormalization = (options.nfkc || options.nfc) && character.normalize(options.nfkc ? 'NFKC' : 'NFC') !== character;
      if (action === 'strip') {
        const marker = document.createElement('span');
        marker.className = 'changed-character removed-marker';
        marker.title = `${characterLabel(character)} wird entfernt`;
        marker.textContent = `⟦U+${character.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}⟧`;
        fragment.append(marker);
      } else if (action === 'replace' || changedByNormalization) {
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
        showCopyStatus('Der Browser hat das Kopieren blockiert. Bitte markiere die Ausgabe und kopiere sie manuell.', 'error');
        return;
      }
    }
    showCopyStatus('Die bereinigte Ausgabe wurde kopiert.', 'success');
    if (copyButtonTimer) clearTimeout(copyButtonTimer);
    copyButtonLabel = 'Kopiert';
    copyTemporarilyDisabled = true;
    copyButtonTimer = setTimeout(() => {
      copyButtonLabel = 'Ausgabe kopieren';
      copyTemporarilyDisabled = false;
    }, 1600);
  }

  function downloadBlob(content: string, type: string, name: string) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    URL.revokeObjectURL(url);
  }

  function downloadOutput() {
    downloadBlob(outputText, 'text/plain;charset=utf-8', outputName);
  }

  function downloadReport(format: ReportFormat) {
    if (!report) return;
    const content = format === 'json'
      ? `${JSON.stringify(exportedReport(report, options), null, 2)}\n`
      : markdownReport(report, options);
    downloadBlob(content, format === 'json' ? 'application/json;charset=utf-8' : 'text/markdown;charset=utf-8', reportFileName(sourceStem, format));
  }
</script>

<section class="card compact-card bg-base-100 shadow-sm"><div class="card-body gap-5">
  <div class="file-grid">
    <details class="collapse collapse-arrow tools-collapse"><summary class="collapse-title"><FileUp size={17} aria-hidden="true" />Datei hochladen</summary><div class="collapse-content"><input class="file-input w-full" type="file" accept="text/plain,text/markdown,.txt,.md,.markdown" aria-describedby="file-description" onchange={onFileChange} /><p id="file-description" class="label">Text- oder Markdown-Datei auswählen.</p><div class="upload-actions"><button class="btn" type="button" disabled={!outputText} onclick={downloadOutput}><Download size={16} aria-hidden="true" />Bereinigte Datei herunterladen</button><button class="btn" type="button" disabled={!report} onclick={() => downloadReport('json')}><Download size={16} aria-hidden="true" />Bericht als JSON</button><button class="btn" type="button" disabled={!report} onclick={() => downloadReport('markdown')}><Download size={16} aria-hidden="true" />Bericht als Markdown</button></div></div></details>
    <details class="collapse collapse-arrow options-collapse"><summary class="collapse-title">Optionen</summary><div class="collapse-content"><div class="options">
      <label class="label cursor-pointer justify-start gap-3"><input class="checkbox" type="checkbox" bind:checked={nfc} onchange={onOptionChange} /><span>Unicode-NFC-Normalisierung anwenden (konservativ)</span></label>
      <label class="label cursor-pointer justify-start gap-3"><input class="checkbox" type="checkbox" bind:checked={nfkc} onchange={onOptionChange} /><span>Kompatibilitätsfaltung mit Unicode-NFKC anwenden (kann Zeichenbedeutungen zusammenführen)</span></label>
      <label class="label cursor-pointer justify-start gap-3"><input class="checkbox" type="checkbox" bind:checked={aggressive} onchange={onOptionChange} /><span>Kyrillische und Fullwidth-Latin-Homoglyphen umwandeln sowie Private-Use-Zeichen entfernen</span></label>
      <label class="label cursor-pointer justify-start gap-3"><input class="checkbox" type="checkbox" bind:checked={normalizeSpaces} onchange={onOptionChange} /><span>Ungewöhnliche Leerzeichen in normale Leerzeichen umwandeln</span></label>
      <label class="label cursor-pointer justify-start gap-3"><input class="checkbox" type="checkbox" bind:checked={normalizeTabs} onchange={onOptionChange} /><span>Prosa: Tabulatoren in Leerzeichen umwandeln (für Code und TSV deaktivieren)</span></label>
      <label class="label cursor-pointer justify-start gap-3"><input class="checkbox" type="checkbox" bind:checked={stripGlue} onchange={onOptionChange} /><span>Streng: Emoji-Verkettungen und skriptspezifische unsichtbare Zeichen ebenfalls entfernen</span></label>
      <label class="label cursor-pointer justify-start gap-3"><input class="checkbox" type="checkbox" bind:checked={typography} onchange={onOptionChange} /><span>Typografie in ASCII normalisieren (Anführungszeichen, Gedankenstriche, Ellipsen)</span></label>
    </div></div></details>
  </div>
  <div class="workspace-grid">
    <section class="card workspace-panel bg-base-100 shadow-sm" aria-labelledby="input-title"><div class="card-body"><div class="panel-heading"><h2 id="input-title" class="card-title">Zu prüfender Text</h2><p class="label panel-length">{inputLength}</p></div><div bind:this={inputElement} class:marked class="textarea editor input-editor" role="textbox" aria-labelledby="input-title" aria-describedby="input-marking-note" aria-multiline="true" contenteditable="true" spellcheck="false" data-placeholder="Text hier einfügen …" onfocus={() => marked && setInputText(inputText)} oninput={onInput}></div>{#if markingNote}<p id="input-marking-note" class="label marking-note" role="status">{markingNote}</p>{/if}<div class="card-actions actions"><button class="btn" type="button" onclick={insertSample}><Sparkles size={16} aria-hidden="true" />Beispieltext einfügen</button><button class="btn btn-primary" type="button" onclick={() => runCleaner(true)}><ScanSearch size={16} aria-hidden="true" />Text prüfen und bereinigen</button></div></div></section>
    <aside class="card workspace-panel bg-base-100 shadow-sm" aria-labelledby="stats-title"><div class="card-body"><div class="panel-heading"><h2 id="stats-title" class="card-title"><ScanSearch size={18} aria-hidden="true" />Erkannte Auffälligkeiten</h2></div>{#if !report}<p class="report-empty">Füge einen Text ein, um potenzielle Wasserzeichenmuster zu prüfen.</p>{:else if !report.findings.length && !report.unmatched_bidi_count && !report.removed_count && !report.replaced_count && !report.replaced.NFKC_normalize}<div class="alert alert-success" role="status"><Check size={18} aria-hidden="true" /><span><strong>Keine untersuchten technischen Auffälligkeiten gefunden.</strong><br />Das ist kein Nachweis für die Urheberschaft des Textes.</span></div>{:else}<div class="detection-list" aria-live="polite">{#each categories as [category, count]}<span class={`badge ${colors[category]} detection-chip`}><span>{labels[category]}</span><strong>{count}</strong></span>{/each}{#if report.unmatched_bidi_count}<span class="badge badge-error detection-chip"><span>Nicht geschlossene Bidi-Paare</span><strong>{report.unmatched_bidi_count}</strong></span>{/if}{#each report.suspicious_lines as line}<span class="badge badge-warning detection-chip"><span>Zeile {line.line}: Auffälligkeiten</span><strong>{line.count}</strong></span>{/each}<div class="badge detection-chip summary-line"><span><strong>{report.removed_count}</strong> entfernt</span><span><strong>{report.replaced_count}</strong> ersetzt</span></div></div>{/if}</div></aside>
  </div>
  {#if report && (report.normalizations.length || report.hidden_messages.length || report.zero_width_payloads.length || report.domain_spoofs.length)}
    <section class="card workspace-panel bg-base-100 shadow-sm" aria-labelledby="special-findings-title">
      <div class="card-body gap-4">
        <h2 id="special-findings-title" class="card-title">Besondere Prüfhilfen</h2>
        {#if report.normalizations.length}
          <div class="alert alert-info" role="status">
            <div>
              <strong>Unicode-Normalisierungen</strong>
              <ul>{#each report.normalizations as normalization}<li>Position {normalization.start + 1}–{normalization.end}: <code>{JSON.stringify(normalization.before)}</code> → <code>{JSON.stringify(normalization.after)}</code> ({normalization.form})</li>{/each}</ul>
            </div>
          </div>
        {/if}
        {#if report.hidden_messages.length}
          <div class="alert alert-warning" role="status">
            <div>
              <strong>Dekodierte Tag-Payloads</strong>
              <ul>{#each report.hidden_messages as payload}<li><div>Text: <code>{JSON.stringify(payload)}</code></div><div>Hex: <code>{payloadHex(payload)}</code></div><div>Codepoints: <code>{payloadCodepoints(payload)}</code></div></li>{/each}</ul>
            </div>
          </div>
        {/if}
        {#if report.zero_width_payloads.length}
          <div class="alert alert-warning" role="status">
            <div>
              <strong>Zero-Width-Binärnachricht erkannt</strong>
              <p>Nur vollständige 8-Bit-UTF-8-Sequenzen mit U+200B/U+200C und U+200D als Trenner werden dekodiert.</p>
              <ul>
                {#each report.zero_width_payloads as payload}
                  <li>Position {payload.start + 1}–{payload.end}: <code>{JSON.stringify(payload.payload)}</code></li>
                {/each}
              </ul>
            </div>
          </div>
        {/if}
        {#if report.domain_spoofs.length}
          <div class="alert alert-error" role="alert">
            <div>
              <strong>Verdächtige IDN-/Lookalike-Domain</strong>
              <p>Diese technische Warnung ist kein Nachweis für Betrug. Öffne die Domain nicht unkritisch.</p>
              <ul>
                {#each report.domain_spoofs as spoof}
                  <li><code>{spoof.domain}</code>: Label <code>{spoof.label}</code> ähnelt <code>{spoof.skeleton}</code>.</li>
                {/each}
              </ul>
            </div>
          </div>
        {/if}
      </div>
    </section>
  {/if}
  <section class="card workspace-panel bg-base-100 shadow-sm" aria-labelledby="output-title"><div class="card-body"><div class="panel-heading"><h2 id="output-title" class="card-title"><Check size={18} aria-hidden="true" />Bereinigter Text</h2><div class="panel-meta"><p class="label panel-length">{outputLength}</p><button class="btn btn-sm" type="button" disabled={!outputText || copyTemporarilyDisabled} onclick={copyOutput}>{#if copyTemporarilyDisabled}<Check size={16} aria-hidden="true" />{:else}<Clipboard size={16} aria-hidden="true" />{/if}{copyButtonLabel}</button></div></div><textarea bind:this={outputElement} class="textarea editor" spellcheck="false" readonly aria-labelledby="output-title" aria-live="polite" placeholder="Die Ausgabe erscheint nach der Bereinigung." value={outputText}></textarea>{#if copyStatus}<p class={`label copy-status copy-status-${copyStatusType}`} role="status" aria-live="polite">{copyStatus}</p>{/if}</div></section>
  {#if report}
    <section class="card workspace-panel bg-base-100 shadow-sm" aria-labelledby="comparison-title">
      <div class="card-body">
        <div class="panel-heading">
          <h2 id="comparison-title" class="card-title">Vorher-nachher-Vergleich</h2>
          <p class="label panel-length">{report.findings.length} Auffälligkeiten</p>
        </div>
        {#if comparisonEntries.length}
          <div class="comparison-table-wrapper">
            <table class="table table-sm comparison-table">
              <thead><tr><th scope="col">Position</th><th scope="col">Vorher</th><th scope="col">Nachher</th><th scope="col">Änderung</th></tr></thead>
              <tbody>
                {#each comparisonEntries as entry}
                  <tr>
                    <th scope="row">{entry.position + 1}</th>
                    <td><code>{entry.codepoint}</code><span class="comparison-value">{displayComparisonValue(entry.before)}</span></td>
                    <td><span class:comparison-removed={entry.action === 'strip'} class="comparison-value">{displayComparisonValue(entry.replacement)}</span></td>
                    <td>{entry.action === 'strip' ? 'entfernt' : entry.action === 'report' ? 'gemeldet' : 'ersetzt'}<span class="comparison-category">{labels[entry.category]}</span></td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
          {#if comparisonIsTruncated}<p class="label comparison-note">Es werden die ersten {maxComparisonEntries} von {report.findings.length} Auffälligkeiten angezeigt.</p>{/if}
        {:else}
          <p class="report-empty">Keine direkt bereinigten Zeichen gefunden.</p>
        {/if}
      </div>
    </section>
  {/if}
</div></section>
