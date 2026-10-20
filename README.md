# Phoenix Scrolls

**Herculaneum, made readable.**

An independent reading project for people without training in Greek or papyrology. Exclusively the Herculaneum papyri, beginning with PHerc. 1667. Not affiliated with the Vesuvius Challenge.

Website: https://jo-tud.github.io/phoenix-scrolls/

## Reading pilot 0.2

One short attributed Greek quotation from Column XVII, with a project English working translation and an optional interpretive Modern Reading. Not a complete edition. English text is AI-assisted and has not been independently reviewed by a specialist. The published English translation and papyrus images are not redistributed.

The reader provides Greek + English by default, optional Modern Reading, phrase alignment, mobile language switching, text size, light/dark themes, locally stored preferences, source disclosures and edition-specific links. Uncertain Greek letters retain their underdots. Invalid edition links never silently open a different edition.

## Develop and check

Requires Node.js 22+ for tests/build and any static web server for preview. No npm dependencies.

```sh
node --test tests/*.test.mjs
node scripts/check.mjs --build
python3 -m http.server 8000 --directory _site
```

Open http://localhost:8000/ (not the HTML file directly). GitHub Actions runs the checks, stages only `index.html`, `assets/` and `data/`, and deploys `_site` to GitHub Pages.

## Content architecture

`data/scrolls.json` is the canonical pilot content; the UI does not duplicate its text. Scrolls contain independently identified editions, passages and aligned phrase units. Translation layers record SHA-256 fingerprints of their Greek source. Changing that source flags dependent drafts in the UI and blocks release until they are rechecked.

Never rewrite published edition content in place: add an edition ID, keep the old one, and update `currentEdition`. A second-scroll and a revision fixture are tested in memory; no invented scroll is published.

The pilot intentionally keeps a small static ES-module implementation. Astro/React and TEI/EpiDoc integration remain future engineering work, not completed features. The content model and tests are kept separate from rendering to ease that migration.

## Rights and review

Code: MIT. This does **not** license third-party editions, translations or images. See [source register](docs/SOURCES_AND_RIGHTS.md), [editorial policy](docs/EDITORIAL_POLICY.md), and the [unsent permissions request](docs/PERMISSIONS_REQUEST.md).

No claim of permission for a complete scholarly translation, independent papyrus decipherment, expert review or institutional endorsement is made.

## Test coverage

See [QA notes](docs/QA.md). Twenty Node tests and eleven offline browser checks passed locally. The offline browser harness supplies data and hashing itself; this does not test live HTTP, clipboard permissions, storage persistence or the actual mobile devices of readers.
