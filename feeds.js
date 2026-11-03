/**
 * Default feed list for dsh-ai-trends-digest.
 *
 * weight: 1.0 is neutral. Higher means the source carries more signal for
 * embodied AI and large-model trends. lang only affects layout hints.
 *
 * Edit this list (or pass `feeds` in the plugin config) to tune coverage.
 * Every entry is a plain HTTP(S) URL returning RSS 2.0, Atom, or JSON Feed.
 */

export const DEFAULT_FEEDS = [
  // 中文 · 具身智能 / 大模型
  { name: '量子位', url: 'https://www.qbitai.com/feed', lang: 'zh', weight: 2.0 },
  { name: '新智元', url: 'https://aiera.com.cn/feed', lang: 'zh', weight: 1.8 },
  { name: '雷峰网', url: 'https://www.leiphone.com/feed', lang: 'zh', weight: 1.4 },
  { name: 'IT之家', url: 'https://www.ithome.com/rss/', lang: 'zh', weight: 1.0 },
  { name: '钛媒体', url: 'https://www.tmtpost.com/rss', lang: 'zh', weight: 1.0 },
  { name: 'InfoQ 中文', url: 'https://www.infoq.cn/feed', lang: 'zh', weight: 0.9 },
  { name: '爱范儿', url: 'https://www.ifanr.com/feed', lang: 'zh', weight: 1.0 },
  { name: '极客公园', url: 'https://www.geekpark.net/rss', lang: 'zh', weight: 1.0 },
  { name: 'Solidot', url: 'https://www.solidot.org/index.rss', lang: 'zh', weight: 0.8 },

  // 英文 · 大模型厂商与研究机构
  { name: 'OpenAI News', url: 'https://openai.com/news/rss.xml', lang: 'en', weight: 2.0 },
  { name: 'Google AI Blog', url: 'https://blog.google/technology/ai/rss/', lang: 'en', weight: 1.8 },
  {
    name: 'Google DeepMind Blog',
    url: 'https://deepmind.google/blog/rss.xml',
    lang: 'en',
    weight: 1.6,
    note: '备份线：Google AI Blog 抖动时仍有 DeepMind 观点',
  },
  { name: 'IEEE Spectrum · AI', url: 'https://spectrum.ieee.org/feeds/topic/artificial-intelligence.rss', lang: 'en', weight: 1.4 },
  { name: 'IEEE Spectrum · Robotics', url: 'https://spectrum.ieee.org/feeds/topic/robotics.rss', lang: 'en', weight: 1.4 },
  { name: 'TechCrunch AI', url: 'https://techcrunch.com/category/artificial-intelligence/feed/', lang: 'en', weight: 1.3 },
  { name: 'MIT Tech Review · AI', url: 'https://www.technologyreview.com/topic/artificial-intelligence/feed', lang: 'en', weight: 1.3 },
  { name: 'MarkTechPost', url: 'https://www.marktechpost.com/feed/', lang: 'en', weight: 1.0 },
  { name: 'The Decoder', url: 'https://the-decoder.com/feed/', lang: 'en', weight: 0.9 },
  { name: 'NVIDIA Blog', url: 'https://blogs.nvidia.com/feed/', lang: 'en', weight: 1.0 },
  { name: 'The Verge · AI', url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml', lang: 'en', weight: 0.8 },

  // 论文与开源
  { name: 'BAIR Blog', url: 'https://bair.berkeley.edu/blog/feed.xml', lang: 'en', weight: 1.0 },
  {
    name: 'Microsoft Research',
    url: 'https://www.microsoft.com/en-us/research/feed/',
    lang: 'en',
    weight: 0.9,
  },
  {
    name: 'arXiv cs.RO',
    url: 'https://export.arxiv.org/api/query?search_query=cat:cs.RO&sortBy=submittedDate&sortOrder=descending&max_results=12',
    lang: 'en',
    weight: 0.8,
    note: 'arXiv 官方 RSS 已失效，改用 Atom API',
  },
];

export const RESEARCH_SOURCES = new Set(['arXiv cs.RO', 'BAIR Blog', 'Microsoft Research']);
