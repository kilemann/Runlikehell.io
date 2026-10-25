# Runlikehell.io
Løpespiller – musikkspiller for løpeturen: shuffle fra en mappe på telefonen, styres med headset og låseskjerm, bruker ingen datatrafikk.

**Versjon:** 1.1.0 · Side: https://kilemannen.github.io/Runlikehell.io/

## Oppbygging
- `index.html` – nedlastingsside med instruksjoner
- `app/index.html` – selve spilleren. Lastes ned som `Lopespiller.html` og virker som enkeltfil, eller brukes som installerbar app (PWA) med `sw.js` og `manifest.webmanifest`

## Versjoner
- **1.1.0** – Forsiden er nedlastingsside med instruksjoner. Spilleren virker som nedlastet enkeltfil (innebygd ikon, faller tilbake til «velg mappe hver gang» når lagring ikke er tilgjengelig). PWA flyttet til `app/`.
- **1.0.1** – Nytt kassettikon på appen/snarveien.
- **1.0.0** – Første versjon: standardmappe lagret i appen, midlertidig mappe, shuffle, headset-/låseskjermkontroll (Media Session), offline (service worker).

Ved ny versjon: oppdater `VERSION` i `app/index.html` og `app/sw.js`, og versjonen nederst i `index.html`.
