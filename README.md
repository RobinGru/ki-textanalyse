# KI-Textwasserzeichen-Prüfer

SvelteKit-Anwendung zum Erkennen und Bereinigen potenzieller technischer
Textwasserzeichen: unsichtbare Unicode-Zeichen, Richtungssteuerungen,
Steuerzeichen und typografische Sonderformen. Sie liefert technische Hinweise,
aber **keinen Nachweis** dafür, dass ein Text von einer bestimmten KI stammt.

Die Verarbeitung erfolgt vollständig lokal im Browser. Die daisyUI-CSS-Datei
liegt weiterhin lokal unter `static/assets/css/daisyui.css`.

## Entwicklung

```sh
npm install
npm run dev
```

## Prüfen und bauen

```sh
npm run check
npm test
npm run build
```

## GitHub Pages

Das Projekt nutzt `@sveltejs/adapter-static`, erzeugt einen `404.html`-Fallback
und kopiert `.nojekyll` in den Build. Die Routen werden mit einem abschließenden
Slash erzeugt. Standardmäßig ist die Anwendung für GitHub Pages unter
`/ki-textwasserzeichen-pruefer` konfiguriert. Für einen anderen Deployment-Pfad
kann beim Build `BASE_PATH` gesetzt werden:

```sh
BASE_PATH=/mein-repository npm run build
```

Die statischen Dateien liegen nach dem Build in `docs/`. GitHub Pages ist auf
`main` und den Ordner `/docs` eingestellt. Nach Änderungen daher immer
`npm run build` ausführen und die aktualisierten Dateien aus `docs/` committen.
