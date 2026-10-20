# Reading experience 0.3.0

20 October 2026. Scope: Herculaneum; readers without Greek or papyrological training.

## Implemented

- Restored one memorable opening line: **A thought from the ashes.** Surrounding copy stays practical.
- Mobile native horizontal scroll-snap in the fixed Greek / English / Modern Reading order. English opens first; Modern Reading remains opt-in. At ordinary phone widths, neighbouring panels peek into view. A small label identifies the previous version even when its line endings leave the preview blank.
- Tap and keyboard alternatives; no automatic rotation, wraparound or intercepted vertical touch gestures. Inactive mobile panels are visually present but inert and hidden from assistive technology. Desktop keeps parallel columns.
- Semantic reading anchors identify the visible text unit and relative position within it. Switching unequal versions preserves this anchor rather than a percentage of the whole document. Reading preferences and a saved edition/passage/unit are stored locally. Unavailable saved editions are reported, never silently replaced.
- Notes and sources in a native modal dialog, styled as a bottom sheet on phones. Close, Escape, keyboard focus containment and focus restoration are provided. Inline note buttons connect to the relevant existing annotations.
- Reading view hides the introductory page and keeps controls available. Large text and narrow screens reclaim the side-preview width; readers can also turn previews off.
- Text is ordinary selectable text. Comparison is a separate button. Copying adds the version's editorial status, source citation, edition ID and permanent passage link; unavailable clipboard access gives a selectable fallback.
- One optional editorial reflection for the existing excerpt. It is marked as an AI-assisted editorial draft, explains its relationship to the surviving words, states the limits of the inference and links to the source. Its fingerprints are checked against its supporting Greek units.
- A column overview distinguishes an excerpt available on this site, material not yet added here, and the first three columns for which the cited paper reports no secure transcription. This is a website-coverage map, not a reconstruction of physical damage.
- Public permission status reflects the owner's report that an enquiry was sent. No permission is assumed and no larger transcription, published English translation or image has been imported.

## Content and architecture

`data/scrolls.json` and the published pilot edition are unchanged. New context is in `data/reading-notes.json`, linked by scroll, edition, passage and source IDs. Hook fingerprints, references, mandatory caveats, and coverage links are validated in `assets/reading.mjs` and in the build. `assets/experience.mjs` contains the DOM experience; `assets/experience.css` extends the existing appearance.

A new passage can have a reflection and anchored notes; neither is required. Long test data is generated only inside the test runner and is not copied into `_site`. The current public site still contains one short excerpt.

## Verification

- 36 Node tests passed, including the frozen pilot text snapshot, source-change invalidation, saved-position validation and citation copying.
- 26 offline Chromium browser checks passed: native CDP touch swipes, vertical scrolling, keyboard switching, modal focus, normal and reduced motion, long unequal test passages and round-trip anchoring, saved reading, blocked storage, clipboard fallback, load errors, and no-JavaScript fallback.
- Checked 320, 360, 390, 768 and 1440 px widths, including 150% reader text. No document-level horizontal overflow observed.
- Visually inspected desktop, mobile previews and the note sheet.

The execution environment blocks URL navigation, including local HTTP. UI tests therefore inject the real HTML/CSS and module code into an offline Chromium page. Only browser-origin services (fetch, storage, WebCrypto and history) have test adapters; DOM, touch gestures, layout and modal handling remain native. Node tests exercise actual WebCrypto and URL helpers. This is not a live-site, real-device, screen-reader, or cross-browser audit. iOS Safari and Android browser back gestures need real-device checking.

## Sources consulted

- Scientific text and scope: https://arxiv.org/html/2606.29085v1 (transcription, Column 17; complete-reading criteria, first three columns).
- Native scroll snapping: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/scroll-snap-type
- Dialog behaviour: https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/

Traceability checks do not establish correctness of a translation or interpretation. Independent specialist review remains outstanding.
