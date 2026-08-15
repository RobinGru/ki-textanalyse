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
    <a class="footer-repository link link-hover" href="https://github.com/RobinGru/ki-textwasserzeichen-pruefer">
      <svg class="github-mark" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 .5C5.73.5.64 5.59.64 11.86c0 4.88 3.16 9.02 7.55 10.48.55.1.75-.24.75-.53 0-.26-.01-1.13-.02-2.05-3.07.67-3.72-1.3-3.72-1.3-.5-1.27-1.23-1.61-1.23-1.61-1.01-.69.08-.68.08-.68 1.12.08 1.7 1.15 1.7 1.15.99 1.7 2.6 1.21 3.23.92.1-.72.39-1.21.71-1.49-2.45-.28-5.03-1.23-5.03-5.46 0-1.21.43-2.2 1.14-2.98-.11-.28-.49-1.41.11-2.94 0 0 .93-.3 3.04 1.14A10.56 10.56 0 0112 8.8c.94 0 1.89.13 2.77.38 2.11-1.44 3.04-1.14 3.04-1.14.6 1.53.22 2.66.11 2.94.71.78 1.14 1.77 1.14 2.98 0 4.24-2.58 5.18-5.04 5.45.4.34.75 1 .75 2.02 0 1.46-.01 2.64-.01 3 .01.29.2.64.76.53A11.37 11.37 0 0023.36 11.86C23.36 5.59 18.27.5 12 .5z" /></svg>
      <span>GitHub-Repository</span>
    </a>
  </footer>
</div>
