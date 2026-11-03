/**
 * Offline smoke test for the digest engine.
 *
 *   node test/smoke.mjs [--output DIR] [--window HOURS]
 *
 * It hits the real feeds (network required) and writes archives into
 * ./.tmp-out by default. Exit code 1 means the engine produced nothing.
 */

import path from 'node:path';
import { buildDigest } from '../core.js';

const args = process.argv.slice(2);
const readFlag = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};

const outputDir = path.resolve(readFlag('--output', '.tmp-out'));
const windowHours = Number(readFlag('--window', '48'));

const { doc, paths } = await buildDigest({
  options: { outputDir, windowHours, keepDays: 0 },
  logger: (line) => console.log(line),
});

console.log('\n--- result ---');
console.log('date       ', doc.date);
console.log('items      ', doc.stats.items);
console.log('sources    ', `${doc.stats.sourcesOk}/${doc.stats.sourcesTotal}`);
console.log('by topic   ', JSON.stringify(doc.stats.byTopic));
console.log('failed     ', doc.stats.failed.join(', ') || 'none');
console.log('markdown   ', paths.mdPath);
console.log('html       ', paths.htmlPath);
console.log('top        ', doc.topNews.map((item) => `${item.source}: ${item.title.slice(0, 40)}`).join(' | '));

if (doc.stats.items === 0) {
  console.error('FAIL: no items selected');
  process.exit(1);
}
