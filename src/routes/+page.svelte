<script lang="ts">
  import Header from '$lib/components/Header.svelte';
  import Checker from '$lib/components/Checker.svelte';
</script>

<svelte:head><title>KI-Textwasserzeichen-Prüfer</title><meta name="description" content="Erkennt und bereinigt potenzielle technische Textwasserzeichen vollständig lokal im Browser." /></svelte:head>

<Header active="check" title="KI-Textwasserzeichen-Prüfer" description="Erkennt und bereinigt potenzielle Textwasserzeichen wie unsichtbare Unicode-Zeichen, Richtungssteuerungen und versteckte Tag-Payloads – vollständig lokal im Browser. Die Ergebnisse sind technische Hinweise, kein Nachweis für KI-Urheberschaft." />
<Checker />
