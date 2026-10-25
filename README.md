# Runlikehell.io
Lommespiller (tidligere Løpespiller) – enkel musikkspiller: shuffle fra en mappe på telefonen, styres med headset og låseskjerm, bruker ingen datatrafikk.

**Versjon:** 1.4.0 · Side: https://kilemannen.github.io/Runlikehell.io/

## Oppbygging
- `index.html` – forside med installasjonsinstruksjoner (nedlasting som fil er alternativ)
- `sw.js` – opprydder for gamle installasjoner (ikke slett)
- `app/index.html` – selve spilleren. Lastes ned som `Lommespiller.html` og virker som enkeltfil, eller brukes som installerbar app (PWA) med `sw.js` og `manifest.webmanifest`

## Versjoner
- **1.4.0** – Installasjon som app er hovedvalget: stor installer-knapp på forsiden og «Installer på hjemskjermen»-knapp i spilleren. Nedlasting som fil er flyttet til alternativ.
- **1.3.0** – Standardmappe-funksjonen er fjernet: ingenting kopieres lenger, sangene spilles rett fra valgt mappe. Tidligere kopierte sanger slettes automatisk fra appens lagring.
- **1.2.0** – Nytt navn: Lommespiller (tidligere Løpespiller). Lagringsnavn beholdt, så lagret standardmappe følger med.
- **1.1.1** – `sw.js` i rotmappa er en opprydder: fjerner den gamle service workeren fra v1.0.x som fortsatt viste den gamle spilleren på enheter som hadde åpnet den før.
- **1.1.0** – Forsiden er nedlastingsside med instruksjoner. Spilleren virker som nedlastet enkeltfil (innebygd ikon, faller tilbake til «velg mappe hver gang» når lagring ikke er tilgjengelig). PWA flyttet til `app/`.
- **1.0.1** – Nytt kassettikon på appen/snarveien.
- **1.0.0** – Første versjon: standardmappe lagret i appen, midlertidig mappe, shuffle, headset-/låseskjermkontroll (Media Session), offline (service worker).

Ved ny versjon: oppdater `VERSION` i `app/index.html` og `app/sw.js`, og versjonen nederst i `index.html`.
