<script lang="ts">
  import { onMount } from 'svelte';
  import { Moon, ShieldCheck, Sun } from '@lucide/svelte';
  import { base } from '$app/paths';

  export let title: string;
  export let description: string;
  export let active: 'check' | 'how' | 'detection' | 'limits';

  type Theme = 'light' | 'dark';
  let theme: Theme = 'light';

  const links = [
    { key: 'check', href: '/', label: 'Prüfen' },
    { key: 'how', href: '/so-funktioniert-es/', label: 'So funktioniert es' },
    { key: 'detection', href: '/erkennung/', label: 'Erkennung' },
    { key: 'limits', href: '/warum/', label: 'Grenzen' }
  ] as const;

  onMount(() => {
    theme = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
  });

  function toggleTheme() {
    theme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('ki-wasserzeichen-theme', theme);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#1d232c' : '#2563eb');
  }
</script>

<header class="site-header">
  <nav class="navbar site-nav" aria-label="Hauptnavigation">
    <a class="site-brand" href={`${base}/`} aria-label="KI-Textwasserzeichen-Prüfer – Startseite">
      <span class="brand-mark" aria-hidden="true"><ShieldCheck size={20} strokeWidth={2.25} /></span>
      <span class="brand-copy"><strong>KI-Wasserzeichen</strong><span>Textprüfung <small>by RobinGru</small></span></span>
    </a>
    <div class="site-links">
      {#each links as link}
        <a
          class:nav-link-active={active === link.key}
          class="btn btn-ghost btn-sm nav-link"
          href={`${base}${link.href}`}
          aria-current={active === link.key ? 'page' : undefined}
        >{link.label}</a>
      {/each}
      <a class="btn btn-ghost btn-sm nav-link" href="https://github.com/RobinGru/ki-textwasserzeichen-pruefer" aria-label="KI-Textwasserzeichen-Prüfer auf GitHub öffnen">
        <svg class="github-mark" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 .5C5.73.5.64 5.59.64 11.86c0 4.88 3.16 9.02 7.55 10.48.55.1.75-.24.75-.53 0-.26-.01-1.13-.02-2.05-3.07.67-3.72-1.3-3.72-1.3-.5-1.27-1.23-1.61-1.23-1.61-1.01-.69.08-.68.08-.68 1.12.08 1.7 1.15 1.7 1.15.99 1.7 2.6 1.21 3.23.92.1-.72.39-1.21.71-1.49-2.45-.28-5.03-1.23-5.03-5.46 0-1.21.43-2.2 1.14-2.98-.11-.28-.49-1.41.11-2.94 0 0 .93-.3 3.04 1.14A10.56 10.56 0 0112 8.8c.94 0 1.89.13 2.77.38 2.11-1.44 3.04-1.14 3.04-1.14.6 1.53.22 2.66.11 2.94.71.78 1.14 1.77 1.14 2.98 0 4.24-2.58 5.18-5.04 5.45.4.34.75 1 .75 2.02 0 1.46-.01 2.64-.01 3 .01.29.2.64.76.53A11.37 11.37 0 0023.36 11.86C23.36 5.59 18.27.5 12 .5z" /></svg>
        <span>GitHub</span>
      </a>
      <button class="btn btn-ghost btn-sm theme-toggle" type="button" onclick={toggleTheme} aria-label={theme === 'dark' ? 'Hellmodus aktivieren' : 'Dunkelmodus aktivieren'} title={theme === 'dark' ? 'Hellmodus aktivieren' : 'Dunkelmodus aktivieren'}>
        {#if theme === 'dark'}
          <Sun size={16} aria-hidden="true" />
          <span>Hell</span>
        {:else}
          <Moon size={16} aria-hidden="true" />
          <span>Dunkel</span>
        {/if}
      </button>
    </div>
  </nav>
  <div class="site-intro">
    <h1 class="text-3xl font-bold">{title}</h1>
    <p class="text-base-content/70">{description}</p>
    <span class="badge badge-success badge-outline german-text-note">Optimiert auf deutsche Texte</span>
  </div>
</header>
