/**
 * dsh-ai-trends-digest · core.js
 *
 * Zero-dependency digest engine:
 *   fetch feeds -> parse (RSS 2.0 / Atom / JSON Feed) -> window filter ->
 *   dedupe -> classify + score -> select with per-source and per-topic caps ->
 *   render Markdown/HTML -> write archive files.
 *
 * It never imports DSH packages, so it can be unit-tested with plain Node.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DEFAULT_FEEDS, RESEARCH_SOURCES } from './feeds.js';

const USER_AGENT = 'dsh-ai-trends-digest/1.0 (+https://github.com/deepseek-ai/deepseek-harness)';
const NOISE = /招聘|直播预告|活动预告|抽奖|优惠券|广告|赞助内容/;

export const DEFAULT_OPTIONS = {
  timezone: 'Asia/Shanghai',
  windowHours: 42,
  maxItems: 20,
  maxPerSource: 6,
  minScore: 4.5,
  topNewsCount: 3,
  topicFloors: { embodied: 3, industry: 2, research: 2 },
  keepDays: 90,
  outputDir: '',
};

/* ------------------------------------------------------------------ */
/* Network                                                             */
/* ------------------------------------------------------------------ */

export async function fetchText(url, { timeoutMs = 30000, retries = 2 } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/rss+xml, application/atom+xml, application/json, text/xml;q=0.9, */*;q=0.8' },
        signal: AbortSignal.timeout(timeoutMs),
        redirect: 'follow',
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } catch (error) {
      lastError = error;
      if (attempt < retries) await new Promise((resolve) => setTimeout(resolve, 1200 * (attempt + 1)));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

/* ------------------------------------------------------------------ */
/* Text helpers                                                        */
/* ------------------------------------------------------------------ */

const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’', mdash: '—', ndash: '–', hellip: '…',
};

export function decodeEntities(text) {
  return String(text || '')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&([a-z]+);/gi, (match, name) => ENTITIES[name.toLowerCase()] ?? match);
}

export function htmlToText(html, max = 300) {
  // 有些源把 HTML 双重转义（&lt;p&gt;…），所以「解码 → 去标签」做两轮。
  const text = decodeEntities(
    decodeEntities(String(html || ''))
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([，。；：！？、）》】”’])/g, '$1')
    .replace(/([（《【“‘])\s+/g, '$1')
    .replace(/([，。；：！？、])\s+/g, '$1')
    .trim();
  return text.length > max ? `${text.slice(0, max).trim()}…` : text;
}

function pick(block, names) {
  for (const name of names) {
    const match = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'));
    if (match) return match[1];
  }
  return '';
}

function attr(block, tag, name) {
  const match = block.match(new RegExp(`<${tag}[^>]*?\\b${name}=["']([^"']+)["'][^>]*>`, 'i'));
  return match ? match[1] : '';
}

/* ------------------------------------------------------------------ */
/* Feed parsing                                                        */
/* ------------------------------------------------------------------ */

export function parseFeed(text, feed) {
  const raw = String(text || '').trim();
  if (!raw) return [];

  if (raw.startsWith('{')) {
    try {
      const doc = JSON.parse(raw);
      const items = Array.isArray(doc.items) ? doc.items : [];
      return items.map((item) => ({
        title: htmlToText(item.title || '', 200),
        link: item.url || item.external_url || item.id || '',
        summary: htmlToText(item.summary || item.content_text || item.content_html || '', 320),
        date: toDate(item.date_published || item.date_modified || ''),
        source: feed.name,
        lang: feed.lang,
        weight: feed.weight ?? 1,
      }));
    } catch {
      return [];
    }
  }

  const blocks = [
    ...(raw.match(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/gi) || []),
    ...(raw.match(/<entry(?:\s[^>]*)?>[\s\S]*?<\/entry>/gi) || []),
  ];

  return blocks.map((block) => {
    const title = htmlToText(pick(block, ['title']), 220);
    let link = htmlToText(pick(block, ['link']), 500).trim();
    if (!link) {
      link = attr(block, 'link', 'href') || htmlToText(pick(block, ['guid', 'id']), 500).trim();
    }
    const summary = htmlToText(
      pick(block, ['description', 'summary', 'content:encoded', 'content']),
      320,
    );
    const date = toDate(
      pick(block, ['pubDate', 'published', 'updated', 'dc:date', 'date']).trim(),
    );
    return {
      title,
      link: decodeEntities(link).trim(),
      summary,
      date,
      source: feed.name,
      lang: feed.lang,
      weight: feed.weight ?? 1,
    };
  });
}

