# AI Trends Digest · dsh-ai-trends-digest

[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![release](https://img.shields.io/github/v/release/WA2124184/dsh-ai-trends-digest)](https://github.com/WA2124184/dsh-ai-trends-digest/releases)
[![node](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org)

A plugin for **DeepSeek Harness (DSH)** that turns "what happened in AI today?" into one clean daily digest: **embodied AI**, **large models**, **industry**, and **papers**, written to Markdown + HTML.

> New to DSH? It is the desktop agent you are chatting with. A *plugin* adds one capability to it. This one adds a tool named `ai_trends_digest`.

中文说明：[README.zh.md](./README.zh.md)

## What you get

Ask the model in plain language:

```text
今天具身智能和大模型有什么值得看的？
```

and it calls `ai_trends_digest`, which:

1. fetches **23 RSS / Atom / arXiv feeds** (Chinese + English),
2. keeps only the last 42 hours, removes duplicates,
3. classifies each story and **guarantees slots per topic** so robotics is never buried by funding news,
4. writes `<date>.md`, `<date>.html`, `latest.md`, `latest.html` and a JSON snapshot.

A finished digest looks like this:

```markdown
# AI 趋势日报 · 2026-11-03
> 具身智能 & 大模型 · 22/23 个订阅源 · 时间窗内 210 条 · 精选 20 条

## 🔥 今日要闻
1. **【示例】人形机器人量产线落地** — 量子位
2. **【示例】某开源模型发布 70B 版本** — 新智元
3. **【示例】机器人公司完成新一轮融资** — 雷峰网

## 🦾 具身智能
- **【示例】灵巧手触觉传感器开源** — IEEE Spectrum …

## 🧠 大模型与智能体
- **【示例】推理模型在数学基准上刷新纪录** — OpenAI …

## 🏭 产业动态
- …

## 📄 论文速递
- **【示例】arXiv:2601.01234 — 视觉-语言-动作策略** …
```

## Why this exists

Generic AI newsletters drown robotics in funding rounds, and paper feeds drown everything in titles. This plugin fixes that with three rules:

- **Topic floors** — `embodied: 3`, `industry: 2`, `research: 2` slots are reserved before score-based filling.
- **Dedupe** — same story from 量子位 and 新智元 is kept once (link normalisation + title similarity ≥ 0.62).
- **Scoring** — `sourceWeight × 2 + title hits × 3 + body hits + recency`, with a `4.5` floor.

## Requirements

| Thing | Version | Notes |
| --- | --- | --- |
| DeepSeek Harness | `>= 0.1.7` | needed only for the plugin mode |
| Node.js | `>= 18` | already bundled with DSH |
| Network | — | plain HTTPS, no API keys |

## Install

### Option 1 — Plugin market (fastest)

1. Open **DSH → 插件 (Plugins) → 自定义插件市场 (Custom market) → 添加索引源 (Add index source)**.
2. Paste:

   ```text
   https://wa2124184.github.io/dsh-ai-trends-digest/index.json
   ```

3. Refresh. **AI 趋势日报 / AI Trends Digest** appears under **发现 (Discover)** — click install.

> The market entry installs `dsh-ai-trends-digest` from npm. If npm reports "package not found", the release is still being published — use Option 2 meanwhile.

### Option 2 — From a local folder

Clone this repo, then ask DSH:

```text
plugin_manager action=install_bundle target="D:/path/to/dsh-ai-trends-digest"
```

Approve the prompt. The plugin shows up in the installed list, and the tool is available in the **next** session.

### Option 3 — Manual patch

Add this row to your DSH profile's `cordis.patch.yml`:

```yaml
- insert:
    - id: ai-trends-digest
      name: dsh-ai-trends-digest
      config:
        timezone: Asia/Shanghai
        windowHours: 42
```

## Use it

Just talk:

| You say | What happens |
| --- | --- |
| "今天 AI 圈有什么大事？" | full digest with default settings |
| "总结最近三天的大模型新闻" | `window_hours=72` |
| "只要 10 条，存到 D:/日报" | `max_items=10`, `output_dir="D:/日报"` |
| "生成 11 月 1 日的日报" | `date="2026-11-01"` |

Direct tool call, if you prefer:

```text
ai_trends_digest(output_dir="D:/AI日报", max_items=20)
```

| Parameter | Type | Default | Meaning |
| --- | --- | --- | --- |
| `date` | string | today | archive label `YYYY-MM-DD` |
| `window_hours` | integer | 42 | only keep items newer than this |
| `max_items` | integer | 20 | digest size |
| `output_dir` | string | `~/.dsh/ai-trends-digest` | where archives are written |
| `min_score` | number | 4.5 | score threshold |

The tool returns the item count, source health (`sourcesOk/sourcesTotal`), failed feeds, top-3 headlines and the Markdown path. The full text lives in the generated file.

## Where the files go

```text
<output_dir>/
├─ 2026-11-03.md        # today's digest
├─ 2026-11-03.html      # same, styled for mail/浏览器
├─ latest.md            # newest digest, stable name
├─ latest.html
├─ data/2026-11-03.json # machine-readable snapshot
└─ index.html           # archive browser
```

Archives older than `keepDays` (90 by default) are pruned automatically; set `keepDays: 0` to keep everything.

## Configuration

Edit the `config` block of the patch row (Option 3) or the plugin's settings:

| Key | Default | Meaning |
| --- | --- | --- |
| `timezone` | system | timezone used to decide "today" |
| `windowHours` | `42` | recency window |
| `maxItems` | `20` | digest size |
| `maxPerSource` | `6` | max items per feed |
| `minScore` | `4.5` | global score floor |
| `topNewsCount` | `3` | pinned headlines |
| `topicFloors` | `{embodied:3, industry:2, research:2}` | guaranteed slots |
| `keepDays` | `90` | archive retention (`0` = never prune) |
| `outputDir` | `~/.dsh/ai-trends-digest` | default archive directory |
| `feeds` | built-in 23 | replace the source list |

Example — a bigger morning report, robotics first:

```yaml
config:
  timezone: Asia/Shanghai
  windowHours: 72
  maxItems: 30
  topicFloors:
    embodied: 5
    industry: 3
    research: 3
```

## Customize sources

`feeds.js` exports `DEFAULT_FEEDS`. A feed is one line:

```js
{ name: '量子位', url: 'https://www.qbitai.com/feed', weight: 2.0, lang: 'zh', note: '机器人 + 大模型' }
```

- `weight` (0.8–2.0) is the ranking multiplier — raise it for sources you trust.
- Set `enabled: false` to mute a feed without deleting it.
- To replace the list entirely, pass `feeds: [...]` in the plugin config.

<details>
<summary>Built-in sources (23)</summary>

**中文**：量子位、新智元、雷峰网、爱范儿、极客公园、IT之家、钛媒体、InfoQ 中文、Solidot

**English**：OpenAI News、Google AI Blog、Google DeepMind、IEEE Spectrum (AI / Robotics)、TechCrunch AI、MIT Technology Review (AI)、MarkTechPost、NVIDIA Blog、BAIR、Microsoft Research、The Verge (AI)、The Decoder、arXiv cs.RO

</details>

## Run it without DSH

`core.js` is plain Node.js with zero dependencies. A ready-made CLI lives in `examples/run.mjs`:

```bash
git clone https://github.com/WA2124184/dsh-ai-trends-digest.git
cd dsh-ai-trends-digest
node examples/run.mjs --output ./out --window 48 --max 20
```

It prints progress per feed, then the number of items and the paths written. Use it with cron / Windows Task Scheduler if you want a file every morning:

```bat
node "D:\tools\dsh-ai-trends-digest\examples\run.mjs" --output "D:\AI日报"
```

### Smoke test

```bash
node test/smoke.mjs --output ./.tmp-out --window 48
```

This really hits the network for all 23 feeds and prints item count, source health, per-topic distribution and paths. Exit code `1` means nothing was selected (usually a quiet weekend or no network).

## How it works

```text
23 feeds ──► fetch (30s timeout, 2 retries)
          ──► parse RSS / Atom / JSON Feed
          ──► 42h window ──► dedupe (link + title similarity)
          ──► classify (embodied / llm / industry / research)
          ──► score ──► topic floors ──► fill by score
          ──► Markdown + HTML + JSON archives
```

## Troubleshooting

| Symptom | Why | Fix |
| --- | --- | --- |
| First run takes 20–40 s | 23 feeds are fetched in parallel | normal |
| A few feeds show as `failed` | CDN 502s / timeouts on the source side | retry later; it never aborts the digest |
| `论文` section is empty | arXiv has no fresh cs.RO submissions (weekends) | expected |
| Same story appears twice | titles differ more than the 0.62 threshold | lower the threshold in `core.js` if it bothers you |
| Titles contain typos | they come from the source | plugin never rewrites titles |
| Market install says package not found | npm release still rolling out | install from the local folder (Option 2) |

## Project layout

```text
dsh-ai-trends-digest/
├─ index.js            # plugin entry: registers ai_trends_digest
├─ core.js             # fetch / parse / dedupe / score / render / archive
├─ feeds.js            # 23 default sources
├─ cordis.patch.yml    # config row inserted on install
├─ locale/{en,zh}.json # market metadata
├─ icon.svg            # plugin icon
├─ market/index.json   # format-1 market index (single entry)
├─ examples/run.mjs    # standalone CLI
└─ test/smoke.mjs      # networked smoke test
```

## Contributing

Issues and PRs are welcome — especially **new feed URLs** (must be RSS/Atom JSON, not HTML pages) and **keyword improvements** for classification. Please run `node test/smoke.mjs` before opening a PR.

## License

MIT
