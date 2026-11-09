/**
 * dsh-ai-trends-digest · Host plugin
 *
 * Exposes one model-facing tool, `ai_trends_digest`, that builds a daily
 * digest of embodied-AI and large-model trends from RSS/Atom feeds and writes
 * Markdown/HTML archives next to the DSH profile or to a configured directory.
 */

import { defineTool } from '@deepseek-ai/dsh-tools';
import { buildDigest, DEFAULT_OPTIONS, resolveOutputDir } from './core.js';
import { DEFAULT_FEEDS } from './feeds.js';

export const name = 'ai-trends-digest';

/** Services this plugin needs before it can register its tool. */
export const inject = ['tools'];

function makeLogger(ctx) {
  return (line) => {
    try {
      if (typeof ctx.logger === 'function') ctx.logger('ai-trends-digest').info(String(line));
      else console.error(`[ai-trends-digest] ${line}`);
    } catch {
      // logging must never break a digest run
    }
  };
}

/**
 * @param {object} config Row config from `cordis.patch.yml`.
 */
export function apply(ctx, config = {}) {
  const settings = {
    ...DEFAULT_OPTIONS,
    ...config,
    topicFloors: { ...DEFAULT_OPTIONS.topicFloors, ...(config.topicFloors || {}) },
    feeds: Array.isArray(config.feeds) && config.feeds.length > 0 ? config.feeds : DEFAULT_FEEDS,
  };
  const logger = makeLogger(ctx);

  ctx.tools.register(
    defineTool({
      name: 'ai_trends_digest',
      description:
        'Build today\'s embodied-AI and large-model trend digest from configured RSS/Atom feeds. Fetches ~23 sources (30-60s), dedupes and ranks items, then writes <output_dir>/<date>.md, <date>.html, latest.md, latest.html, data/<date>.json and index.html. Use it when the user asks for today\'s AI/robotics news, a trend roundup, or a scheduled daily brief. Set output_dir to choose the archive folder; the default is ~/.dsh/ai-trends-digest.',
      parameters: {
        date: {
          type: 'string',
          description: 'Archive label in YYYY-MM-DD. Defaults to today in the configured timezone.',
        },
        window_hours: {
          type: 'integer',
          description: 'Only keep items published within this many hours. Defaults to the configured windowHours (42).',
        },
        max_items: {
          type: 'integer',
          description: 'Maximum number of selected items. Defaults to the configured maxItems (20).',
        },
        output_dir: {
          type: 'string',
          description: 'Absolute directory for archives. Defaults to the plugin config or ~/.dsh/ai-trends-digest.',
        },
        min_score: {
          type: 'number',
          description: 'Minimum item score. Defaults to the configured minScore (4.5).',
        },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            date: { type: 'string', required: true },
            markdownPath: { type: 'string', required: true },
            htmlPath: { type: 'string', required: true },
            mobileTextPath: { type: 'string', required: true },
            items: { type: 'integer', required: true },
            sourcesOk: { type: 'integer', required: true },
            sourcesTotal: { type: 'integer', required: true },
            failed: { type: 'array', items: { type: 'string' }, required: true },
            top: {
              type: 'array',
              required: true,
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  title: { type: 'string', required: true },
                  source: { type: 'string', required: true },
                  link: { type: 'string', required: true },
                },
              },
            },
          },
        },
        render: (_args, value) => [
          {
            type: 'text',
            text: [
              `AI 趋势日报 ${value.date}：${value.items} 条 · ${value.sourcesOk}/${value.sourcesTotal} 源可用`,
              ...value.top.map((item, index) => `${index + 1}. ${item.title} — ${item.source}`),
              `文件：${value.markdownPath}`,
              value.failed.length ? `失败源：${value.failed.join('、')}` : '',
            ].filter(Boolean).join('\n'),
          },
        ],
      },
      async execute(args, exec) {
        const options = {
          windowHours: args.window_hours ?? settings.windowHours,
          maxItems: args.max_items ?? settings.maxItems,
          minScore: args.min_score ?? settings.minScore,
          maxPerSource: settings.maxPerSource,
          topNewsCount: settings.topNewsCount,
          topicFloors: settings.topicFloors,
          keepDays: settings.keepDays,
          timezone: settings.timezone,
          outputDir: args.output_dir || settings.outputDir || resolveOutputDir(settings),
          date: args.date && /^\d{4}-\d{2}-\d{2}$/.test(args.date) ? args.date : undefined,
        };

        const { doc, paths } = await buildDigest({
          feeds: settings.feeds,
          options,
          logger,
        });

        return {
          date: doc.date,
          markdownPath: paths.mdPath,
          htmlPath: paths.htmlPath,
          mobileTextPath: paths.mobileTextPath,
          items: doc.stats.items,
          sourcesOk: doc.stats.sourcesOk,
          sourcesTotal: doc.stats.sourcesTotal,
          failed: doc.stats.failed,
          top: doc.topNews.map((item) => ({
            title: item.title,
            source: item.source,
            link: item.link,
          })),
        };
      },
    }),
  );
}
