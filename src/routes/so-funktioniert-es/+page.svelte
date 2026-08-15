<script lang="ts">
  import { base } from '$app/paths';
  import Header from '$lib/components/Header.svelte';
</script>

<svelte:head><title>Wie funktioniert die Erkennung? – KI-Textanalyse</title></svelte:head>

<Header active="how" title="Wie funktioniert die Erkennung?" description="Die Prüfung sucht im eingegebenen Text nach technischen Mustern, die zur Textverschleierung oder als potenzielle Wasserzeichen eingesetzt werden können." />

<section class="info-page" aria-labelledby="ablauf-title">
  <h2 id="ablauf-title" class="text-xl font-semibold">In drei Schritten</h2>
  <div class="info-grid">
    <article class="card info-card bg-base-100 shadow-sm"><div class="card-body"><span class="badge badge-info">1</span><h3 class="card-title">Text oder Datei prüfen</h3><p>Füge verdächtigen Text direkt ein oder lade eine <code>.txt</code>- bzw. Markdown-Datei hoch.</p></div></article>
    <article class="card info-card bg-base-100 shadow-sm"><div class="card-body"><span class="badge badge-warning">2</span><h3 class="card-title">Muster nachvollziehen</h3><p>Der Bericht zeigt gefundene Kategorien, auffällige Zeilen und die Anzahl der bereinigbaren Zeichen.</p></div></article>
    <article class="card info-card bg-base-100 shadow-sm"><div class="card-body"><span class="badge badge-success">3</span><h3 class="card-title">Bereinigten Text verwenden</h3><p>Kopiere die Ausgabe oder lade sie mit passender <code>.txt</code>- bzw. <code>.md</code>-Endung herunter.</p></div></article>
  </div>
</section>

<section class="card info-card bg-base-100 shadow-sm" aria-labelledby="optionen-title"><div class="card-body"><h2 id="optionen-title" class="card-title">Was die Prüfung aussagen kann</h2><ul><li>Sie macht unsichtbare Unicode-Zeichen, Richtungssteuerungen und ähnliche Verschleierungen sichtbar.</li><li>Sie kann verdächtige technische Muster bereinigen und Änderungen transparent markieren.</li><li>Sie kann <strong>nicht</strong> nachweisen, dass ein Text von einer bestimmten KI stammt oder von ihr verändert wurde.</li><li>Mit den Optionen lässt sich die Bereinigung an Sprache, Typografie und Format des Textes anpassen.</li></ul><div class="card-actions justify-end"><a class="btn btn-primary" href={`${base}/`}>Text auf Wasserzeichen prüfen</a></div></div></section>