const MONTHS = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

export function toDate(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;

  const direct = new Date(raw);
  if (!Number.isNaN(direct.getTime())) return direct;

  // "Tue, 03 Nov 2026 08:00:00 GMT" (some feeds append a zone name new Date rejects)
  const rfc = raw.match(/^[A-Za-z]{3},\s+(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (rfc) {
    const month = MONTHS[rfc[2].toLowerCase()];
    if (month !== undefined) {
      return new Date(Date.UTC(+rfc[3], month, +rfc[1], +rfc[4], +rfc[5], +(rfc[6] || 0)));
    }
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Dedupe                                                              */
/* ------------------------------------------------------------------ */

export function normalizeLink(link) {
  try {
    const url = new URL(link);
    const params = new URLSearchParams(url.search);
    for (const key of [...params.keys()]) {
      if (/^(utm_|spm|from|share|ref|fbclid|gclid)/i.test(key)) params.delete(key);
    }
    const query = params.toString();
    return `${url.host.replace(/^www\./, '')}${url.pathname.replace(/\/+$/, '')}${query ? `?${query}` : ''}`.toLowerCase();
  } catch {
    return String(link || '').toLowerCase();
  }
}

function titleKey(title) {
  return String(title || '')
    .toLowerCase()
    .replace(/[^\p{Script=Han}a-z0-9]+/gu, '');
}

function bigrams(text) {
  const chars = [...text];
  const grams = new Set();
  for (let i = 0; i < chars.length - 1; i += 1) grams.add(chars[i] + chars[i + 1]);
  return grams;
}

function similar(a, b) {
  if (!a || !b) return false;
  if (a.length > 8 && (a.includes(b) || b.includes(a))) return true;
  const setA = bigrams(a);
  const setB = bigrams(b);
  if (!setA.size || !setB.size) return a === b;
  let shared = 0;
  for (const gram of setA) if (setB.has(gram)) shared += 1;
  return shared / (setA.size + setB.size - shared) >= 0.62;
}

export function dedupe(items) {
  const kept = [];
  const links = new Set();
  const titles = [];
  for (const item of items) {
    const link = normalizeLink(item.link);
    const key = titleKey(item.title);
    if (link && links.has(link)) continue;
    if (key && titles.some((other) => similar(key, other))) continue;
    if (link) links.add(link);
    if (key) titles.push(key);
    kept.push(item);
  }
  return kept;
}

/* ------------------------------------------------------------------ */
/* Classification and scoring                                          */
/* ------------------------------------------------------------------ */

export const KEYWORDS = {
  embodied: [
    '具身', '机器人', '人形', '机械臂', '灵巧手', '运动控制', '世界模型', 'VLA', '遥操作',
    '四足', '足式', '双足', ' locomotion', 'humanoid', 'embodied', 'manipulation', 'sim2real', 'teleop',
  ],
  llm: [
    '大模型', '大语言模型', '语言模型', '智能体', 'agent', '推理', '多模态', '微调', '对齐',
    '预训练', '上下文', 'LLM', 'GPT', 'Claude', 'Gemini', 'Qwen', 'DeepSeek', 'MoE', 'RAG',
    '扩散模型', '生成式', 'Transformer', 'token', '权重',
  ],
  industry: [
    '融资', '估值', 'IPO', '上市', '收购', '并购', '量产', '营收', '毛利', '交付', '工厂',
    '政策', '监管', '补贴', '合作', '订单', '商业化', '轮融资', '亿美元', '亿元',
  ],
  research: [
    '论文', '开源', '数据集', '基准', 'benchmark', 'arXiv', '预印本', 'SOTA', '开放权重', '研究报告',
  ],
};

const INDUSTRY_TITLE = /融资|估值|IPO|上市|收购|并购|量产|营收|轮融资|亿美元|亿元|财报/;

function countHits(text, words) {
  const haystack = String(text || '').toLowerCase();
  let hits = 0;
  for (const word of words) if (haystack.includes(word.toLowerCase())) hits += 1;
  return hits;
}

export function classify(item) {
  const title = item.title || '';
  const body = item.summary || '';
  const titleHits = {
    embodied: countHits(title, KEYWORDS.embodied),
    llm: countHits(title, KEYWORDS.llm),
    industry: countHits(title, KEYWORDS.industry),
    research: countHits(title, KEYWORDS.research),
  };
  const bodyHits = countHits(body, [
    ...KEYWORDS.embodied, ...KEYWORDS.llm, ...KEYWORDS.industry, ...KEYWORDS.research,
  ]);

  let topic;
  if (RESEARCH_SOURCES.has(item.source) || titleHits.research > 0) topic = 'research';
  else if (INDUSTRY_TITLE.test(title) && titleHits.embodied === 0) topic = 'industry';
  else if (titleHits.embodied > 0 && titleHits.embodied >= titleHits.llm) topic = 'embodied';
  else if (titleHits.llm > 0) topic = 'llm';
  else if (titleHits.industry > 0) topic = 'industry';
  else topic = 'llm';

  return { topic, titleHits, bodyHits };
}

function recencyBonus(date, now) {
  const hours = (now - date) / 3_600_000;
  if (hours <= 6) return 2;
  if (hours <= 12) return 1.5;
  if (hours <= 24) return 1;
  return 0.5;
}

export function scoreItem(item, now = new Date()) {
  const titleHits = Math.min(
    9,
    item.titleHits.embodied + item.titleHits.llm + item.titleHits.industry + item.titleHits.research,
  );
  return (item.weight ?? 1) * 2 + titleHits * 3 + Math.min(item.bodyHits, 3) + recencyBonus(item.date, now);
}

/* ------------------------------------------------------------------ */
/* Selection                                                           */
/* ------------------------------------------------------------------ */

export function selectItems(scored, options) {
  const floors = options.topicFloors || {};
  const perSource = new Map();
  const picked = [];

  const take = (item) => {
    const used = perSource.get(item.source) || 0;
    if (used >= options.maxPerSource) return false;
    perSource.set(item.source, used + 1);
    picked.push(item);
    return true;
  };

  for (const [topic, min] of Object.entries(floors)) {
    if (picked.filter((item) => item.topic === topic).length >= min) continue;
    for (const item of scored) {
      if (item.topic !== topic || picked.includes(item)) continue;
      if (take(item) && picked.filter((entry) => entry.topic === topic).length >= min) break;
    }
  }

  for (const item of scored) {
    if (picked.length >= options.maxItems) break;
    if (picked.includes(item)) continue;
    take(item);
  }

  return picked;
}

export function pickTopNews(picked, count) {
  const sorted = [...picked].sort((a, b) => b.score - a.score);
  const seen = new Set();
  const top = [];
  for (const item of sorted) {
    if (seen.has(item.source)) continue;
    seen.add(item.source);
    top.push(item);
    if (top.length >= count) break;
  }
  return top;
}

/* ------------------------------------------------------------------ */
/* Rendering                                                           */
/* ------------------------------------------------------------------ */

const SECTIONS = [
  { key: 'embodied', title: '具身智能', emoji: '🤖', desc: '人形机器人 · VLA · 世界模型 · 运动控制' },
  { key: 'llm', title: '大模型与智能体', emoji: '🧠', desc: '基础模型 · 推理 · Agent · 多模态' },
  { key: 'industry', title: '产业与资本', emoji: '🏭', desc: '融资 · 量产 · 政策 · 商业化' },
  { key: 'research', title: '开源与论文', emoji: '📄', desc: '新论文 · 开源项目 · 数据集' },
];

function elapsed(date, now) {
  const hours = Math.max(0, Math.round((now - date) / 3_600_000));
  if (hours < 1) return '刚刚';
  if (hours < 24) return `${hours} 小时前`;
  return `${Math.round(hours / 24)} 天前`;
}

function mdEscape(text) {
  return String(text || '').replace(/([\[\]])/g, '\\$1');
}

function mdLink(item) {
  return `[${mdEscape(item.title)}](${item.link || '#'})`;
}

export function renderMarkdown(doc, now = new Date()) {
  const lines = [];
  lines.push(`# AI 趋势日报 · ${doc.date}`, '');
  lines.push(
    `> 具身智能 & 大模型 · ${doc.stats.sourcesOk}/${doc.stats.sourcesTotal} 个订阅源 · 时间窗内 ${doc.stats.freshCount} 条 · 精选 ${doc.stats.items} 条`,
    '',
  );

  lines.push('## 🔥 今日要闻', '');
  doc.topNews.forEach((item, index) => {
    lines.push(`**${index + 1}. ${mdLink(item)}**`, '');
    if (item.summary) lines.push(`　${item.summary}`, '');
    lines.push(`　<sub>${item.source} · ${elapsed(item.date, now)}</sub>`, '');
  });

  for (const section of SECTIONS) {
    const items = doc.sections[section.key] || [];
    if (!items.length) continue;
    lines.push(`## ${section.emoji} ${section.title}`, '', `<sub>${section.desc}</sub>`, '');
    for (const item of items) {
      lines.push(`- ${mdLink(item)} — ${item.source} · ${elapsed(item.date, now)}`);
      if (item.summary) lines.push(`  ${item.summary}`);
    }
    lines.push('');
  }

  const topicLine = SECTIONS.map((s) => `${s.title} ${doc.stats.byTopic[s.key] || 0}`).join(' · ');
  lines.push('## 📊 今日观察', '');
  lines.push(`- 结构：共 ${doc.stats.items} 条（含要闻 ${doc.topNews.length} 条）· ${topicLine}`);
  lines.push(`- 今日主线：**${doc.stats.mainTopic}** 占比最高（${doc.stats.mainCount} 条），本次抓取 ${doc.stats.sourcesOk}/${doc.stats.sourcesTotal} 个来源可用。`);
  if (doc.stats.hotWords.length) {
    lines.push(`- 标题热词：${doc.stats.hotWords.map(([word, count]) => `${word}×${count}`).join(' · ')}`);
  }
  if (doc.topNews.length) lines.push(`- 头条来源：${doc.topNews.map((item) => item.source).join(' / ')}。`);
  if (doc.stats.failed.length) lines.push(`- 抓取异常：${doc.stats.failed.join('、')}（不影响其余来源）。`);
  lines.push('', '---', `<sub>自动生成于 ${now.toLocaleString('zh-CN', { timeZone: doc.timezone })} · 关键词规则筛选，未接入人工编辑</sub>`);
  return lines.join('\n');
}

function esc(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderHtml(doc, now = new Date()) {
  const itemRow = (item) => `
      <div style="padding:14px 0;border-bottom:1px solid #ececec">
        <a href="${esc(item.link)}" style="color:#1a1a1a;text-decoration:none;font-weight:600;font-size:15px;line-height:1.5">${esc(item.title)}</a>
        <div style="color:#666;font-size:13px;line-height:1.65;margin-top:6px">${esc(item.summary)}</div>
        <div style="color:#999;font-size:12px;margin-top:6px">${esc(item.source)} · ${esc(elapsed(item.date, now))}</div>
      </div>`;

  const sections = SECTIONS.map((section) => {
    const items = doc.sections[section.key] || [];
    if (!items.length) return '';
    return `
    <h2 style="font-size:16px;color:#111;margin:28px 0 4px">${section.emoji} ${esc(section.title)}</h2>
    <div style="color:#999;font-size:12px;margin-bottom:8px">${esc(section.desc)}</div>
    ${items.map(itemRow).join('')}`;
  }).join('');

  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>AI 趋势日报 · ${esc(doc.date)}</title></head>
<body style="margin:0;background:#f5f5f3;font-family:-apple-system,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif">
  <div style="max-width:680px;margin:0 auto;padding:28px 22px;background:#fff">
    <div style="font-size:12px;letter-spacing:.12em;color:#999;text-transform:uppercase">AI Trends Daily</div>
    <h1 style="font-size:24px;color:#111;margin:6px 0 6px">AI 趋势日报 · ${esc(doc.date)}</h1>
    <div style="color:#666;font-size:13px;border-bottom:2px solid #111;padding-bottom:14px">
      具身智能 &amp; 大模型 · ${doc.stats.sourcesOk}/${doc.stats.sourcesTotal} 个订阅源 · 精选 ${doc.stats.items} 条
    </div>
    <h2 style="font-size:16px;color:#111;margin:26px 0 10px">🔥 今日要闻</h2>
    ${doc.topNews.map((item, index) => `
      <div style="padding:12px 0;border-bottom:1px solid #ececec">
        <div style="color:#c0392b;font-size:12px;font-weight:700">${index + 1}</div>
        <a href="${esc(item.link)}" style="color:#111;text-decoration:none;font-weight:600;font-size:16px;line-height:1.5">${esc(item.title)}</a>
        <div style="color:#666;font-size:13px;line-height:1.7;margin-top:6px">${esc(item.summary)}</div>
        <div style="color:#999;font-size:12px;margin-top:6px">${esc(item.source)} · ${esc(elapsed(item.date, now))}</div>
      </div>`).join('')}
    ${sections}
    <div style="margin-top:30px;padding-top:16px;border-top:1px solid #ddd;color:#666;font-size:13px;line-height:1.8">
      <div>结构：共 ${doc.stats.items} 条（含要闻 ${doc.topNews.length} 条）</div>
      <div>今日主线：${esc(doc.stats.mainTopic)}（${doc.stats.mainCount} 条）· 抓取 ${doc.stats.sourcesOk}/${doc.stats.sourcesTotal} 个来源可用</div>
      ${doc.stats.failed.length ? `<div>抓取异常：${esc(doc.stats.failed.join('、'))}</div>` : ''}
    </div>
    <div style="margin-top:18px;color:#aaa;font-size:11px">自动生成于 ${esc(now.toLocaleString('zh-CN', { timeZone: doc.timezone }))} · 关键词规则筛选，未接入人工编辑</div>
  </div>
</body></html>`;
}

// Strip source boilerplate (author / licensing / date lines) so mobile summaries read clean.
function cleanSummary(text) {
  return String(text || '')
    .replace(/^（本文作者[^）]*）\s*/, '')
    .replace(/^文\s*[|｜]\s*[^\s，。]{1,20}\s+/, '')
    .replace(/^(IT之家|钛媒体|爱范儿|量子位)\s*\d{1,2}\s*月\s*\d{1,2}\s*日消息[，,]\s*/, '')
    .replace(/\s+([，。；：！？、])/g, '$1')
    .trim();
}

export function renderMobileText(doc, now = new Date()) {
  const cut = (text, n) => {
    const value = String(text || '').replace(/\s+/g, ' ').trim();
    return value.length > n ? `${value.slice(0, n)}…` : value;
  };
  const lines = [`AI 趋势日报 ${doc.date}`, ''];
  lines.push(`${doc.stats.sourcesOk}/${doc.stats.sourcesTotal} 个源可用，时间窗 ${doc.stats.freshCount} 条，精选 ${doc.stats.items} 条`, '');

  lines.push('今日要闻', '');
  doc.topNews.forEach((item, i) => {
    lines.push(`${i + 1}. ${item.title}`);
    const summary = cut(cleanSummary(item.summary), 90);
    if (summary) lines.push(`   ${summary}`);
    lines.push(`   ${item.source}，${elapsed(item.date, now)}`);
    lines.push(`   ${item.link}`, '');
  });

  SECTIONS.forEach((section) => {
    const items = doc.sections[section.key] || [];
    const inTop = doc.topNews.filter((item) => item.topic === section.key).length;
    if (!items.length && !inTop) return;
    lines.push(`${section.title}（${items.length + inTop} 条）`, '');
    if (!items.length) {
      lines.push(`本期该领域 ${inTop} 条均已入选今日要闻`, '');
      return;
    }
    items.forEach((item) => {
      lines.push(item.title);
      const summary = cut(cleanSummary(item.summary), 80);
      if (summary) lines.push(`   ${summary}`);
      lines.push(`   ${item.source}，${elapsed(item.date, now)}`);
      lines.push(`   ${item.link}`, '');
    });
  });

  lines.push('今日观察', '');
  lines.push(`结构：共 ${doc.stats.items} 条（含要闻 ${doc.topNews.length} 条）`);
  lines.push(`今日主线：${doc.stats.mainTopic}（${doc.stats.mainCount} 条）`);
  lines.push(`抓取：${doc.stats.sourcesOk}/${doc.stats.sourcesTotal} 个来源可用${doc.stats.failed.length ? `，异常 ${doc.stats.failed.join('、')}` : ''}`);
  lines.push('', `自动生成于 ${now.toLocaleString('zh-CN', { timeZone: doc.timezone })}`);
  lines.push('关键词规则筛选，未接入人工编辑；请以原文为准。');
  return `${lines.join('\n')}\n`;
}

export function writeOutputs(doc, { markdown, html, mobileText, outputDir, keepDays }) {
  fs.mkdirSync(path.join(outputDir, 'data'), { recursive: true });

  const mdPath = path.join(outputDir, `${doc.date}.md`);
  const htmlPath = path.join(outputDir, `${doc.date}.html`);
  const mobileTextPath = path.join(outputDir, `${doc.date}-mobile.txt`);
  const dataPath = path.join(outputDir, 'data', `${doc.date}.json`);
  fs.writeFileSync(mdPath, markdown);
  fs.writeFileSync(htmlPath, html);
  fs.writeFileSync(mobileTextPath, mobileText);
  fs.writeFileSync(dataPath, JSON.stringify(doc, null, 2));
  fs.writeFileSync(path.join(outputDir, 'latest.md'), markdown);
  fs.writeFileSync(path.join(outputDir, 'latest.html'), html);
  fs.writeFileSync(path.join(outputDir, 'latest-mobile.txt'), mobileText);

  const dates = fs
    .readdirSync(outputDir)
    .filter((file) => /^\d{4}-\d{2}-\d{2}\.md$/.test(file))
    .map((file) => file.replace(/\.md$/, ''))
    .sort()
    .reverse();

  const links = dates
    .map((date) => {
      const hasTxt = fs.existsSync(path.join(outputDir, `${date}-mobile.txt`));
      return `<li><a href="${date}.html">${date}</a>${hasTxt ? ` · <a href="${date}-mobile.txt">📱 手机版</a>` : ''}</li>`;
    })
    .join('\n');
  fs.writeFileSync(
    path.join(outputDir, 'index.html'),
    `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AI 趋势日报归档</title></head>
<body style="font-family:-apple-system,'Segoe UI','PingFang SC',sans-serif;max-width:640px;margin:40px auto;padding:0 20px">
<h1 style="font-size:22px">AI 趋势日报 · 归档</h1><p><a href="latest.html">最新一期</a> · <a href="latest-mobile.txt">📱 手机版</a></p>
<ol style="line-height:2;font-size:15px">${links}</ol></body></html>`,
  );

  if (keepDays > 0) {
    const cutoff = Date.now() - keepDays * 86_400_000;
    for (const file of fs.readdirSync(outputDir)) {
      const match = file.match(/^(\d{4}-\d{2}-\d{2})(-mobile)?\.(md|html|txt)$/);
      if (match && new Date(`${match[1]}T00:00:00Z`).getTime() < cutoff) {
        fs.rmSync(path.join(outputDir, file), { force: true });
      }
    }
    const dataDir = path.join(outputDir, 'data');
    for (const file of fs.readdirSync(dataDir)) {
      const match = file.match(/^(\d{4}-\d{2}-\d{2})\.json$/);
      if (match && new Date(`${match[1]}T00:00:00Z`).getTime() < cutoff) {
        fs.rmSync(path.join(dataDir, file), { force: true });
      }
    }
  }

  return { mdPath, htmlPath, mobileTextPath, dataPath };
}

/* ------------------------------------------------------------------ */
/* Main pipeline                                                       */
/* ------------------------------------------------------------------ */

export function resolveOutputDir(options) {
  return options.outputDir || path.join(os.homedir(), '.dsh', 'ai-trends-digest');
}

export async function buildDigest({ feeds = DEFAULT_FEEDS, options = {}, logger = () => {} } = {}) {
  const now = new Date();
  const config = { ...DEFAULT_OPTIONS, ...options, topicFloors: { ...DEFAULT_OPTIONS.topicFloors, ...(options.topicFloors || {}) } };
  const enabled = feeds.filter((feed) => feed.enabled !== false);
  const outputDir = resolveOutputDir(config);

  logger(`开始抓取 ${enabled.length} 个订阅源…`);

  const results = await Promise.allSettled(
    enabled.map(async (feed) => {
      const started = Date.now();
      const text = await fetchText(feed.url, { timeoutMs: 30000, retries: 2 });
      const parsed = parseFeed(text, feed);
      logger(`✓ ${feed.name}：${parsed.length} 条（${Date.now() - started}ms）`);
      return { feed, items: parsed };
    }),
  );

  const failed = [];
  const all = [];
  for (let i = 0; i < results.length; i += 1) {
    const result = results[i];
    const feed = enabled[i];
    if (result.status === 'rejected') {
      const message = result.reason instanceof Error ? result.reason.message : String(result.reason);
      failed.push(feed.name);
      logger(`✗ ${feed.name}：${message}`);
      continue;
    }
    all.push(...result.value.items);
  }

  const cutoff = now.getTime() - config.windowHours * 3_600_000;
  const fresh = all.filter((item) => item.date && item.date.getTime() >= cutoff && item.date.getTime() <= now.getTime() + 3_600_000);
  logger(`时间窗内 ${fresh.length} 条（共 ${all.length} 条，窗口 ${config.windowHours}h）`);

  const unique = dedupe(fresh);
  const scored = unique
    .map((item) => ({ ...item, ...classify(item) }))
    .filter((item) => {
      if (NOISE.test(item.title)) return false;
      if (item.titleHits.embodied + item.titleHits.llm === 0 && item.bodyHits < 2) return false;
      return true;
    })
    .map((item) => ({ ...item, score: scoreItem(item, now) }))
    .filter((item) => item.score >= config.minScore)
    .sort((a, b) => b.score - a.score);

  const picked = selectItems(scored, config);
  const topNews = pickTopNews(picked, config.topNewsCount);
  const starred = new Set(topNews.map((item) => item.link || item.title));
  const rest = picked.filter((item) => !starred.has(item.link || item.title));

  const byTopic = Object.fromEntries(SECTIONS.map((section) => [section.key, picked.filter((item) => item.topic === section.key).length]));
  const main = Object.entries(byTopic).sort((a, b) => b[1] - a[1])[0] || ['llm', 0];

  const wordCounts = new Map();
  for (const item of picked) {
    for (const word of ['机器人', '具身', '大模型', '智能体', '融资', '开源', '芯片']) {
      if (item.title.includes(word)) wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
    }
  }
  const hotWords = [...wordCounts.entries()].filter(([, count]) => count > 0).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const doc = {
    date: config.date || dateKey(now, config.timezone),
    timezone: config.timezone,
    topNews,
    sections: Object.fromEntries(SECTIONS.map((section) => [section.key, rest.filter((item) => item.topic === section.key)])),
    stats: {
      items: picked.length,
      freshCount: fresh.length,
      rawCount: all.length,
      sourcesTotal: enabled.length,
      sourcesOk: enabled.length - failed.length,
      failed,
      byTopic,
      mainTopic: SECTIONS.find((section) => section.key === main[0])?.title || '大模型与智能体',
      mainCount: main[1],
      hotWords,
    },
  };

  const markdown = renderMarkdown(doc, now);
  const html = renderHtml(doc, now);
  const mobileText = renderMobileText(doc, now);
  const paths = writeOutputs(doc, { markdown, html, mobileText, outputDir, keepDays: config.keepDays });
  logger(`生成完成：${picked.length} 条 / ${doc.stats.sourcesOk} 个源可用 → ${paths.mdPath}`);

  return { doc, markdown, html, mobileText, paths, outputDir };
}

export function dateKey(date, timeZone = 'Asia/Shanghai') {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
