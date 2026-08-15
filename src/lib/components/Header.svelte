<script lang="ts">
  import { ShieldCheck } from '@lucide/svelte';
  import { base } from '$app/paths';

  export let title: string;
  export let description: string;
  export let active: 'check' | 'how' | 'detection' | 'limits';

  const links = [
    { key: 'check', href: '/', label: 'Prüfen' },
    { key: 'how', href: '/so-funktioniert-es/', label: 'So funktioniert es' },
    { key: 'detection', href: '/erkennung/', label: 'Erkennung' },
    { key: 'limits', href: '/warum/', label: 'Grenzen' }
  ] as const;
</script>

<header class="site-header">
  <nav class="navbar site-nav" aria-label="Hauptnavigation">
    <a class="site-brand" href={`${base}/`} aria-label="KI-Textwasserzeichen-Prüfer – Startseite">
      <span class="brand-mark" aria-hidden="true"><ShieldCheck size={20} strokeWidth={2.25} /></span>
      <span class="brand-copy"><strong>KI-Wasserzeichen</strong><span>Textprüfung</span></span>
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
    </div>
  </nav>
  <div class="site-intro">
    <h1 class="text-3xl font-bold">{title}</h1>
    <p class="text-base-content/70">{description}</p>
  </div>
</header>
