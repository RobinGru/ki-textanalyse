# Cleaner-Modul

Die Engine ist browserunabhängig und hat genau eine produktive Einstiegsschnittstelle:

```ts
const [cleanedText, report] = cleanText(input, options);
```

`index.ts` enthält die Erkennungs- und Bereinigungsregeln. Seine öffentlichen
Typen werden aus `types.ts` re-exportiert und sind damit der stabile Vertrag für
die Svelte-Oberfläche, JSON-/Markdown-Exporte und künftige Automatisierungen.
Änderungen am Bericht sollten ausschließlich additiv erfolgen; Positionen sind
Codepoint-Indizes, zusätzlich stehen UTF-16-Offsets für Browser-Schnittstellen
bereit.

| Bereich | Verantwortlichkeit |
| --- | --- |
| `constants.ts` | Unicode-Kategorien und Policy-Tabellen |
| `generated-*.ts` | generierte, versionierte Unicode-Daten — nicht manuell ändern |
| `types.ts` | stabiler Datenvertrag |
| `index.ts` | Analyse, Bereinigung und öffentliche API |

Die Generatoren liegen unter `scripts/` und werden über die beiden
`unicode:*`-Skripte aus `package.json` ausgeführt. Jede Regeländerung braucht
einen regressionssicheren Fall in `index.test.ts`; der Bericht darf nie als
Nachweis für KI-Urheberschaft interpretiert werden.
