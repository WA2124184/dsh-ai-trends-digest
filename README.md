# dsh-ai-trends-digest

A [DeepSeek Harness](https://github.com/deepseek-ai) host plugin that builds a daily digest of **embodied AI** and **large-model** trends from 23 curated RSS / Atom / arXiv sources, then saves Markdown + HTML archives.

If you are not using DSH, the engine in `core.js` is plain Node.js (>= 18, zero dependencies) and can be driven by any script.

中文说明见 [README.zh.md](./README.zh.md)。

## What you get

- One model-facing tool: **`ai_trends_digest`** — call it from chat when the user asks for today's AI/robotics news.
- 23 sources (Chinese + English): 量子位、新智元、雷峰网、爱范儿、极客公园、IT之家、钛媒体、InfoQ、Solidot、OpenAI、Google AI / DeepMind、IEEE Spectrum、TechCrunch、MIT Tech Review、MarkTechPost、NVIDIA、BAIR、Microsoft Research、The Verge、arXiv cs.RO …
- Classification into **具身智能 / 大模型 / 产业 / 论文** with per-topic floors (`embodied: 3`, `industry: 2`, `research: 2`) so a wave of generic AI news cannot push robotics out of the digest.
- Dedupe: normalized links + title bigram Jaccard similarity (0.62), so the same story from 量子位 and 新智元 is kept once.
- Scoring: `sourceWeight × 2 + title hits × 3 + body hits + recency`.
- Archives: `<date>.md`, `<date>.html`, `latest.md`, `latest.html`, `data/<date>.json`, `index.html` (auto-pruned after `keepDays`).

## Install

### From the plugin market

In DSH: Plugins → custom plugin market → **add index source**, then paste:

```text
https://wa2124184.github.io/dsh-ai-trends-digest/index.json
```

Refresh — **AI Trends Digest** appears under Discover and installs from npm (`dsh-ai-trends-digest@1.0.0`).

### From a local folder

Copy this folder anywhere, then ask DSH to install the bundle (this writes the profile's `package.json` and `cordis.patch.yml`):

```text
plugin_manager action=install_bundle target="D:/工作文档/dsh-ai-trends-digest"
```

Approve the permission prompt. The plugin appears as **AI 趋势日报** in the installed-plugins list, and the tool shows up in the next session.

### Manual

Add the row to your profile's `cordis.patch.yml`:

```yaml
- insert:
    - id: ai-trends-digest
      name: dsh-ai-trends-digest
      config:
        timezone: Asia/Shanghai
        windowHours: 42
```

## Use the tool

```text
ai_trends_digest(output_dir="D:/工作文档/AI趋势日报")
```

| Parameter | Type | Default | Meaning |
| --- | --- | --- | --- |
| `date` | string | today | Archive label `YYYY-MM-DD` |
| `window_hours` | integer | 42 | Only keep items newer than this |
| `max_items` | integer | 20 | Max selected items |
| `output_dir` | string | `~/.dsh/ai-trends-digest` | Where archives are written |
| `min_score` | number | 4.5 | Score threshold |

Result: item count, source health (`sourcesOk/sourcesTotal`), failed feeds, top-3 headlines and the Markdown path. The full text lives in the generated file.

## Configuration

| Key | Default | Meaning |
| --- | --- | --- |
| `timezone` | system | Timezone for "today" |
| `windowHours` | 42 | Recency window |
| `maxItems` | 20 | Digest size |
| `maxPerSource` | 6 | Max items per feed |
| `minScore` | 4.5 | Global score floor |
| `topNewsCount` | 3 | Headlines pinned in 要闻 |
| `topicFloors` | `{embodied:3, industry:2, research:2}` | Guaranteed slots per topic |
| `keepDays` | 90 | Archive retention (`0` disables pruning) |
| `outputDir` | `~/.dsh/ai-trends-digest` | Default archive directory |
| `feeds` | built-in 23 | Override the source list |

## Customize sources

`feeds.js` exports `DEFAULT_FEEDS`:

```js
{ name: '量子位', url: 'https://www.qbitai.com/feed', weight: 2.0, lang: 'zh', note: '机器人 + 大模型' }
```

Set `config.feeds` in the patch row to replace the list entirely, or edit `feeds.js` before installing. Two fields matter for ranking: `weight` (0.8–2.0) and `lang`.

## CLI / smoke test

```bash
node test/smoke.mjs --output ./.tmp-out --window 48
```

Fetches all feeds, prints `items`, `sourcesOk/sourcesTotal`, per-topic counts and the written paths; exits `1` when nothing was selected.

## Notes

- Some feeds fail intermittently (CDN 502s, timeouts). The run reports `failed` sources and keeps going; health is visible in the result.
- `research` can be empty on quiet weekends — that is the arXiv window, not a bug.
- There is **no official DSH plugin marketplace yet** (as of 2026-10). See README.zh.md for the community-index path.

## License

MIT
