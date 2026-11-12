# AI 趋势日报 · dsh-ai-trends-digest

[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![release](https://img.shields.io/github/v/release/WA2124184/dsh-ai-trends-digest)](https://github.com/WA2124184/dsh-ai-trends-digest/releases)
[![node](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org)

给 **DeepSeek Harness（DSH）** 用的插件：在对话里问一句「今天 AI 圈有什么大事」，就能拿到一份分好类的日报——**具身智能、大模型、产业、论文**，同时生成 Markdown 和 HTML 文件。

> 第一次接触 DSH？它就是你现在聊天用的桌面 Agent。**插件**是给它加一项能力的方式，这个插件加的工具叫 `ai_trends_digest`。

English: [README.md](./README.md)

## 它长什么样

在 DSH 里直接说：

```text
今天具身智能和大模型有什么值得看的？
```

模型会调用 `ai_trends_digest`，做四件事：

1. 抓取 **23 个 RSS / Atom / arXiv 源**（中英文都有）；
2. 只保留最近 42 小时，去掉重复新闻；
3. 按主题分类，并**给每个主题保底名额**，机器人新闻不会融资稿挤掉；
4. 写出 `<日期>.md`、`<日期>.html`、`<日期>-phone.html`（手机可点版）、`<日期>-mobile.txt`（纯文本）以及 `latest.*` 固定名文件和一份 JSON 快照。

生成的日报大概是这样：

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

## 为什么需要它

泛 AI 资讯有三个老问题：机器人被融资稿淹没、论文标题刷屏、同一件事被多家媒体重复推送。插件用三条规则解决：

- **主题保底**：`embodied: 3`、`industry: 2`、`research: 2` 先把名额占住，剩下的按分数补。
- **去重**：链接规范化 + 标题相似度（bigram Jaccard ≥ 0.62），量子位和新智元报同一件事只留一条。
- **打分**：`来源权重 × 2 + 标题命中 × 3 + 正文命中 + 时效`，低于 `4.5` 分不进日报。

## 前置条件

| 项目 | 版本 | 说明 |
| --- | --- | --- |
| DeepSeek Harness | `>= 0.1.7` | 只有插件模式需要 |
| Node.js | `>= 18` | DSH 自带，不用另装 |
| 网络 | — | 普通 HTTPS，不需要任何 API Key |

## 安装

### 方式一：插件市场（最快）

1. 打开 **DSH → 插件 → 自定义插件市场 → 添加索引源**；
2. 粘贴：

   ```text
   https://wa2124184.github.io/dsh-ai-trends-digest/index.json
   ```

3. 刷新后，在 **发现** 页看到 **AI 趋势日报**，点安装。

> 市场条目会从 npm 拉取 `dsh-ai-trends-digest`。如果提示「找不到包」，说明 npm 版本还在发布中，请先用方式二。

### 方式二：本地目录安装

把仓库克隆到任意位置，然后对 DSH 说：

```text
plugin_manager action=install_bundle target="D:/你的路径/dsh-ai-trends-digest"
```

批准授权后，插件会出现在「已安装插件」里；工具在**下一个**会话可用。

### 方式三：手动写 patch

在 DSH profile 的 `cordis.patch.yml` 里加：

```yaml
- insert:
    - id: ai-trends-digest
      name: dsh-ai-trends-digest
      config:
        timezone: Asia/Shanghai
        windowHours: 42
```

## 怎么用

直接说人话就行：

| 你说 | 实际发生 |
| --- | --- |
| 「今天 AI 圈有什么大事？」 | 用默认参数生成完整日报 |
| 「总结最近三天的大模型新闻」 | `window_hours=72` |
| 「只要 10 条，存到 D:/日报」 | `max_items=10`、`output_dir="D:/日报"` |
| 「生成 11 月 1 日的日报」 | `date="2026-11-01"` |

也可以直接调工具：

```text
ai_trends_digest(output_dir="D:/AI日报", max_items=20)
```

| 参数 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `date` | string | 今天 | 归档标签 `YYYY-MM-DD` |
| `window_hours` | integer | 42 | 只保留这个小时数内的条目 |
| `max_items` | integer | 20 | 日报条数 |
| `output_dir` | string | `~/.dsh/ai-trends-digest` | 归档目录 |
| `min_score` | number | 4.5 | 分数阈值 |

返回内容：条数、源健康度（`sourcesOk/sourcesTotal`）、失败源、要闻 3 条、Markdown 路径。全文在生成的文件里。

## 文件落在哪

```text
<output_dir>/
├─ 2026-11-03.md        # 当天日报
├─ 2026-11-03.html      # 同一份，带样式，可直接邮件/浏览器打开
├─ 2026-11-03-phone.html  # 手机可点版：整张卡片可点、直达原文，浏览器打开
├─ 2026-11-03-mobile.txt  # 纯文本手机版：无 Markdown/HTML 符号、无 emoji，链接单独成行
├─ latest.md            # 最新一期，文件名固定
├─ latest.html
├─ latest-phone.html    # 最新一期手机可点版
├─ latest-mobile.txt    # 最新一期纯文本手机版
├─ data/2026-11-03.json # 机器可读快照
└─ index.html           # 归档浏览页
```

超过 `keepDays`（默认 90 天）的归档会自动清理；设成 `keepDays: 0` 就永不清理。

## 配置

改 patch 行里的 `config` 块，或在插件设置页里改：

| 键 | 默认 | 含义 |
| --- | --- | --- |
| `timezone` | 系统 | 判定「今天」的时区 |
| `windowHours` | `42` | 时间窗（小时） |
| `maxItems` | `20` | 日报条数 |
| `maxPerSource` | `6` | 单个源最多几条 |
| `minScore` | `4.5` | 全局分数下限 |
| `topNewsCount` | `3` | 要闻条数 |
| `topicFloors` | `{embodied:3, industry:2, research:2}` | 各主题保底条数 |
| `keepDays` | `90` | 归档保留天数（`0` 不清理） |
| `outputDir` | `~/.dsh/ai-trends-digest` | 默认归档目录 |
| `feeds` | 内置 23 源 | 整表替换源列表 |

例子——想要一份更厚的早报，并且机器人优先：

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

## 改源

`feeds.js` 导出 `DEFAULT_FEEDS`，一个源就是一行：

```js
{ name: '量子位', url: 'https://www.qbitai.com/feed', weight: 2.0, lang: 'zh', note: '机器人 + 大模型' }
```

- `weight`（0.8–2.0）影响排序，越信任的源给越高；
- 加 `enabled: false` 可以静音某个源，不用删；
- 想整表替换，就在配置里传 `feeds: [...]`。

<details>
<summary>内置的 23 个源</summary>

**中文**：量子位、新智元、雷峰网、爱范儿、极客公园、IT之家、钛媒体、InfoQ 中文、Solidot

**英文**：OpenAI News、Google AI Blog、Google DeepMind、IEEE Spectrum（AI / Robotics）、TechCrunch AI、MIT Technology Review（AI）、MarkTechPost、NVIDIA Blog、BAIR、Microsoft Research、The Verge（AI）、The Decoder、arXiv cs.RO

</details>

## 不装 DSH 也能跑

`core.js` 是零依赖的纯 Node.js，仓库里带了一个现成的命令行脚本：

```bash
git clone https://github.com/WA2124184/dsh-ai-trends-digest.git
cd dsh-ai-trends-digest
node examples/run.mjs --output ./out --window 48 --max 20
```

它会逐个源打印抓取结果，最后给出条数和文件路径。配合系统计划任务就能每天定时生成：

```bat
node "D:\tools\dsh-ai-trends-digest\examples\run.mjs" --output "D:\AI日报"
```

### 冒烟测试

```bash
node test/smoke.mjs --output ./.tmp-out --window 48
```

会真的联网抓全部 23 个源，打印条数、源健康度、各主题分布和输出路径。退出码 `1` 表示一条都没选中（通常是周末没新闻或断网）。

## 它是怎么工作的

```text
23 个源 ──► 抓取（30 秒超时，重试 2 次）
        ──► 解析 RSS / Atom / JSON Feed
        ──► 42 小时时间窗 ──► 去重（链接 + 标题相似度）
        ──► 分类（具身 / 大模型 / 产业 / 论文）
        ──► 打分 ──► 主题保底 ──► 按分数补足
        ──► 输出 Markdown + HTML + JSON 归档
```

## 常见问题

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| 第一次跑要 20–40 秒 | 23 个源并行抓取 | 正常 |
| 有几个源显示 `failed` | 源站 CDN 502 / 超时 | 稍后重试，不会中断整份日报 |
| 「论文」板块是空的 | arXiv 最近没有新的 cs.RO 投稿（周末常见） | 正常 |
| 同一条新闻出现两次 | 两个标题相似度低于 0.62 | 觉得碍眼可以调低 `core.js` 里的阈值 |
| 标题里有错别字 | 源站原文如此 | 插件不改写标题 |
| 市场安装提示找不到包 | npm 版本还在发布中 | 改用本地目录安装（方式二） |

## 目录结构

```text
dsh-ai-trends-digest/
├─ index.js            # 插件入口：注册 ai_trends_digest 工具
├─ core.js             # 抓取 / 解析 / 去重 / 打分 / 渲染 / 归档
├─ feeds.js            # 23 个默认源
├─ cordis.patch.yml    # 安装时插入的配置行
├─ locale/{en,zh}.json # 插件市场展示文案
├─ icon.svg            # 插件图标
├─ market/index.json   # format 1 市场索引（单条目）
├─ examples/run.mjs    # 命令行入口
└─ test/smoke.mjs      # 联网冒烟测试
```

## 参与贡献

欢迎提 Issue 和 PR，尤其需要：

- **新的源地址**（必须是 RSS / Atom / JSON Feed，HTML 页面不行）；
- **分类关键词**的补充和修正。

提交 PR 前请先跑一遍 `node test/smoke.mjs`。

## License

MIT
