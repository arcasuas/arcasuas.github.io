# Arcas UAS

A responsive, buildless static website for the Arcas UAS Smart BMS concept, styled in black and gold to match the supplied presentation. No package installation, API keys, external fonts, or backend services are required.

## Preview locally

For an immediate offline preview, open `preview.html` in a browser. All visuals, fonts, and interactions are embedded. LinkedIn links still require an internet connection.

From this directory, run:

```bash
python3 -m http.server 8000 --bind 127.0.0.1 --directory dist
```

Open http://localhost:8000. On Windows, `py -m http.server 8000 --bind 127.0.0.1 --directory dist` also works if Python is installed.

A server on port 8000 was started and verified inside this workspace’s isolated command network. The environment blocks making that port reachable from the shared workspace or your computer. Open the included `preview.html` directly, or run the command above on your own computer to view http://localhost:8000. No public deployment was created.

## Brand palette

- Black: `#000000`
- Gold: `#D7AF5B`
- Warm ivory: `#E3D9CF`

The core colors come from the supplied `10_05 Presentation.pptx` theme. Secondary surfaces and labels use neutral charcoal and muted gold tones.

## Files

- `dist/index.html`: page content, founders, inline diagrams, and contact directory.
- `dist/styles.css`: responsive design, typography, motion preferences, and modal styling.
- `dist/app.js`: context tabs, synthetic operator demonstration, reserve display, navigation, and dialog behavior.
- `dist/assets/`: local hero image, fonts, favicon, and font licensing.
- `SOURCES.md`: research sources, founder-name reconciliation, and concept scope.

## Demonstration behavior

- Nominal, headwind, and cold-weather presets all start at 74% physical charge. Changing context changes the synthetic remaining-range example.
- Usable battery is displayed as `max(0, physical charge − 20) / 80 × 100`, rounded to a whole percent. Thus 74% physical charge is approximately 68% usable energy, and 20% physical charge is 0% usable energy.
- In this interface demonstration, the low-energy prompt appears at or below 20% usable energy (36% physical charge). This is an illustrative UI threshold, not a validated return-to-base rule.
- The low-battery preset starts at 32% physical charge (15% usable).
- At or below the physical 20% floor, usable energy and remaining range both display zero. The physical battery is not described as electrochemically empty.
- Range is a simple interpolation of fictional values. There is no aircraft-specific model, real telemetry, navigation data, weather service, or aircraft-control connection.
- Contact actions open a directory of the founders’ public LinkedIn profiles. No contact messages are sent or stored by the website.

## Deployment readiness

Serve the contents of `dist/` using any static host. This version has not been publicly deployed. The generated aircraft is illustrative, not a product photograph. Product copy describes a concept in development; no accuracy or operational validation claims are made.

The site uses local URW Nimbus fonts; licensing is included in `dist/assets/FONT-LICENSE.txt`.

## Verification

The local handoff includes JavaScript syntax checks, source-link and asset checks, successful HTTP responses for the page and required assets inside the server session, and checks of the reserve-floor / preset behavior. Browser visual QA was not available through the supported browser-control skill in this environment.
