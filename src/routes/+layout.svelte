<script lang="ts">
  import { base } from '$app/paths';
</script>

<svelte:head>
  <link rel="stylesheet" href={`${base}/assets/css/daisyui.css`} />
  <link rel="stylesheet" href={`${base}/assets/css/style.css`} />
</svelte:head>

<div class="min-h-screen bg-base-200 p-4 sm:p-8">
  <main class="mx-auto max-w-6xl space-y-6">
    <slot />
  </main>
  <footer class="site-footer" aria-label="Seiteninformationen">
    <p>© RobinGru · Stand August 2026</p>
  </footer>
</div>
