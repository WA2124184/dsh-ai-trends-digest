# AI 趋势日报 · dsh-ai-trends-digest

给 [DeepSeek Harness](https://github.com/deepseek-ai) 的宿主插件：从 23 个 RSS / Atom / arXiv 源抓取**具身智能**与**大模型**趋势，去重、打分、按主题保底，生成 Markdown + HTML 日报。模型通过一个工具 `ai_trends_digest` 调用它。

不装 DSH 也能用：`core.js` 是零依赖的纯 Node.js（>= 18）引擎。

English: [README.md](./README.md)

## 它解决什么

每天几十条 AI 新闻里，「机器人」经常被大模型融资稿挤掉。这个插件做三件事：

1. **分类 + 保底**：具身智能 / 大模型 / 产业 / 论文四类，`topicFloors` 先保证具身 3 条、产业 2 条、论文 2 条，剩下按分数补。
2. **去重**：链接规范化（去 utm）+ 标题 bigram Jaccard 相似度（0.62），同一事件只留一条。
3. **归档**：`<日期>.md`、`<日期>.html`、`latest.md/html`、`data/<日期>.json`、`index.html`，超过 `keepDays` 自动清理。

## 安装

### 从插件市场安装（推荐）

DSH → 插件 → 自定义插件市场 → **添加索引源**，粘贴：

```text
https://wa2124184.github.io/dsh-ai-trends-digest/index.json
```

刷新后「发现」页会出现 **AI 趋势日报**，点安装即可（底层从 npm 拉取 `dsh-ai-trends-digest@1.0.0`）。

### 本地目录安装（开发调试）

把整个文件夹放到任意位置，然后对 DSH 说：

```text
plugin_manager action=install_bundle target="D:/工作文档/dsh-ai-trends-digest"
```

批准授权后，插件会出现在「已安装插件」里（名称 **AI 趋势日报**），工具在下一个会话可用。

### 手动写 patch

在 profile 的 `cordis.patch.yml` 里加：

```yaml
- insert:
    - id: ai-trends-digest
      name: dsh-ai-trends-digest
      config:
        timezone: Asia/Shanghai
        windowHours: 42
```

## 调用

```text
ai_trends_digest(output_dir="D:/工作文档/AI趋势日报")
```

| 参数 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `date` | string | 今天 | 归档标签 `YYYY-MM-DD` |
| `window_hours` | integer | 42 | 只保留这个小时数内的条目 |
| `max_items` | integer | 20 | 最多选多少条 |
| `output_dir` | string | `~/.dsh/ai-trends-digest` | 归档目录 |
| `min_score` | number | 4.5 | 分数阈值 |

返回：条数、源健康度（`sourcesOk/sourcesTotal`）、失败源、要闻 3 条、Markdown 路径。全文在生成的文件里。

## 配置

| 键 | 默认 | 含义 |
| --- | --- | --- |
| `timezone` | 系统 | 判定「今天」的时区 |
| `windowHours` | 42 | 时间窗 |
| `maxItems` | 20 | 日报条数 |
| `maxPerSource` | 6 | 单源上限 |
| `minScore` | 4.5 | 全局分数下限 |
| `topNewsCount` | 3 | 要闻条数 |
| `topicFloors` | `{embodied:3, industry:2, research:2}` | 各主题保底条数 |
| `keepDays` | 90 | 归档保留天数（`0` 不清理） |
| `outputDir` | `~/.dsh/ai-trends-digest` | 默认归档目录 |
| `feeds` | 内置 23 源 | 覆盖源列表 |

## 改源

`feeds.js` 导出 `DEFAULT_FEEDS`：

```js
{ name: '量子位', url: 'https://www.qbitai.com/feed', weight: 2.0, lang: 'zh', note: '机器人 + 大模型' }
```

`weight`（0.8–2.0）直接影响排序；`lang` 目前只用于展示。也可以在 patch 里用 `config.feeds` 整表替换。

## 本地测试

```bash
node test/smoke.mjs --output ./.tmp-out --window 48
```

会真的联网抓 23 个源，打印条数、源健康度、各主题分布和输出路径；一条没选中时退出码为 1。

## 发布到插件市场

**先说现状**：DSH 截至 2026-10 没有官方插件市场。官方的插件市场索引格式（format 1）已经定稿，但市场是「用户自己添加索引 URL」的模式；社区里有两个聚合入口：`dsh-plugin-lab/market`（只收该组织自己的仓库，按 npm 关键字自动重建）和 `zhxmt-xm/awesome-dsh-plugin`（清单，PR 加链接）。所以「上架」的实际含义是：**把包发到 npm + 提供一个 format 1 的 index.json**，用户把索引 URL 填进 DSH 就能看到并安装。

本仓库已经准备好这些材料：

- `market/index.json`：format 1 索引，单条目，指向 npm 上的 `dsh-ai-trends-digest@1.0.0`
- `market/icons/dsh-ai-trends-digest.svg`：索引图标（相对路径，随索引一起托管）

### 步骤

1. **确认包名**（已查：npm 上 `dsh-ai-trends-digest` 未被占用）

   ```bash
   npm view dsh-ai-trends-digest version   # 404 = 可用
   ```

2. **登录并发布**

   ```bash
   npm login
   npm publish --access public
   ```

3. **建 GitHub 仓库并推送**

   ```bash
   git init
   git add .
   git commit -m "feat: initial release of dsh-ai-trends-digest"
   git branch -M main
   git remote add origin https://github.com/<你的账号>/dsh-ai-trends-digest.git
   git push -u origin main
   git tag v1.0.0 && git push origin v1.0.0
   ```

4. **托管索引**：把 `market/` 里的 `index.json` 与 `icons/` 放到 GitHub Pages 仓库根目录，得到 `https://<你的账号>.github.io/dsh-ai-trends-digest/index.json`。`market/index.json` 里的 `homepage`、`repository.url` 已填好。

5. **让用户添加索引**：DSH → 插件 → 自定义插件市场 → 添加索引源 → 粘贴上面的 URL。之后「发现」页就会出现 **AI 趋势日报**，点安装即可。

6. **可选：进社区清单**：给 `zhxmt-xm/awesome-dsh-plugin` 提 PR 加一行链接。

发布凭据（npm token、GitHub 账号）需要你自己提供；本仓库不会也不能替你登录。

## 目录结构

```text
dsh-ai-trends-digest/
├─ index.js            # 插件入口，注册 ai_trends_digest 工具
├─ core.js             # 抓取 / 解析 / 去重 / 打分 / 渲染 / 归档
├─ feeds.js            # 23 个默认源
├─ cordis.patch.yml    # 安装时插入的配置行
├─ locale/{en,zh}.json # 插件市场展示文案
├─ icon.svg            # 插件图标
├─ market/index.json   # format 1 市场索引（单条目）
├─ test/smoke.mjs      # 联网冒烟测试
└─ README.md / README.zh.md
```

## 已知限制

- 部分源会瞬断（CDN 502、超时）。运行时报告 `failed` 源并继续，不影响整份日报。
- 论文板块在周末可能为空，这是 arXiv 时间窗，不是 bug。
- 中文标题的错别字来自源站，插件不改写标题。

## License

MIT
