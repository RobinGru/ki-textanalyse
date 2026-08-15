<script lang="ts">
  import { base } from '$app/paths';
  import Header from '$lib/components/Header.svelte';
</script>

<svelte:head><title>Grenzen & Datenschutz – KI-Textwasserzeichen-Prüfer</title></svelte:head>

<Header active="limits" title="Grenzen & Datenschutz" description="Die Prüfung hilft dabei, potenzielle Textwasserzeichen und Verschleierungen einzuordnen – sie ist kein Herkunftsnachweis für KI-Inhalte." />

<section class="info-grid">
  <article class="card info-card bg-base-100 shadow-sm"><div class="card-body"><h2 class="card-title">Technische Transparenz</h2><p>Richtungssteuerungen und Lookalikes können bewirken, dass Text anders dargestellt wird, als er technisch gespeichert ist. Die Prüfung macht solche Unterschiede transparent.</p></div></article>
  <article class="card info-card bg-base-100 shadow-sm"><div class="card-body"><h2 class="card-title">Saubere Weiterverarbeitung</h2><p>Standardisierte Texte lassen sich zuverlässiger durchsuchen, vergleichen, in Formulare übertragen und in anderen Werkzeugen weiterverwenden.</p></div></article>
  <article class="card info-card bg-base-100 shadow-sm"><div class="card-body"><h2 class="card-title">Lokale Verarbeitung</h2><p>Es gibt keinen Upload zu einem Server: Dateiinhalt, Erkennung, Bereinigung und Download verbleiben im Browser.</p></div></article>
  <article class="card info-card bg-base-100 shadow-sm"><div class="card-body"><h2 class="card-title">Kein KI-Nachweis</h2><p>Ein Fund belegt nicht, dass ein Text von einer bestimmten KI erzeugt oder markiert wurde. Auch legitime Texte können ähnliche Unicode-Muster enthalten.</p></div></article>
</section>
<section class="card info-card bg-base-100 shadow-sm" aria-labelledby="hinweis-title"><div class="card-body"><h2 id="hinweis-title" class="card-title">Verantwortungsvoll verwenden</h2><p>Eine Bereinigung verändert Daten. Prüfe insbesondere Texte mit Emoji-Sequenzen, nichtlateinischen Schriften, Quellcode oder bewusst eingesetzter Typografie, bevor du das Ergebnis veröffentlichst. Nutze die Ergebnisse als technische Hinweise, nicht als Urteil über die Urheberschaft.</p><div class="card-actions justify-end"><a class="btn btn-primary" href={`${base}/`}>Wasserzeichenprüfung starten</a></div></div></section>
