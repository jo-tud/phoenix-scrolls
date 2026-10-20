import { permalink } from './model.mjs';
import { savedReading, readingPosition, previewInset } from './reading.mjs';

/** Native horizontal scrolling; the document retains its normal vertical scroll. */
export function createExperience({ $, getSelected, selectUnit, navigate, persistSettings, titles }) {
  const rail = $('panels'), narrow = matchMedia('(max-width:680px)'), reduced = matchMedia('(prefers-reduced-motion:reduce)');
  const POSITION = 'phoenix-scrolls.position.v1', PEEKS = 'phoenix-scrolls.peeks.v1';
  let context = null, active = 'english', inset = 0, pending = null, suppress = false, timer, saveTimer, lastWidth = 0, seen = false, origin = null;
  let peeks = true, resumeValue = null;
  try { peeks = localStorage.getItem(PEEKS) !== 'false'; resumeValue = JSON.parse(localStorage.getItem(POSITION)); } catch { /* Storage is optional. */ }
  $('show-peeks').checked = peeks;
  const panels = () => [...rail.querySelectorAll('.panel')];
  const activePanel = () => panels().find(p => p.dataset.kind === active) || panels()[0];
  const row = (panel, id) => [...(panel?.querySelectorAll('.unit') || [])].find(el => el.dataset.unit === id);
  const textBounds = el => (el.querySelector('.phrase') || el).getBoundingClientRect();
  function paragraph(text, className = '') { const p = document.createElement('p'); p.textContent = text; p.className = className; return p; }
  function readingLine() { const d = $('reading-dock').getBoundingClientRect(); return d.top <= 2 ? Math.max(120, d.bottom + 20) : 120; }
  function capture() {
    const panel = narrow.matches ? activePanel() : panels().find(p => p.dataset.kind === copyLayer());
    if (!panel) return null;
    const all = [...panel.querySelectorAll('.unit')], line = readingLine();
    let el = row(panel, getSelected());
    if (!el || textBounds(el).bottom < line || textBounds(el).top > innerHeight - 40) {
      el = all.find(e => textBounds(e).bottom > line);
    }
    if (!el) return null;
    const rect = textBounds(el);
    if (rect.top >= innerHeight - 30 || rect.bottom <= line) return null;
    const y = Math.max(line, rect.top);
    return { unit: el.dataset.unit, fraction: Math.min(1, Math.max(0, (y - rect.top) / rect.height)), y };
  }
  function restore(anchor) {
    if (!anchor) return;
    const panel = narrow.matches ? activePanel() : panels().find(p => p.dataset.kind === copyLayer());
    const el = row(panel, anchor.unit); if (!el) return;
    const rect = textBounds(el), delta = rect.top + anchor.fraction * rect.height - anchor.y;
    if (Math.abs(delta) > 1) window.scrollBy({ top: delta, behavior: 'instant' });
  }
  function fit() { rail.style.height = narrow.matches && activePanel() ? `${Math.ceil(activePanel().getBoundingClientRect().height) + 2}px` : ''; }
  function positionOf(panel) { return panel.offsetLeft - inset; }
  function announce() {
    $('version-status').textContent = `${titles[active]}, ${context.settings.layers.indexOf(active) + 1} of ${context.settings.layers.length}. Same passage.`;
  }
  function updateAccessibility() {
    for (const panel of panels()) {
      const off = narrow.matches && panel.dataset.kind !== active;
      panel.inert = off;
      panel.dataset.side = !off ? 'active' : context.settings.layers.indexOf(panel.dataset.kind) < context.settings.layers.indexOf(active) ? 'before' : 'after';
      panel.dataset.peekLabel = panel.dataset.kind === 'greek' ? 'Greek' : panel.dataset.kind === 'modern' ? 'Modern' : 'English';
      if (off) panel.setAttribute('aria-hidden', 'true'); else panel.removeAttribute('aria-hidden');
      if (narrow.matches) { panel.setAttribute('role', 'tabpanel'); panel.setAttribute('aria-labelledby', `tab-${panel.dataset.kind}`); }
      else { panel.removeAttribute('role'); panel.setAttribute('aria-labelledby', `heading-${panel.dataset.kind}`); }
    }
    $('mobile-tabs').querySelectorAll('button').forEach(b => {
      const on = b.dataset.version === active; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1;
    });
  }
  function layout(anchor = null) {
    if (!context || !panels().length) return;
    clearTimeout(timer); pending = null; suppress = true;
    if (!context.settings.layers.includes(active)) active = context.settings.layers.includes('english') ? 'english' : context.settings.layers[0];
    inset = previewInset(rail.clientWidth, context.settings.size, peeks);
    rail.style.setProperty('--peek', `${inset}px`); rail.style.setProperty('--card-width', `${rail.clientWidth - inset * 2}px`);
    updateAccessibility(); fit();
    rail.scrollTo({ left: narrow.matches ? positionOf(activePanel()) : 0, behavior: 'instant' });
    restore(anchor);
    requestAnimationFrame(() => { suppress = false; });
  }
  function settle() {
    if (!context || !narrow.matches || suppress) return;
    const nearest = panels().reduce((a, b) => Math.abs(positionOf(a) - rail.scrollLeft) <= Math.abs(positionOf(b) - rail.scrollLeft) ? a : b);
    const changed = active !== nearest.dataset.kind;
    const focusWasInOldPanel = activePanel()?.contains(document.activeElement);
    active = nearest.dataset.kind;
    updateAccessibility(); fit();
    if (changed) { restore(pending); announce(); if (focusWasInOldPanel) $(`tab-${active}`).focus({ preventScroll: true }); }
    pending = null; save();
  }
  function go(layer) {
    if (!context?.settings.layers.includes(layer)) return;
    pending = capture();
    if (!narrow.matches) { active = layer; return; }
    rail.style.height = `${Math.max(...panels().map(p => p.getBoundingClientRect().height)) + 2}px`;
    const target = panels().find(p => p.dataset.kind === layer);
    rail.scrollTo({ left: positionOf(target), behavior: reduced.matches ? 'instant' : 'smooth' });
    clearTimeout(timer); timer = setTimeout(settle, 180);
  }
  rail.addEventListener('pointerdown', () => { if (narrow.matches) pending = capture(); }, { passive: true });
  rail.addEventListener('scroll', () => {
    if (suppress || !narrow.matches) return;
    if (!pending) pending = capture();
    clearTimeout(timer); timer = setTimeout(settle, 120);
  }, { passive: true });
  rail.addEventListener('scrollend', settle);
  rail.addEventListener('keydown', e => {
    if (!narrow.matches || e.target !== rail || !['ArrowLeft','ArrowRight'].includes(e.key)) return;
    e.preventDefault(); const i = context.settings.layers.indexOf(active) + (e.key === 'ArrowRight' ? 1 : -1); go(context.settings.layers[i]);
  });
  function tabs() {
    $('mobile-tabs').replaceChildren(...context.settings.layers.map((id, i, rows) => {
      const b = document.createElement('button'); b.type = 'button'; b.id = `tab-${id}`; b.dataset.version = id; b.setAttribute('role', 'tab');
      b.textContent = id === 'modern' ? 'Modern' : titles[id] === 'Greek transcription' ? 'Greek' : titles[id];
      b.setAttribute('aria-label', titles[id]); b.setAttribute('aria-controls', `panel-${id}`);
      b.addEventListener('click', () => go(id));
      b.addEventListener('keydown', e => {
        const n = { ArrowLeft: i - 1, ArrowRight: i + 1, Home: 0, End: rows.length - 1 }[e.key];
        if (n === undefined) return; e.preventDefault(); const next = rows[(n + rows.length) % rows.length]; $(`tab-${next}`).focus(); go(next);
      });
      return b;
    }));
  }
  function openSheet(title, children) {
    origin = document.activeElement; $('sheet-title').textContent = title; $('sheet-body').replaceChildren(...children);
    $('note-sheet').showModal(); $('sheet-close').focus({ preventScroll: true });
  }
  $('note-sheet').addEventListener('keydown', e => {
    if (e.key !== 'Tab') return;
    const items = [...$('note-sheet').querySelectorAll('button,a[href],input,textarea,select,[tabindex]')].filter(el => !el.disabled && el.tabIndex >= 0 && el.getClientRects().length);
    const first = items[0], last = items.at(-1);
    if (!first) return;
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  $('note-sheet').addEventListener('close', () => { if (origin?.isConnected) origin.focus({ preventScroll: true }); });
  $('note-sheet').addEventListener('click', e => {
    if (e.target !== $('note-sheet')) return;
    const r = e.target.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) e.target.close();
  });
  function notesEntry() { return context?.editorial?.passages.find(n => n.scrollId === context.current.scroll.id && n.editionId === context.current.edition.id && n.passageId === context.current.passage.id); }
  function openNotes(unitId) {
    if (!context) return;
    const { passage } = context.current;
    const indexes = notesEntry()?.noteLinks?.[unitId] || passage.notes.map((_, i) => i);
    const content = [paragraph(`${context.current.scroll.inventory} · ${unitId ? passage.units.find(u => u.id === unitId)?.reference : passage.reference}`, 'reference')];
    for (const i of indexes) { const h = document.createElement('h3'); h.textContent = passage.notes[i].title; content.push(h, paragraph(passage.notes[i].text)); }
    openSheet('Translation notes', content);
  }
  $('open-notes').addEventListener('click', () => openNotes(getSelected()));
  $('open-sources').addEventListener('click', () => {
    const content = [...document.querySelectorAll('.source-body > p')].map(el => el.cloneNode(true));
    for (const el of content) { el.removeAttribute('id'); el.querySelectorAll('[id]').forEach(e => e.removeAttribute('id')); }
    openSheet('Sources and permissions', content);
  });
  function reflection() {
    const r = notesEntry()?.reflection;
    $('reflection').hidden = !r; if (!r) return;
    $('reflection-title').textContent = r.title; $('reflection-body').textContent = r.body;
    $('reflection-open').onclick = () => {
      const a = document.createElement('a'); a.href = context.current.source.url; a.textContent = 'Source publication · cited passage';
      const back = document.createElement('button'); back.type = 'button'; back.className = 'quiet'; back.textContent = 'Return to the passage';
      back.onclick = () => { $('note-sheet').close(); selectUnit(r.unitIds[0]); revealUnit(r.unitIds[0]); };
      openSheet(r.title, [paragraph(r.question, 'reflection-question'), paragraph(r.grounding), paragraph(r.limits), paragraph(r.reference, 'reference'), a, paragraph(r.credit, 'reference'), back]);
    };
  }
  function coverage() {
    const { scroll, edition } = context.current;
    const map = context.editorial?.coverage.find(m => m.scrollId === scroll.id && m.editionId === edition.id);
    $('coverage').hidden = !map; if (!map) return;
    $('coverage-intro').textContent = map.note; $('coverage-loss').textContent = map.lossNote;
    $('column-map').replaceChildren(...Array.from({ length: map.columnCount }, (_, i) => {
      const n = i + 1, item = map.available.find(a => a.column === n), traces = map.untranscribedInSource.includes(n);
      const b = document.createElement('button'); b.type = 'button'; b.dataset.state = item ? 'available' : traces ? 'traces' : 'pending';
      b.append(document.createTextNode(String(n))); const symbol = document.createElement('span'); symbol.textContent = item ? '●' : traces ? '·' : '○'; symbol.setAttribute('aria-hidden', 'true'); b.append(symbol);
      b.setAttribute('aria-label', `Column ${n}: ${item ? 'excerpt available here' : traces ? 'no secure transcription in the cited paper' : 'not yet on this site'}`);
      b.onclick = () => {
        if (item) { navigate(new URLSearchParams({ scroll: scroll.id, edition: edition.id, passage: item.passageId }), true).then(() => $('reader').scrollIntoView({ behavior: 'instant' })); return; }
        const a = document.createElement('a'); a.href = context.current.source.url; a.textContent = 'Read the source publication';
        openSheet(`Column ${n}`, [paragraph(traces ? 'The cited paper reports surviving traces here, but no secure transcription.' : 'This column has not yet been added to Phoenix Scrolls. The cited paper contains a transcription of the surviving text.'), paragraph('The empty place in this website map does not mean that an entire ancient column is lost.'), a]);
      };
      return b;
    }));
  }
  function copyLayer() { return narrow.matches ? active : context?.settings.layers.includes('english') ? 'english' : context?.settings.layers[0] || 'english'; }
  function save() {
    if (!context || $('reader-content').hidden) return;
    const a = capture(); if (!a) return;
    seen = true;
    try { localStorage.setItem(POSITION, JSON.stringify(readingPosition(context.current, copyLayer(), a.unit, a.fraction))); } catch { /* No account or storage required. */ }
    $('place-label').textContent = `${context.current.scroll.inventory} · ${context.current.passage.units.find(u => u.id === a.unit)?.reference || context.current.passage.reference}`;
  }
  window.addEventListener('scroll', () => { clearTimeout(saveTimer); saveTimer = setTimeout(save, 180); }, { passive: true });
  window.addEventListener('pagehide', () => { if (seen) save(); });
  function revealUnit(id) {
    const el = row(activePanel(), id); if (!el) return;
    const y = readingLine() + 10;
    window.scrollBy({ top: el.getBoundingClientRect().top - y, behavior: 'instant' }); save();
  }
  function offerResume() {
    if (!context || !resumeValue || new URLSearchParams(location.search).has('edition')) return;
    const saved = savedReading(context.data, resumeValue); $('resume').hidden = false;
    $('resume-go').hidden = !saved;
    if (!saved) { $('resume-label').textContent = 'Your saved edition or passage is unavailable. You can clear this saved place.'; return; }
    const newer = saved.current.scroll.currentEdition !== saved.edition;
    $('resume-label').textContent = `Continue ${saved.current.scroll.inventory}, ${saved.current.passage.reference}.${newer ? ' A newer edition is available; this opens your saved edition.' : ''}`;
    $('resume-go').onclick = async () => {
      if (!context.settings.layers.includes(saved.layer)) { context.settings.layers = ['greek','english','modern'].filter(k => context.settings.layers.includes(k) || k === saved.layer); persistSettings(); }
      active = saved.layer;
      await navigate(new URLSearchParams({ scroll: saved.scroll, edition: saved.edition, passage: saved.passage }), true);
      $('resume').hidden = true;
      restore({ unit: saved.unit, fraction: saved.fraction, y: readingLine() + 10 }); save();
    };
  }
  $('resume-clear').addEventListener('click', () => { try { localStorage.removeItem(POSITION); } catch {} resumeValue = null; $('resume').hidden = true; });
  $('show-peeks').addEventListener('change', () => {
    const a = capture(); peeks = $('show-peeks').checked; try { localStorage.setItem(PEEKS, String(peeks)); } catch {} layout(a);
  });
  $('focus-toggle').addEventListener('click', () => {
    const a = capture(), on = document.body.classList.toggle('reading-view');
    $('focus-toggle').setAttribute('aria-pressed', String(on)); $('focus-toggle').textContent = on ? 'Exit reading view' : 'Reading view';
    if (a) layout(a); else { layout(); $('reader').scrollIntoView({ behavior: 'instant' }); }
  });
  window.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('note-sheet').open && document.body.classList.contains('reading-view')) $('focus-toggle').click(); });
  new ResizeObserver(() => { if (rail.clientWidth === lastWidth) return; lastWidth = rail.clientWidth; layout(capture()); }).observe(rail);
  narrow.addEventListener('change', () => layout(capture()));
  return {
    capture, restore, layout, fit, save, copyLayer, openNotes, offerResume, revealUnit,
    prefer(layer) { active = layer; },
    update(next, anchor) {
      context = next; tabs(); layout(anchor); reflection(); coverage();
      $('place-label').textContent = `${next.current.scroll.inventory} · ${next.current.passage.reference}`;
      const modern = next.settings.layers.includes('modern');
      $('mobile-modern').textContent = modern ? 'Hide Modern Reading' : '+ Modern Reading';
      $('mobile-modern').setAttribute('aria-pressed', String(modern));
      $('mobile-modern').disabled = modern && next.settings.layers.length === 1;
    }
  };
}
