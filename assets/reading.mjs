import { LAYERS, resolve, digest, permalink } from './model.mjs';

/** Keep editorial prompts outside the immutable text edition, but tied to its evidence. */
export async function validateReadingNotes(notes, data) {
  if (notes?.schemaVersion !== 1 || !Array.isArray(notes.passages) || !Array.isArray(notes.coverage)) throw Error('Invalid reading notes');
  const seen = new Set();
  for (const item of notes.passages) {
    const key = `${item.scrollId}/${item.editionId}/${item.passageId}`;
    if (seen.has(key)) throw Error('Duplicate reading notes');
    seen.add(key);
    const c = resolve(data, new URLSearchParams({ scroll: item.scrollId, edition: item.editionId, passage: item.passageId }));
    if (c.source.id !== item.sourceId) throw Error('Reading note source mismatch');
    for (const [id, indexes] of Object.entries(item.noteLinks || {})) {
      if (!c.passage.units.some(u => u.id === id) || !Array.isArray(indexes) || indexes.some(n => !Number.isInteger(n) || !c.passage.notes[n])) throw Error('Invalid note link');
    }
    const r = item.reflection;
    if (!r) continue;
    for (const field of ['id','revision','status','credit','title','body','question','grounding','limits','reference']) if (typeof r[field] !== 'string' || !r[field].trim()) throw Error(`Missing reflection ${field}`);
    if (!r.unitIds?.length || r.unitIds.length !== r.basedOnGreek?.length || new Set(r.unitIds).size !== r.unitIds.length) throw Error('Reflection needs distinct evidence anchors');
    for (let i = 0; i < r.unitIds.length; i++) {
      const u = c.passage.units.find(u => u.id === r.unitIds[i]);
      if (!u || await digest(u.greek.text) !== r.basedOnGreek[i]) throw Error('Reflection evidence changed; review required');
    }
  }
  for (const map of notes.coverage) {
    const c = resolve(data, new URLSearchParams({ scroll: map.scrollId, edition: map.editionId }));
    if (map.sourceId !== c.source.id || !Number.isInteger(map.columnCount) || map.columnCount < 1 || map.columnCount > 200) throw Error('Invalid coverage source or count');
    const validColumn = n => Number.isInteger(n) && n > 0 && n <= map.columnCount;
    if (!Array.isArray(map.untranscribedInSource) || !Array.isArray(map.available) || map.untranscribedInSource.some(n => !validColumn(n))) throw Error('Invalid column coverage');
    for (const a of map.available) if (!validColumn(a.column) || map.untranscribedInSource.includes(a.column) || !c.edition.passages.some(p => p.id === a.passageId)) throw Error('Invalid available passage');
  }
  return notes;
}
export function savedReading(data, value) {
  if (!value || value.version !== 1 || !LAYERS.includes(value.layer) || !['scroll','edition','passage','unit'].every(k => typeof value[k] === 'string' && value[k])) return null;
  try {
    const c = resolve(data, new URLSearchParams({ scroll: value.scroll, edition: value.edition, passage: value.passage }));
    if (!c.passage.units.some(u => u.id === value.unit)) return null;
    return { ...value, fraction: Number.isFinite(value.fraction) ? Math.min(1, Math.max(0, value.fraction)) : 0, current: c };
  } catch { return null; }
}
export function readingPosition(current, layer, unit, fraction = 0) {
  return { version: 1, scroll: current.scroll.id, edition: current.edition.id, passage: current.passage.id, layer, unit, fraction };
}
export function previewInset(width, size, enabled = true) {
  if (!enabled || width < 310 || size >= 1.4) return 0;
  return Math.max(0, Math.min(36, (width - 250) / 2));
}
export function citationText(current, layer, unitId, base) {
  const units = unitId ? current.passage.units.filter(u => u.id === unitId) : current.passage.units;
  if (!LAYERS.includes(layer) || !units.length) throw Error('Nothing selected to copy');
  const label = { greek: 'Greek excerpt from the published transcription', english: 'Phoenix Scrolls English working translation (AI-assisted; not expert-reviewed)', modern: 'Phoenix Scrolls interpretive paraphrase (AI-assisted; not expert-reviewed)' }[layer];
  const url = new URL(permalink(current, base));
  if (unitId) url.searchParams.set('unit', unitId);
  return `${units.map(u => u[layer].text).join(' ')}\n\n${label}\n${current.scroll.inventory} · ${unitId ? units[0].reference : current.passage.reference}\nSource: ${current.source.citation}\nPhoenix Scrolls edition: ${current.edition.id}\n${url.href}`;
}
