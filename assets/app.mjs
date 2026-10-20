import { LAYERS, preferences, validate, resolve, permalink, needsReview } from './model.mjs';

const $ = id => document.getElementById(id);
const STORAGE = 'phoenix-scrolls.preferences.v2';
const narrow = matchMedia('(max-width: 680px)');
const titles = { greek: 'Greek transcription', english: 'English', modern: 'Modern Reading' };
const subtitles = { greek: 'Excerpt from the published Greek transcription', english: 'Project working translation · not expert-reviewed', modern: 'Interpretive paraphrase in everyday English' };
let settings;
try { settings = preferences(JSON.parse(localStorage.getItem(STORAGE))); }
catch { settings = preferences(); }
let data, current, selected = null, mobileLayer = 'english', renderToken = 0;

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
function highlight(id) {
  selected = selected === id ? null : id;
  document.querySelectorAll('[data-unit]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.unit === selected)));
  const unit = current.passage.units.find(u => u.id === selected);
  $('alignment-status').textContent = unit ? `Matching phrases selected: ${unit.reference}.` : 'Phrase selection cleared.';
}
function mobileView() {
  if (!settings.layers.includes(mobileLayer)) mobileLayer = settings.layers.includes('english') ? 'english' : settings.layers[0];
  options($('mobile-layer'), settings.layers.map(id => ({ id })), mobileLayer, row => titles[row.id]);
  document.querySelectorAll('.panel').forEach(panel => { panel.hidden = narrow.matches && panel.dataset.kind !== mobileLayer; });
}
function error(message) {
  $('reader-content').hidden = true; $('error').hidden = false;
  $('error-message').textContent = message;
  $('reading-title').textContent = 'This reading could not be opened';
  $('intro').textContent = '';
}
async function render() {
  const token = ++renderToken;
  const { scroll, edition, passage, source } = current;
  $('error').hidden = true; $('reader-content').hidden = false;
  $('inventory').textContent = `${scroll.inventory} · a selected passage`;
  $('reading-title').textContent = passage.title;
  $('intro').textContent = passage.intro;
  options($('scroll'), data.scrolls, scroll.id, s => s.inventory);
  options($('edition'), scroll.editions, edition.id, e => `${e.date} · ${e.status}`);
  options($('passage'), edition.passages, passage.id, p => p.reference);
  $('reference').textContent = passage.reference;
  $('boundary-start').textContent = passage.boundaryStart;
  $('boundary-end').textContent = passage.boundaryEnd;
  $('panels').style.setProperty('--columns', settings.layers.length);
  $('panels').replaceChildren();
  document.querySelectorAll('[data-layer]').forEach(button => {
    const enabled = settings.layers.includes(button.dataset.layer);
    button.setAttribute('aria-pressed', String(enabled));
    button.disabled = enabled && settings.layers.length === 1;
    if (button.dataset.layer === 'modern') button.textContent = enabled ? 'Modern Reading' : '+ Modern Reading';
  });
  for (const layer of settings.layers) {
    const panel = document.createElement('article'); panel.className = 'panel'; panel.dataset.kind = layer;
    panel.setAttribute('aria-labelledby', `heading-${layer}`);
    const h = document.createElement('h3'); h.id = `heading-${layer}`; h.textContent = titles[layer];
    const meta = document.createElement('p'); meta.className = 'panel-meta'; meta.textContent = subtitles[layer];
    panel.append(h, meta);
    for (const unit of passage.units) {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'phrase'; button.dataset.unit = unit.id;
      button.lang = layer === 'greek' ? 'grc' : 'en'; button.textContent = unit[layer].text;
      button.setAttribute('aria-pressed', String(selected === unit.id));
      button.addEventListener('click', () => highlight(unit.id));
      panel.append(button);
    }
    $('panels').append(panel);
  }
  mobileView();
  $('notes-list').replaceChildren(...passage.notes.map(note => {
    const d = document.createElement('details'), s = document.createElement('summary'), p = document.createElement('p');
    s.textContent = note.title; p.textContent = note.text; d.append(s, p); return d;
  }));
  $('source-link').href = source.url;
  $('citation').textContent = source.citation;
  $('source-check').textContent = `Source check: ${source.checkedOn}. ${source.inspection}`;
  $('credit').textContent = edition.credit;
  $('rights').textContent = source.rights;
  $('edition-note').textContent = `Phoenix Scrolls edition ${edition.id}. We wrote the passage heading for this site. Copied links include the edition ID.`;
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
}
function navigate(search, push = false) {
  try {
    current = resolve(data, search); selected = null;
    $('share-fallback').hidden = true; $('notice').textContent = '';
    if (push) history.pushState(null, '', permalink(current, location.href));
    render().catch(() => error('A reading error occurred. Please reload or open the scholarly source.'));
  } catch (e) { error(e.message); }
}
$('theme').addEventListener('click', () => { settings.theme = settings.theme === 'dark' ? 'light' : 'dark'; appearance(); persist(); });
for (const [id, step] of [['smaller', -0.1], ['larger', 0.1]]) {
  $(id).addEventListener('click', () => { settings = preferences({ ...settings, size: Math.round((settings.size + step) * 10) / 10 }); appearance(); persist(); });
}
document.querySelectorAll('[data-layer]').forEach(button => button.addEventListener('click', () => {
  const layer = button.dataset.layer;
  const next = settings.layers.includes(layer) ? settings.layers.filter(k => k !== layer) : LAYERS.filter(k => settings.layers.includes(k) || k === layer);
  if (!next.length) return;
  settings.layers = next;
  if (layer === 'modern' && next.includes(layer) && narrow.matches) mobileLayer = layer;
  persist(); render().catch(() => error('The reading view could not be updated. Please reload.'));
}));
$('mobile-layer').addEventListener('change', () => { mobileLayer = $('mobile-layer').value; mobileView(); });
narrow.addEventListener('change', mobileView);
$('scroll').addEventListener('change', () => navigate(new URLSearchParams({ scroll: $('scroll').value }).toString(), true));
$('edition').addEventListener('change', () => navigate(new URLSearchParams({ scroll: current.scroll.id, edition: $('edition').value }).toString(), true));
$('passage').addEventListener('change', () => navigate(new URLSearchParams({ scroll: current.scroll.id, edition: current.edition.id, passage: $('passage').value }).toString(), true));
$('share').addEventListener('click', async () => {
  const url = permalink(current, location.href);
  try { await navigator.clipboard.writeText(url); $('notice').textContent = 'Link copied. It points to this passage and this edition.'; }
  catch { $('share-fallback').hidden = false; $('share-url').value = url; $('share-url').focus(); $('share-url').select(); $('notice').textContent = 'Copy the selected link. Automatic clipboard access is not available.'; }
});
window.addEventListener('popstate', () => { if (data) navigate(location.search); });
appearance();
try {
  const response = await fetch('./data/scrolls.json', { cache: 'no-cache' });
  if (!response.ok) throw new Error('The reading data is temporarily unavailable. Please reload the page.');
  data = validate(await response.json());
  navigate(location.search);
} catch (e) { error(`Could not load the edition. ${e.message}`); }
