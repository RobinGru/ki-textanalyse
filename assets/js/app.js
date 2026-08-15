import { characterLabel, cleanText, decide, mixedConfusableIndexes, tagAnalysis } from './cleaner.js';
import { codepoints, isGlue } from './constants.js';
import { fileMetadata } from './files.js';

    const input = document.querySelector('#input');
    const output = document.querySelector('#output');
    let inputText = ''; 
    const inputLength = document.querySelector('#input-length');
    const outputLength = document.querySelector('#output-length');
    const reportEmpty = document.querySelector('#report-empty');
    const detectionSummary = document.querySelector('#detection-summary');
    const markingNote = document.querySelector('#input-marking-note');
    const copy = document.querySelector('#copy');
    const copyStatus = document.querySelector('#copy-status');
    const maxMarkedCodepoints = 20000;
    let copyStatusTimer = 0;
    const download = document.querySelector('#download');
    let sourceStem = 'text';
    let sourceExtension = 'txt';
    let outputName = 'text.cleaned.txt';

    function updateOutputName() {
      outputName = `${sourceStem}.cleaned.${sourceExtension}`;
    }

    function updateLength(element, value) { element.textContent = `${codepoints(value).length} Zeichen`; }

    function hideMarkingNote() {
      markingNote.textContent = '';
      markingNote.classList.add('hidden');
    }

    function showCopyStatus(message, type) {
      window.clearTimeout(copyStatusTimer);
      copyStatus.textContent = message;
      copyStatus.className = `label copy-status copy-status-${type}`;
      copyStatusTimer = window.setTimeout(() => copyStatus.classList.add('hidden'), 4000);
    }

    function hideCopyStatus() {
      window.clearTimeout(copyStatusTimer);
      copyStatus.textContent = '';
      copyStatus.className = 'label copy-status hidden';
    }

    function setInputText(text) {
      input.textContent = text;
      inputText = text;
      input.classList.remove('marked');
      hideMarkingNote();
      hideCopyStatus();
    }

    function markOriginalText(text, options) {
      const chars = codepoints(text);
      if (chars.length > maxMarkedCodepoints) {
        input.textContent = text;
        input.classList.remove('marked');
        markingNote.textContent = `Markierungen sind ab ${maxMarkedCodepoints.toLocaleString('de-DE')} Zeichen deaktiviert, damit die Eingabe flüssig bleibt.`;
        markingNote.classList.remove('hidden');
        return false;
      }
      const fragment = document.createDocumentFragment();
      let previousKept = null;
      const tags = tagAnalysis(text);
      const confusableIndexes = mixedConfusableIndexes(chars);
      for (let index = 0; index < chars.length; index += 1) {
        const character = chars[index];
        const [action, result] = decide(character, previousKept, options, chars[index + 1] ?? '', tags.trusted.has(index), confusableIndexes.has(index));
        const changedByNfkc = options.nfkc && character.normalize('NFKC') !== character;
        if (action === 'strip') {
          const marker = document.createElement('span');
          marker.className = 'changed-character removed-marker';
          marker.title = `${characterLabel(character)} wird entfernt`;
          marker.textContent = `⟦U+${character.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}⟧`;
          fragment.append(marker);
          continue;
        }
        if (action === 'replace' || changedByNfkc) {
          const marked = document.createElement('span');
          marked.className = 'changed-character';
          marked.title = `${characterLabel(character)} wird verändert`;
          marked.textContent = character;
          fragment.append(marked);
        } else {
          fragment.append(document.createTextNode(character));
        }
        if (action === 'replace' || (!isGlue(character.codePointAt(0)) && action === 'keep')) previousKept = result;
      }
      input.replaceChildren(fragment);
      input.classList.add('marked');
      hideMarkingNote();
      return true;
    }

    input.addEventListener('focus', () => {
      if (input.classList.contains('marked')) setInputText(inputText);
    });
    function showEmptyReport() {
      detectionSummary.replaceChildren();
      detectionSummary.classList.add('hidden');
      reportEmpty.classList.remove('hidden');
    }

    function renderDetectionSummary(report) {
      const labels = { invisible: 'unsichtbare Zeichen', controls: 'Steuerzeichen', bidi: 'Richtungssteuerungen', tags: 'versteckte Tag-Zeichen', variation: 'Variation-Selectoren', spaces: 'ungewöhnliche Leerzeichen', typography: 'typografische Ersetzungen', confusables: 'Mixed-Script-Lookalikes' };
      const colors = { invisible: 'badge-success', controls: 'badge-error', bidi: 'badge-error', tags: 'badge-error', variation: 'badge-warning', spaces: 'badge-warning', typography: 'badge-info', confusables: 'badge-error' };
      const counts = new Map();
      const appendChip = (labelText, count, color = '') => {
        const chip = document.createElement('span');
        chip.className = `badge ${color} detection-chip`;
        const label = document.createElement('span');
        label.textContent = labelText;
        const amount = document.createElement('strong');
        amount.textContent = String(count);
        chip.append(label, amount);
        detectionSummary.append(chip);
      };
      for (const finding of report.findings) counts.set(finding.category, (counts.get(finding.category) ?? 0) + 1);
      reportEmpty.classList.add('hidden');
      detectionSummary.classList.remove('hidden');
      detectionSummary.replaceChildren();
      for (const [category, count] of counts) appendChip(labels[category], count, colors[category]);
      if (report.unmatched_bidi_count) appendChip('nicht geschlossene Bidi-Paare', report.unmatched_bidi_count, 'badge-error');
      for (const line of report.suspicious_lines) appendChip(`Zeile ${line.line}: Auffälligkeiten`, line.count, 'badge-warning');
      const total = document.createElement('div');
      total.className = 'badge detection-chip summary-line';
      const removed = document.createElement('span');
      removed.innerHTML = `<strong>${report.removed_count}</strong> entfernt`;
      const replaced = document.createElement('span');
      replaced.innerHTML = `<strong>${report.replaced_count}</strong> ersetzt`;
      total.append(removed, replaced);
      detectionSummary.append(total);
    }

    function selectedOptions() {
      return { nfkc: document.querySelector('#nfkc').checked, aggressive: document.querySelector('#aggressive').checked, normalizeSpaces: document.querySelector('#normalize-spaces').checked, stripGlue: document.querySelector('#strip-glue').checked, typography: document.querySelector('#typography').checked };
    }

    function runCleaner(markInput = false) {
      if (!inputText.length) {
        output.value = '';
        showEmptyReport();
        download.disabled = true;
        copy.disabled = true;
        updateLength(outputLength, '');
        return;
      }
      const options = selectedOptions();
      const [cleaned, report] = cleanText(inputText, options);
      if (markInput) markOriginalText(inputText, options);
      output.value = cleaned;
      renderDetectionSummary(report);
      download.disabled = false;
      copy.disabled = false;
      updateLength(outputLength, cleaned);
    }

    let liveTimer = 0;
    input.addEventListener('input', () => {
      inputText = input.innerText;
      hideMarkingNote();
      hideCopyStatus();
      updateLength(inputLength, inputText);
      clearTimeout(liveTimer);
      liveTimer = setTimeout(() => runCleaner(false), 180);
    });
    document.querySelectorAll('#nfkc, #aggressive, #normalize-spaces, #strip-glue, #typography').forEach((control) => control.addEventListener('change', () => runCleaner(false)));

    document.querySelector('#file-input').addEventListener('change', async (event) => {
      const file = event.target.files[0];
      if (!file) return;
      setInputText(await file.text());
      output.value = '';
      ({ sourceStem, sourceExtension, outputName } = fileMetadata(file.name));
      updateLength(inputLength, inputText);
      updateLength(outputLength, '');
      download.disabled = true;
      copy.disabled = true;
      showEmptyReport();
    });

    document.querySelector('#sample').addEventListener('click', () => {
      setInputText('# Beispieltext\n\n① Dieser​ längere Beispieltext zeigt, wie unsichtbare Zeichen, ungewöhnliche Abstände, kyrillische Homoglyphen wie pаy und Emoji-Selektoren in ⚖️ erkannt werden. Er enthält mehrere vollständige Sätze, damit die Markierungen und die bereinigte Ausgabe auch bei realistischen Textmengen gut überprüft werden können.');
      output.value = '';
      sourceStem = 'text';
      sourceExtension = 'txt';
      updateOutputName();
      updateLength(inputLength, inputText);
      updateLength(outputLength, '');
      download.disabled = true;
      copy.disabled = true;
      showEmptyReport();
      input.focus();
    });

    document.querySelector('#clean').addEventListener('click', () => runCleaner(true));

    copy.addEventListener('click', async () => {
      if (!output.value) return;
      let copied = false;
      try {
        await navigator.clipboard.writeText(output.value);
        copied = true;
      } catch {
        output.focus();
        output.select();
        copied = document.execCommand('copy');
        output.setSelectionRange(0, 0);
      }
      if (!copied) {
        showCopyStatus('Kopieren wurde vom Browser blockiert. Bitte markiere die Ausgabe und kopiere sie manuell.', 'error');
        return;
      }
      showCopyStatus('Bereinigte Ausgabe wurde kopiert.', 'success');
      copy.textContent = 'Kopiert';
      copy.disabled = true;
      window.setTimeout(() => {
        copy.textContent = 'Ausgabe kopieren';
        copy.disabled = !output.value;
      }, 1600);
    });

    download.addEventListener('click', () => {
      const url = URL.createObjectURL(new Blob([output.value], { type: 'text/plain;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = outputName;
      link.click();
      URL.revokeObjectURL(url);
    });
