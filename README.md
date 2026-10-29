# Runlikehell.io
Lommespiller – enkel musikkspiller: shuffle fra en mappe på telefonen, styres med headset og låseskjerm, bruker ingen datatrafikk.

**Versjon:** 1.7.0 · Side: https://kilemann.github.io/Runlikehell.io/

## Oppbygging
- `index.html` – forside med installasjonsinstruksjoner (nedlasting som fil er alternativ)
- `sw.js` – opprydder for gamle installasjoner (ikke slett)
- `app/index.html` – selve spilleren. Lastes ned som `Lommespiller.html` og virker som enkeltfil, eller brukes som installerbar app (PWA) med `sw.js` og `manifest.webmanifest`

## Versjoner
- **1.7.0** – Talestemme: en myk engelsk damestemme sier «Pause», «Resume» og «Next» (og «Play» ved første start) når du trykker på headsettet. Bruker telefonens egen talesyntese, uten nett. Musikk og stemme overlapper aldri, og kommandoen utføres alltid, senest etter 1,5 s, selv om stemmen ikke svarer. Stemmen kan slås av og velges selv under «Stemme». Knappene i appen gir ingen stemme.
- **1.6.0** – Retter at musikken stoppet for lett med låst skjerm. Stopper Android musikken (Bluetooth-brudd, annen app eller varsel), fortsetter den automatisk etter 2 s, maks 3 ganger på 5 min (kan slås av). En sang som henger i 10 s hoppes over. Fortsett etter pause på en fil som ikke lenger kan leses går videre til neste sang i stedet for å stå stille. Ny hendelseslogg viser hva som stoppet musikken: app-knapp, headset/låseskjerm eller Android.
- **1.5.0** – Retter to feil funnet av nye automatiske tester: en sang som ikke kunne spilles fikk også neste, gode sang hoppet over, og en ventende hopp-over kunne starte en sang etter at du hadde valgt ny mappe. Ellers uendret.
- **1.4.0** – Installasjon som app er hovedvalget: stor installer-knapp på forsiden og «Installer på hjemskjermen»-knapp i spilleren. Nedlasting som fil er flyttet til alternativ.
- **1.3.0** – Standardmappe-funksjonen er fjernet: ingenting kopieres lenger, sangene spilles rett fra valgt mappe. Tidligere kopierte sanger slettes automatisk fra appens lagring.
- **1.2.0** – Nytt navn: Lommespiller (tidligere Løpespiller). Lagringsnavn beholdt, så lagret standardmappe følger med.
- **1.1.1** – `sw.js` i rotmappa er en opprydder: fjerner den gamle service workeren fra v1.0.x som fortsatt viste den gamle spilleren på enheter som hadde åpnet den før.
- **1.1.0** – Forsiden er nedlastingsside med instruksjoner. Spilleren virker som nedlastet enkeltfil (innebygd ikon, faller tilbake til «velg mappe hver gang» når lagring ikke er tilgjengelig). PWA flyttet til `app/`.
- **1.0.1** – Nytt kassettikon på appen/snarveien.
- **1.0.0** – Første versjon: standardmappe lagret i appen, midlertidig mappe, shuffle, headset-/låseskjermkontroll (Media Session), offline (service worker).

## Tester
Utviklet med test først (TDD) fra og med 1.5.0. Testene kjører spillerens eget skript i en simulert nettleser (lydelement, mappevalg, headset/låseskjerm, installasjon) og service workerne i en simulert worker.

```
npm test
```

Krever Node 22 eller nyere. Ingen avhengigheter.

| Fil | Hva den tester |
|---|---|
| `test/helpers.test.js` | Filfiltrering, navn, tidsformat, lagring, status |
| `test/pause.test.js` | Pausekilde, automatisk fortsett, heng, fortsett på ulesbar fil, hendelseslogg |
| `test/voice.test.js` | Talestemme: hvilke kommandoer som får stemme, rekkefølge musikk/stemme, reserveløsning, stemmevalg |
| `test/player.test.js` | Mappevalg, shuffle, spill/pause/neste/forrige, spoling, feil og hopp over, Media Session |
| `test/install.test.js` | Installer-knapp, service worker-registrering, oppstart |
| `test/sw.test.js` | Service workerne, manifest og forsiden |
| `test/release.test.js` | Versjonsnummer og endringslogg er like overalt |

Ved ny versjon: skriv testen først, sett `version` i `package.json`, og oppdater så `VERSION` i `app/index.html` og `app/sw.js`, kommentaren og bunnteksten i `index.html`, og README (`**Versjon:**` og lista over).
