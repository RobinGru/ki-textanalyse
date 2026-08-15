<script lang="ts">
  import { base } from '$app/paths';
  import Header from '$lib/components/Header.svelte';
</script>

<svelte:head><title>Erkannte Muster – KI-Textanalyse</title></svelte:head>

<Header active="detection" title="Welche Wasserzeichenmuster werden erkannt?" description="Die Anwendung erkennt technische Auffälligkeiten, die zur Textverschleierung oder als potenzielle Wasserzeichen eingesetzt werden können." />

<section class="info-grid" aria-label="Erkennungskategorien">
  <article class="card info-card bg-base-100 shadow-sm"><div class="card-body"><span class="badge badge-error">Potenzielles Wasserzeichen</span><h2 class="card-title">Zero-Width- und Formatzeichen</h2><p>Beispielsweise Zero Width Space, Word Joiner, Soft Hyphen, unsichtbare Separatoren und Tag-Zeichen.</p></div></article>
  <article class="card info-card bg-base-100 shadow-sm"><div class="card-body"><span class="badge badge-error">Richtung</span><h2 class="card-title">Bidi-Steuerungen</h2><p>Links-/Rechtslauf-Markierungen, Overrides und Isolate werden entfernt. Nicht geschlossene Paare werden gesondert gemeldet.</p></div></article>
  <article class="card info-card bg-base-100 shadow-sm"><div class="card-body"><span class="badge badge-warning">Leerraum</span><h2 class="card-title">Ungewöhnliche Leerzeichen</h2><p>Geschützte, schmale und typografische Leerzeichen werden erkannt; passende CJK- und französische Abstände werden kontextabhängig behandelt.</p></div></article>
  <article class="card info-card bg-base-100 shadow-sm"><div class="card-body"><span class="badge badge-warning">Schriftsysteme</span><h2 class="card-title">Schriftsystemübergreifende Lookalikes</h2><p>Kyrillische oder griechische Zeichen in ansonsten lateinischen Wörtern werden sichtbar gemacht und bei Bedarf normalisiert.</p></div></article>
  <article class="card info-card bg-base-100 shadow-sm"><div class="card-body"><span class="badge badge-info">Typografie</span><h2 class="card-title">Anführungszeichen und Guillemets</h2><p>Typografische Anführungszeichen, Guillemets, Gedankenstriche, Minuszeichen und Ellipsen können in ASCII überführt werden.</p></div></article>
  <article class="card info-card bg-base-100 shadow-sm"><div class="card-body"><span class="badge badge-error">Steuerung</span><h2 class="card-title">C0/C1-Steuerzeichen</h2><p>Nicht druckbare Steuerzeichen werden entfernt; Tabulatoren und Zeilentrenner werden lesbar normalisiert.</p></div></article>
</section>
<section class="card info-card bg-base-100 shadow-sm" aria-labelledby="markierung-title"><div class="card-body"><h2 id="markierung-title" class="card-title">Einordnung der Ergebnisse</h2><p>Nach dem Klick auf <strong>Text prüfen und bereinigen</strong> markiert die Startseite veränderte Zeichen rot. Die Funde sind Hinweise auf technische Auffälligkeiten, keine Zuordnung zu einem bestimmten KI-Modell. Bei sehr großen Eingaben entfallen Einzelmarkierungen, damit die Seite flüssig bleibt.</p><div class="card-actions justify-end"><a class="btn btn-primary" href={`${base}/`}>Wasserzeichenprüfung ausprobieren</a></div></div></section>
