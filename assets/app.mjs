import { LAYERS, preferences, validate, resolve, permalink, needsReview } from './model.mjs';
import { validateReadingNotes, citationText } from './reading.mjs';
import { createExperience } from './experience.mjs';

const $ = id => document.getElementById(id);
const STORAGE = 'phoenix-scrolls.preferences.v2';
const titles = { greek: 'Greek transcription', english: 'English', modern: 'Modern Reading' };
const subtitles = { greek: 'Excerpt from the published Greek transcription', english: 'Project working translation · not expert-reviewed', modern: 'Interpretive paraphrase in everyday English' };
let settings;
try { settings = preferences(JSON.parse(localStorage.getItem(STORAGE))); }
catch { settings = preferences(); }
let data, current, editorial = null, selected = null, renderToken = 0;
function persist() {
  try { localStorage.setItem(STORAGE, JSON.stringify(settings)); }
  catch { $('notice').textContent = 'Settings work here, but this browser did not allow them to be saved.'; }
}
function appearance() {
  document.documentElement.dataset.theme = settings.theme;
  document.documentElement.style.setProperty('--reading-scale', settings.size);
  $('theme').setAttribute('aria-pressed', String(settings.theme === 'dark'));
  $('theme').textContent = settings.theme === 'dark' ? 'Light mode' : 'Dark mode';
  $('size-label').value = `${Math.round(settings.size * 100)}%`;
  $('smaller').disabled = settings.size <= 1;
  $('larger').disabled = settings.size >= 1.5;
}
function options(select, rows, value, label) {
  select.replaceChildren(...rows.map(row => {
    const o = document.createElement('option'); o.value = row.id; o.textContent = label(row); return o;
  }));
  select.value = value; select.disabled = rows.length === 1;
}
function selectUnit(id) {
  selected = id;
  document.querySelectorAll('.unit').forEach(el => {
    const match = el.dataset.unit === selected;
    el.classList.toggle('is-selected', match);
    el.querySelector('.compare-unit').setAttribute('aria-pressed', String(match));
  });
  const unit = current?.passage.units.find(u => u.id === selected);
  $('alignment-status').textContent = unit ? `Matching phrases selected: ${unit.reference}.` : 'Phrase selection cleared.';
  $('copy-text').textContent = unit ? 'Copy selection & citation' : 'Copy text & citation';
}
function error(message) {
  $('reader-content').hidden = true; $('error').hidden = false;
  $('error-message').textContent = message;
  $('reading-title').textContent = 'This reading could not be opened';
  $('intro').textContent = '';
}
async function copy(text, label) {
  try { await navigator.clipboard.writeText(text); $('notice').textContent = `${label} copied.`; }
  catch {
    $('share-fallback').hidden = false; $('copy-label').textContent = `Copy ${label.toLowerCase()}`;
    $('share-url').value = text; $('share-url').focus(); $('share-url').select();
    $('notice').textContent = 'Copy the selected text. Automatic clipboard access is not available.';
  }
}
const ux = createExperience({ $, getSelected: () => selected, selectUnit, navigate, persistSettings: persist, titles });
async function render(keepPlace = true) {
  const token = ++renderToken, anchor = keepPlace ? ux.capture() : null;
  const { scroll, edition, passage, source } = current;
  $('error').hidden = true; $('reader-content').hidden = false;
  $('inventory').textContent = `${scroll.inventory} · a selected passage`;
  $('reading-title').textContent = passage.title; $('intro').textContent = passage.intro;
  options($('scroll'), data.scrolls, scroll.id, s => s.inventory);
  options($('edition'), scroll.editions, edition.id, e => `${e.date} · ${e.status}`);
  options($('passage'), edition.passages, passage.id, p => p.reference);
  $('reference').textContent = passage.reference;
  $('boundary-start').textContent = passage.boundaryStart; $('boundary-end').textContent = passage.boundaryEnd;
  $('panels').style.setProperty('--columns', settings.layers.length); $('panels').replaceChildren();
  document.querySelectorAll('[data-layer]').forEach(button => {
    const enabled = settings.layers.includes(button.dataset.layer);
    button.setAttribute('aria-pressed', String(enabled)); button.disabled = enabled && settings.layers.length === 1;
    if (button.dataset.layer === 'modern') button.textContent = enabled ? 'Modern Reading' : '+ Modern Reading';
  });
  for (const layer of settings.layers) {
    const panel = document.createElement('article'); panel.className = 'panel'; panel.dataset.kind = layer; panel.id = `panel-${layer}`;
    panel.setAttribute('aria-labelledby', `heading-${layer}`);
    const h = document.createElement('h3'); h.id = `heading-${layer}`; h.textContent = titles[layer];
    const meta = document.createElement('p'); meta.className = 'panel-meta'; meta.textContent = subtitles[layer]; panel.append(h, meta);
    for (const unit of passage.units) {
      const row = document.createElement('div'); row.className = 'unit'; row.dataset.unit = unit.id;
      const p = document.createElement('p'); p.className = 'phrase'; p.lang = layer === 'greek' ? 'grc' : 'en'; p.textContent = unit[layer].text;
      const tools = document.createElement('div'); tools.className = 'unit-tools';
      const compare = document.createElement('button'); compare.type = 'button'; compare.className = 'compare-unit'; compare.textContent = 'Compare';
      compare.setAttribute('aria-label', `Compare ${unit.reference}`); compare.setAttribute('aria-pressed', String(selected === unit.id));
      compare.addEventListener('click', () => { selectUnit(selected === unit.id ? null : unit.id); ux.save(); });
      const note = document.createElement('button'); note.type = 'button'; note.className = 'unit-note'; note.textContent = 'Notes';
      note.setAttribute('aria-label', `Notes for ${unit.reference}`); note.addEventListener('click', () => ux.openNotes(unit.id));
      tools.append(compare, note); row.append(p, tools); row.classList.toggle('is-selected', selected === unit.id); panel.append(row);
    }
    $('panels').append(panel);
  }
  $('notes-list').replaceChildren(...passage.notes.map(note => {
    const d = document.createElement('details'), s = document.createElement('summary'), p = document.createElement('p');
    s.textContent = note.title; p.textContent = note.text; d.append(s, p); return d;
  }));
  $('source-link').href = source.url; $('citation').textContent = source.citation;
  $('source-check').textContent = `Source check: ${source.checkedOn}. ${source.inspection}`;
  $('credit').textContent = edition.credit; $('rights').textContent = source.rights;
  $('edition-note').textContent = `Phoenix Scrolls edition ${edition.id}. We wrote the passage heading for this site. Copied links include the edition ID.`;
  $('permissions-status').textContent = editorial?.permissions?.[source.id]?.text || 'Permissions for larger reproductions remain to be clarified.';
  ux.update({ data, current, settings, editorial }, anchor);
  selectUnit(selected);
  for (const layer of settings.layers.filter(k => k !== 'greek')) {
    let stale = false;
    try { stale = (await Promise.all(passage.units.map(u => needsReview(u, layer)))).some(Boolean); }
    catch { stale = true; }
    if (token !== renderToken) return;
    if (stale) {
      const p = document.createElement('p'); p.className = 'review-warning';
      p.textContent = 'Source check needed: this draft may no longer match the Greek reading. Do not treat it as an updated translation.';
      document.querySelector(`[data-kind="${layer}"]`).prepend(p);
    }
  }
  ux.fit();
}
async function navigate(search, push = false) {
  try {
    ux.save(); current = resolve(data, search); selected = null;
    $('share-fallback').hidden = true; $('notice').textContent = '';
    const id = new URLSearchParams(search).get('unit');
    if (id && current.passage.units.some(u => u.id === id)) selected = id;
    if (push) history.pushState(null, '', permalink(current, location.href));
    await render(false);
    if (id && selected) ux.revealUnit(id);
  } catch (e) { error(e.message); }
}
$('theme').addEventListener('click', () => { settings.theme = settings.theme === 'dark' ? 'light' : 'dark'; appearance(); persist(); });
for (const [id, step] of [['smaller', -0.1], ['larger', 0.1]]) {
  $(id).addEventListener('click', () => {
    const anchor = ux.capture(); settings.size = Math.round(Math.max(1, Math.min(1.5, settings.size + step)) * 10) / 10;
    appearance(); persist(); ux.layout(anchor);
  });
}
document.querySelectorAll('[data-layer]').forEach(button => button.addEventListener('click', () => {
  const layer = button.dataset.layer;
  const next = settings.layers.includes(layer) ? settings.layers.filter(k => k !== layer) : LAYERS.filter(k => settings.layers.includes(k) || k === layer);
  if (!next.length) return;
  const anchor = ux.capture(); settings.layers = next;
  if (layer === 'modern' && next.includes(layer)) ux.prefer('modern');
  persist(); render(false).then(() => ux.restore(anchor)).catch(() => error('The reading view could not be updated. Please reload.'));
}));
$('mobile-modern').addEventListener('click', () => document.querySelector('[data-layer="modern"]').click());
$('scroll').addEventListener('change', () => navigate(new URLSearchParams({ scroll: $('scroll').value }), true));
$('edition').addEventListener('change', () => navigate(new URLSearchParams({ scroll: current.scroll.id, edition: $('edition').value }), true));
$('passage').addEventListener('change', () => navigate(new URLSearchParams({ scroll: current.scroll.id, edition: current.edition.id, passage: $('passage').value }), true));
$('share').addEventListener('click', () => copy(permalink(current, location.href), 'Passage link'));
$('copy-text').addEventListener('click', () => copy(citationText(current, ux.copyLayer(), selected, location.href), 'Text and citation'));
window.addEventListener('popstate', () => { if (data) navigate(location.search); });
appearance();
try {
  const response = await fetch('./data/scrolls.json', { cache: 'no-cache' });
  if (!response.ok) throw new Error('The reading data is temporarily unavailable. Please reload the page.');
  data = validate(await response.json());
  try {
    const notes = await fetch('./data/reading-notes.json', { cache: 'no-cache' });
    if (!notes.ok) throw Error('Reading notes unavailable');
    editorial = await validateReadingNotes(await notes.json(), data);
  } catch { editorial = null; }
  await navigate(location.search);
  ux.offerResume();
  if (location.hash === '#reader' && !selected) $('reader').scrollIntoView({ behavior: 'instant' });
} catch (e) { error(`Could not load the edition. ${e.message}`); }
