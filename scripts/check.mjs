import { readFile, mkdir, copyFile, cp, rm } from 'node:fs/promises';
import { validate, needsReview } from '../assets/model.mjs';
const data = validate(JSON.parse(await readFile('data/scrolls.json', 'utf8')));
let count = 0;
for (const scroll of data.scrolls) for (const edition of scroll.editions) for (const passage of edition.passages) {
  for (const unit of passage.units) for (const layer of ['english','modern']) {
    if (await needsReview(unit, layer)) throw new Error(`Source changed: ${scroll.id}/${edition.id}/${passage.id}/${unit.id}/${layer}`);
  }
  count++;
}
const html = await readFile('index.html', 'utf8');
for (const file of ['assets/app.mjs','assets/model.mjs','assets/style.css']) await readFile(file, 'utf8');
if (!html.includes('data-layer="modern" aria-pressed="false"')) throw new Error('Modern Reading must start disabled');
console.log(`Content checks passed: ${data.scrolls.length} scroll(s), ${count} passage(s).`);
if (process.argv.includes('--build')) {
  await rm('_site', { recursive: true, force: true }); await mkdir('_site');
  await copyFile('index.html', '_site/index.html');
  for (const directory of ['assets','data']) await cp(directory, `_site/${directory}`, { recursive: true });
  console.log('Static site staged in _site; editorial drafts and tests are not deployed.');
}
