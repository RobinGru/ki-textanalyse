# KI-Textwasserzeichen prüfen

Statische Browser-Anwendung zum Erkennen und Bereinigen potenzieller
KI-Textwasserzeichen: unsichtbare Unicode-Zeichen, Richtungssteuerungen,
Steuerzeichen und typografische Sonderformen. Die Anwendung liefert technische
Hinweise, aber keinen Nachweis für die Urheberschaft durch eine bestimmte KI.
Verarbeitung und Oberfläche laufen vollständig lokal im Browser; daisyUI liegt
als lokale CSS-Datei im Repository.

## Struktur

- `index.html` – semantisches Dokument und UI-Struktur
- `assets/css/daisyui.css` – lokal eingebundene daisyUI-Stile
- `assets/css/style.css` – Layout und Anpassungen für daisyUI
- `assets/js/constants.js` – Unicode-Mengen, Ersetzungsregeln und Hilfsfunktionen
- `assets/js/cleaner.js` – Erkennung, Bereinigung und Berichtsdaten
- `assets/js/files.js` – Dateinamen und Download-Ziele
- `assets/js/app.js` – Dateiupload, Interaktion und DOM-Darstellung
- `tests/cleaner.test.mjs` – Regressionstests für Bereinigung und Upload-Metadaten

## Lokal testen

Die Anwendung verwendet native ES-Module. Daher funktioniert sie nicht direkt
über `file://`, sondern benötigt einen lokalen Webserver, zum Beispiel:

```sh
python3 -m http.server 8080
```

Danach `http://localhost:8080` im Browser öffnen.

## Tests ausführen

```sh
node --test
```

## GitHub Pages veröffentlichen

1. Repository zu GitHub pushen.
2. In **Settings → Pages** bei **Build and deployment** die Quelle
   **Deploy from a branch** auswählen.
3. Den gewünschten Branch auswählen, normalerweise `main`.
4. Als Ordner `/(root)` auswählen und speichern.

GitHub Pages stellt anschließend `index.html` bereit. Es ist kein Build-Schritt
und keine serverseitige Verarbeitung erforderlich.
