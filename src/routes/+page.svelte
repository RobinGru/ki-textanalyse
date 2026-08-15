<script lang="ts">
  import Header from '$lib/components/Header.svelte';
  import Checker from '$lib/components/Checker.svelte';
</script>

<svelte:head><title>KI-Textanalyse</title><meta name="description" content="Prüft technische Wasserzeichen lokal im Browser; stilistische KI-Heuristiken folgen." /></svelte:head>

<Header active="check" title="KI-Textanalyse" description="Prüft technische Wasserzeichen und Auffälligkeiten wie unsichtbare Unicode-Zeichen, Richtungssteuerungen und versteckte Tag-Payloads – vollständig lokal im Browser. Stilistische KI-Hinweise folgen als Heuristik; Ergebnisse sind kein Urheberschaftsnachweis." />
<Checker />
