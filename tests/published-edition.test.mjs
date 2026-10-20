import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

// Homepage copy edits must not silently rewrite an already published reading.
// New readings belong in new editions; this snapshot covers this edition only.
test('pilot-1 Greek, English and Modern Reading remain unchanged', async () => {
  const data = JSON.parse(await readFile(new URL('../data/scrolls.json', import.meta.url), 'utf8'));
  const scroll = data.scrolls.find(s => s.id === 'pherc-1667');
  const edition = scroll?.editions.find(e => e.id === '2026-10-20-pilot-1');
  assert.ok(edition, 'Keep the published edition available at its permanent link');
  const text = JSON.stringify(edition.passages.map(({ id, units }) => ({ id, units })));
  assert.equal(createHash('sha256').update(text).digest('hex'),
    'deebb0ae2bc34f426bc6de87d1d266eae5b117a34bf3466dd9091684938254f4',
    'Publish changed readings under a new edition ID');
});
