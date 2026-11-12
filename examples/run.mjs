#!/usr/bin/env node
// 不用 DSH 也能跑：
//   node examples/run.mjs
//   node examples/run.mjs --output D:/日报 --window 72 --max 30
import { buildDigest } from '../core.js';
import { DEFAULT_FEEDS } from '../feeds.js';

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};

const outputDir = arg('output', './digest-out');
const windowHours = Number(arg('window', 42));
const maxItems = Number(arg('max', 20));

console.log(`抓取 ${DEFAULT_FEEDS.length} 个源，时间窗 ${windowHours}h…`);

const result = await buildDigest({
  feeds: DEFAULT_FEEDS,
  options: { outputDir, windowHours, maxItems },
  logger: (msg) => console.log(msg),
});

console.log(`\n完成：${result.doc.stats.items} 条 / ${result.doc.stats.sourcesOk}/${result.doc.stats.sourcesTotal} 个源可用`);
console.log(`Markdown: ${result.paths.mdPath}`);
console.log(`HTML:     ${result.paths.htmlPath}`);
console.log(`MobileTXT: ${result.paths.mobileTextPath}`);
console.log(`PhoneHTML: ${result.paths.phoneHtmlPath}`);
console.log(`JSON:     ${result.paths.dataPath}`);
