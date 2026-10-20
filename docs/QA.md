# QA record — reading pilot 0.2

2026-10-20, before publication.

## Passed locally
- `node --check assets/app.mjs`
- `node --test tests/*.test.mjs`: 20/20 tests.
- `node scripts/check.mjs --build`: manifest, dependent translations and staged build passed.
- Offline Chromium DOM/layout check: 11/11 checks (default views, alignment, third column, font size, theme, mobile switching, 390px and 320px overflow, last-panel protection, source disclosure and no script errors).
- Desktop, three-column, dark and mobile screenshots visually inspected: no clipping/overlap observed.

## Scope of the browser result

A normal localhost navigation was blocked by the execution environment's browser policy. The offline harness instead supplied the HTML, CSS and combined module sources in memory, with fixture data and a SHA-256 callback. This did not exercise deployed asset loading, real WebCrypto integration, clipboard access, storage persistence, actual mobile devices, screen readers or end-to-end HTTP navigation. Do not report this as a complete accessibility audit or a live-site browser test.

`tests/browser_smoke.py` is the separate normal HTTP test for an environment allowing localhost; it was not completed here. Dependencies: Python Playwright and Chromium. The actual deployment result must be checked in GitHub Actions after publication.

## Editorial limitations

The Greek was compared with the versioned HTML transcription, not independently deciphered from images. English and Modern Reading have not been reviewed by a qualified Greek specialist. Full-edition permissions are pending; the permission inquiry is drafted only.
