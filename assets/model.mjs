/** Pure content helpers, shared by the reader, release checks and tests. */
export const LAYERS = ['greek', 'english', 'modern'];
export const DEFAULT_LAYERS = ['greek', 'english'];
export function preferences(value = {}) {
  const v = value && typeof value === 'object' ? value : {};
  const layers = Array.isArray(v.layers) ? LAYERS.filter(k => v.layers.includes(k)) : [];
  return {
    layers: layers.length ? layers : [...DEFAULT_LAYERS],
    size: Number.isFinite(v.size) ? Math.max(1, Math.min(1.5, v.size)) : 1,
    theme: ['light', 'dark'].includes(v.theme) ? v.theme : 'light'
  };
}
export function validate(data) {
  const fail = m => { throw new Error(m); };
  const unique = (rows, label) => {
    if (!Array.isArray(rows) || !rows.length) fail(`${label} must not be empty`);
    const ids = rows.map(x => x.id);
    if (ids.some(id => typeof id !== 'string' || !/^[a-z0-9][a-z0-9.-]*$/.test(id)) || new Set(ids).size !== ids.length) fail(`Invalid or duplicate ${label} IDs`);
  };
  if (data.schemaVersion !== 2 || data.scope !== 'herculaneum') fail('Unsupported collection or schema');
  unique(data.sources, 'source'); unique(data.scrolls, 'scroll');
  for (const source of data.sources) {
    if (!source.citation || !source.version || !source.rights || !source.checkedOn || !/^https:\/\//.test(source.url)) fail('Incomplete source provenance');
  }
  for (const scroll of data.scrolls) {
    if (scroll.scope !== 'herculaneum') fail('Only Herculaneum material belongs in this collection');
    unique(scroll.editions, 'edition');
    if (!scroll.editions.some(e => e.id === scroll.currentEdition)) fail('Current edition is missing');
    for (const edition of scroll.editions) {
      if (!data.sources.some(s => s.id === edition.sourceId)) fail('Unknown source');
      if (!edition.date || !edition.status) fail('Edition needs date and status');
      unique(edition.passages, 'passage');
      for (const passage of edition.passages) {
        if (!passage.reference || !passage.title || !passage.boundaryStart || !passage.boundaryEnd) fail('Passage needs reference and excerpt boundaries');
        unique(passage.units, 'alignment');
        for (const unit of passage.units) {
          if (!unit.reference) fail('Alignment needs a source range');
          for (const layer of LAYERS) {
            const item = unit[layer];
            if (!item || typeof item.text !== 'string' || !item.text.trim() || !item.status) fail(`Incomplete ${layer} layer`);
            if (layer !== 'greek' && !/^[a-f0-9]{64}$/.test(item.basedOnGreek || '')) fail('Translation needs a Greek source fingerprint');
          }
        }
      }
    }
  }
  return data;
}
export async function digest(text) {
  const bytes = new TextEncoder().encode(text);
  const hash = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), x => x.toString(16).padStart(2, '0')).join('');
}
export async function needsReview(unit, layer) {
  return layer !== 'greek' && unit[layer].basedOnGreek !== await digest(unit.greek.text);
}
export function resolve(data, search = '') {
  const q = new URLSearchParams(search);
  const scroll = q.has('scroll') ? data.scrolls.find(s => s.id === q.get('scroll')) : data.scrolls[0];
  if (!scroll) throw new Error('The requested scroll is not available.');
  const eid = q.has('edition') ? q.get('edition') : scroll.currentEdition;
  const edition = scroll.editions.find(e => e.id === eid);
  if (!edition) throw new Error('The requested edition is not available. No different edition has been substituted.');
  const passage = q.has('passage') ? edition.passages.find(p => p.id === q.get('passage')) : edition.passages[0];
  if (!passage) throw new Error('The requested passage is not available in this edition.');
  return { scroll, edition, passage, source: data.sources.find(s => s.id === edition.sourceId) };
}
export function permalink(current, base) {
  const url = new URL(base);
  url.search = new URLSearchParams({ scroll: current.scroll.id, edition: current.edition.id, passage: current.passage.id }).toString();
  url.hash = 'reader';
  return url.href;
}
