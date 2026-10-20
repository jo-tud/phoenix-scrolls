# Phoenix Scrolls

**Herculaneum, made readable.**

An independent, public-facing reading experience for the Herculaneum papyri, beginning with PHerc. 1667. Not affiliated with the Vesuvius Challenge.

## Principles

- Herculaneum only: no generic classical-text catalog.
- Reader-first: accessible English for curious readers, with Greek source available.
- Three distinct layers: Greek transcription, close English translation, and a clearly labeled interpretive Modern Reading.
- No invented reconstructions: missing passages remain visibly missing.
- Every text version must have source, provenance, licensing, and review status.
- New decipherments must not silently overwrite previous published readings.

## Current status

This is the **first working interface prototype**, with no papyrus transcription or translation reproduced. It intentionally uses clearly labeled editorial placeholders pending source and rights verification. The controls, reading layout, accessible navigation, responsive design and data schema are implemented.

Open `index.html` in a browser, or deploy the repository to GitHub Pages.

## Data model

`data/scrolls.json` contains a scroll manifest, source references, version identifiers, alignment anchors, editorial status, and three independent reading layers. Each new scroll is a separate manifest entry. Later revisions create new edition identifiers.

## Rights

Code: MIT (see LICENSE). **This license does not apply to third-party papyrus scans, modern scholarly editions, transcriptions or translations.** No such material is redistributed in this prototype. Check the exact rights of PHerc. 1667 scholarly translation before importing it.

## Next editorial steps

1. Verify source edition and licensing of the Greek transcription and English translation.
2. Import a small verified passage, preserving line/column references and uncertainty.
3. Create a separately attributed Modern Reading, mark interpretations and lacunae.
4. Review the passage with a Greek specialist before presenting it as verified.
5. Test adding a second scroll and a revised reading without breaking permanent references.

## GitHub Pages deployment

The Actions workflow in `.github/workflows/pages.yml` publishes the static site on pushes to `main`. In repository **Settings → Pages → Build and deployment**, select **GitHub Actions** as the source. The public site should then be available at `https://jo-tud.github.io/phoenix-scrolls/` after a successful deployment. Until the Pages workflow succeeds, that URL is not a verified live site.
