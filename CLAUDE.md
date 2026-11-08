# Lommespiller (repo Runlikehell.io)
Musikkspiller (PWA) for Android: shuffle fra en mappe på telefonen, styring fra Bluetooth-headset og låseskjerm, virker uten nett.
- `app/index.html`: selve spilleren. `app/sw.js`: service worker. `app/manifest.webmanifest`
- `index.html` + `sw.js` i rot: nedlastingsside og en gammel service worker som bare rydder bort v1.0.x
Nettside: https://kilemann.github.io/Runlikehell.io/

## Regler for alt arbeid i dette repoet
- Svar brukeren på norsk. Commit-meldinger på norsk, med versjon først (f.eks. «Appnavn 1.4.0: kort beskrivelse»).
- Hver endring får nytt versjonsnummer (MAJOR.MINOR.PATCH) og en linje i endringsloggen. Versjonen skal være lik på alle stedene under.
- Lever rett på `main` når resultatet er godt nok og testene er grønne. Kjør `git fetch origin main` og rebase før push.
- Testdrevet utvikling (TDD) bare når brukeren ber om det. Eksisterende tester kjøres alltid før push.
- Tekniske påstander skal sjekkes mot dokumentasjon eller kilde, ikke gjettes.
- Appen står på samlesida (kilemann.github.io). Den skal vise navn, versjon og en (i)-knapp øverst til venstre. (i) åpner info-vinduet med bruksanvisning og versjonsliste. Oppdater versjonslista der ved hver ny versjon.
- Publiseres med GitHub Pages fra `main` (rot). Det tar noen minutter før endringen er ute.

## Versjon står her
- `package.json`
- `app/index.html`: `const VERSION` og versjonslista i info-vinduet
- `app/sw.js`: `const VERSION` (styrer cachenavnet, så den MÅ endres for at telefonene skal få ny versjon)
- `index.html` (rot): kommentaren `nedlastingsside vX.Y.Z` og `<footer>`
- `README.md`: `**Versjon:**` og «Versjoner»

## Tester
`npm test` (Node 22). Simulert lydelement, mappevalg, Media Session og service worker. `test/release.test.js` sjekker versjonen alle steder.
Kan ikke testes automatisk: ekte Bluetooth-headset, låseskjerm og installasjon på telefon.
