<script lang="ts">
  import Header from '$lib/components/Header.svelte';
  import Checker from '$lib/components/Checker.svelte';
</script>

<svelte:head><title>KI-Textwasserzeichen-Prüfer</title><meta name="description" content="Erkennt und bereinigt technische Auffälligkeiten in Texten vollständig lokal im Browser." /></svelte:head>

<Header active="check" title="KI-Textwasserzeichen-Prüfer" description="Erkennt und bereinigt technische Auffälligkeiten wie unsichtbare Unicode-Zeichen, Richtungssteuerungen und versteckte Tag-Payloads – vollständig lokal im Browser. Die Ergebnisse sind technische Hinweise, kein Nachweis für eine KI-Urheberschaft." />
<Checker />
