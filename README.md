# KI-Textwasserzeichen-Prüfer

> [!TIP]
> **[Prüfer jetzt direkt im Browser öffnen →](https://robingru.github.io/ki-textwasserzeichen-pruefer/)**
>
> Keine Installation und kein Upload erforderlich: Text einfügen und lokal prüfen.

[![GitHub Pages](https://img.shields.io/badge/Demo-GitHub%20Pages-181717?logo=github)](https://robingru.github.io/ki-textwasserzeichen-pruefer/)
[![SvelteKit](https://img.shields.io/badge/SvelteKit-TypeScript-ff3e00?logo=svelte)](https://kit.svelte.dev/)

**KI-Textwasserzeichen-Prüfer** untersucht kopierten Text auf technische
Auffälligkeiten, die zur Textverschleierung oder als potenzielle
Textwasserzeichen genutzt werden können. Dazu zählen unsichtbare Unicode-Zeichen,
Richtungssteuerungen, Steuerzeichen, Lookalikes und ungewöhnliche Leerzeichen.

Das Werkzeug eignet sich zum Prüfen von Texten aus **ChatGPT, Claude, Gemini**
und anderen KI-Assistenten – ebenso wie für beliebige kopierte Inhalte aus
Webseiten, Dokumenten oder Messengern. **Besonders gut für deutsche Texte
geeignet.**

> [!IMPORTANT]
> Ein Fund ist ein technischer Hinweis, **kein Nachweis**, dass ein Text von
> ChatGPT, Claude, Gemini oder einer anderen bestimmten KI erstellt wurde.
> Auch menschlich geschriebene oder absichtlich formatierte Texte können solche
> Unicode-Muster enthalten.

Die Textverarbeitung erfolgt vollständig lokal im Browser. Die daisyUI-Stile
liegen als statisches Asset unter `static/assets/css/daisyui.css`. Das globale
SvelteKit-Layout verlinkt diese Datei; `@sveltejs/adapter-static` kopiert sie
unverändert in den veröffentlichten Build. Sie wird nicht von Vite gebündelt.

## Demo

**[KI-Textwasserzeichen-Prüfer öffnen →](https://robingru.github.io/ki-textwasserzeichen-pruefer/)**

## Was wird erkannt und bereinigt?

| Kategorie | Beispiele | Verhalten |
| --- | --- | --- |
| Unsichtbare Zeichen | Zero Width Space, Soft Hyphen, Word Joiner, Tag-Zeichen | Erkennen und entfernen |
| Zero-Width-Binärnachrichten | `U+200B` = 0, `U+200C` = 1, `U+200D` als Byte-Trenner | Vollständige UTF-8-Bytes dekodieren und mit Position anzeigen |
| Verdächtige Domains | `pаypal.com` mit kyrillischem `а` | URL- und E-Mail-Domains als Lookalike-Verdacht markieren |
| Richtungssteuerungen | Bidi-Overrides, Isolate, LTR-/RTL-Markierungen | Erkennen, entfernen und nicht geschlossene Paare melden |
| Steuerzeichen | C0/C1-Zeichen, NEL, Tabulatoren, Zeilentrenner | Entfernen oder lesbar normalisieren |
| Mixed-Script-Lookalikes | kyrillisches `а` in `pаy` | In gemischten Wörtern markieren und optional in ASCII überführen |
| Sonderleerzeichen | geschützte, schmale und typografische Leerzeichen | Kontextabhängig erhalten oder normalisieren |
| Typografie | Anführungszeichen, Guillemets, Gedankenstriche, Ellipsen | Optional nach ASCII normalisieren |
| Variation-Selectoren und Verkettungen | Emoji-Selektoren, ZWJ- und skriptspezifische Zeichen | Mit der strengen Option entfernen |

Die Anwendung zeigt zusätzlich auffällige Zeilen mit mehreren Funden und hebt
veränderte Zeichen in der Eingabe hervor. Bei sehr großen Texten werden
Einzelmarkierungen begrenzt, damit die Bedienung flüssig bleibt.

## Verwendung

1. Text aus ChatGPT, Claude, Gemini oder einer anderen Quelle einfügen – oder
   eine `.txt`-, `.md`- bzw. `.markdown`-Datei auswählen.
2. Den Erkennungsbericht prüfen.
3. Bei Bedarf Optionen anpassen.
4. **Text prüfen und bereinigen** auswählen.
5. Die bereinigte Ausgabe kopieren oder als Datei herunterladen.
6. Den Prüfbericht bei Bedarf als JSON oder Markdown ohne vollständige Textinhalte herunterladen.

Alle Optionen sind standardmäßig aktiv. Insbesondere die strenge
Verkettungsbereinigung und ASCII-Typografie können legitime Emoji-Sequenzen,
nichtlateinische Schriften, Quellcode oder bewusst gewählte Gestaltung
verändern. Prüfe das Ergebnis deshalb vor einer Veröffentlichung.

## Datenschutz

- Die Textanalyse läuft vollständig im Browser.
- Inhalte werden nicht an einen Server übertragen.
- Upload, Erkennung, Bereinigung, Kopieren und Download verbleiben lokal auf dem
  Gerät.
- Prüfberichte enthalten keine vollständige Eingabe oder bereinigte Ausgabe. Sie
  enthalten jedoch technische Funddaten und gegebenenfalls dekodierte Payloads.
- Die Anwendung verwendet keine API-Schlüssel und kein KI-Modell.

## Technik

- [SvelteKit](https://kit.svelte.dev/) mit TypeScript
- `@sveltejs/adapter-static` für statisches Hosting
- [daisyUI](https://daisyui.com/) als lokal eingebundene CSS-Datei
- [Vitest](https://vitest.dev/) für die Unicode- und Dateinamen-Tests
- GitHub Pages für die Veröffentlichung
- Web-App-Manifest und Service Worker für Offline-Nutzung und Installation als PWA
- GET-basiertes Web Share Target zum Teilen von Text, Titel und URL in unterstützten,
  installierten Browsern (insbesondere Chrome auf Android)
- Versionierte Unicode-17.0-Tabellen sowie IVD-Registry für Emoji-, standardisierte und ideographische Variationssequenzen
- Versionierte UTS-#39-Confusable-Skeletons für URL- und E-Mail-Domainvergleiche

## Lokale Entwicklung

Voraussetzung: Node.js 22 oder neuer.

```sh
npm install
npm run dev
```

Danach die lokale URL aus der Vite-Ausgabe im Browser öffnen.

## Qualität prüfen

```sh
npm run check
npm test
npm run build
```

- `npm run check` führt Svelte- und TypeScript-Prüfungen aus.
- `npm test` führt die Vitest-Regressionsfälle aus.
- `npm run build` erzeugt die statische Website in `docs/`.

Die eingebetteten Tabellen für standardisierte, Emoji- und ideographische
Variationssequenzen werden aus den offiziellen, versionierten Unicode-17.0-
und IVD-Daten erzeugt. Bei einem bewussten Unicode-/IVD-Update ausführen:

```sh
npm run unicode:variation-tables
npm run unicode:confusables
```

## GitHub Pages

Bei jedem Push auf `main` startet der Workflow
[`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml):

1. Abhängigkeiten installieren
2. SvelteKit und TypeScript prüfen
3. Vitest ausführen
4. statische Seite mit dem GitHub-Pages-Basispfad bauen
5. den Build bei GitHub Pages veröffentlichen

Die veröffentlichte Seite ist unter
<https://robingru.github.io/ki-textwasserzeichen-pruefer/> erreichbar.

Für einen anderen Repository-Pfad kann der Build über `BASE_PATH` angepasst
werden:

```sh
BASE_PATH=/mein-repository npm run build
```

## Projektstruktur

```text
src/
├── lib/
│   ├── cleaner/        # Unicode-Erkennung und Bereinigung
│   ├── components/     # Header und Prüfer-Oberfläche
│   └── files.ts        # Dateinamen für Downloads
└── routes/             # Prüfer- und Informationsseiten
static/
└── assets/css/         # lokale daisyUI- und App-Stile
.github/workflows/
└── deploy-pages.yml    # Prüfung und Veröffentlichung
```

## Lizenz und Verantwortung

Dieses Projekt steht unter der [MIT-Lizenz](LICENSE).

Nutze die Ergebnisse als technische Prüfhilfe. Das Projekt trifft keine Aussage
über die Urheberschaft, Absicht oder Qualität eines Textes.
