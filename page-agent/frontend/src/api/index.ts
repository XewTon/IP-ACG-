const API = '/api'

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('auth_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const headers = { 'Content-Type': 'application/json', ...authHeaders(), ...(options?.headers || {}) }
  const res = await fetch(`${API}${url}`, { ...options, headers })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

// ==================== 玄策决策闭环 ====================

export interface CockpitSummary {
  ip: { id: number; name: string; name_en: string; type: string }
  kpis: { ip_count: number; user_scale: number; today_heat: number; activity_count: number; character_count: number }
  health: { heat: number; activity: number; commercial: number; sentiment: number }
  /** 健康四维计算依据：computed=false 表示明细缺失回退 ips 静态列 */
  health_basis: Record<string, { computed: boolean; inputs: Record<string, number | string> }>
  /** 讨论量数据状态：真实采集(crawler) vs 演示种子(seed) */
  discussion_status: {
    crawler_chars: number
    crawler_days: number
    has_real: boolean
    sync_hint: string
  }
  heat_trend: { date: string; heat: number }[]
  user_growth: { date: string; followers: number }[]
  platform_share: { platform: string; followers: number }[]
  character_rank: { name: string; discussions: number; search_index: number; commercial_score: number; fan_growth: number; fanworks: number }[]
  sentiment: { positive: number; neutral: number; negative: number; keywords: string[]; risk_level: string; summary: string } | null
  /** 数据血缘字典：来源表 → 采集方式 → 计算口径 → 更新频率 → 状态 */
  meta: {
    updated_at: string
    kpis: { key: string; label: string; source: string; collect: string; calc: string; freq: string; status: string }[]
    health: { key: string; label: string; source: string; collect: string; calc: string; freq: string; status: string }[]
    heat_trend: { source: string; collect: string; calc: string; freq: string; status: string }
    user_growth: { source: string; collect: string; calc: string; freq: string; status: string }
    platform_share: { source: string; collect: string; calc: string; freq: string; status: string }
    character_rank: { source: string; collect: string; calc: string; freq: string; status: string }
    sentiment: { source: string; collect: string; calc: string; freq: string; status: string }
    risk: { source: string; collect: string; calc: string; freq: string; status: string }
    plan: { source: string; collect: string; calc: string; freq: string; status: string }
  }
}

export interface CharacterRow {
  id: number
  name: string
  role: string
  tag: string
  keywords: string
  description: string
  assets: string
  commercial_value: number
  search_index?: number
  discussions?: number
  fan_growth?: number
  fanworks?: number
  commercial_avg?: number
  discussion_change_pct?: number
}

export interface IpAssetsPayload {
  ip: {
    id: number; name: string; name_en: string; type: string; launch_date: string
    target_users: string; commercial_score: number; description: string
  }
  characters: (CharacterRow & { versions: { version: string; date: string; description: string }[] })[]
  lore: { date_label: string; event: string }[]
  rules: { category: string; items: string[] }[]
}

export interface RelationGraph {
  nodes: { id: string; name: string; category: number }[]
  edges: { id?: number; source: string; target: string; relation: string; note: string }[]
  categories: { name: string }[]
}

export interface OpsScenario { id: string; label: string; prompt: string }

export interface OpsAnalyzeResult {
  mode: string
  title: string
  summary: string
  metrics: { label: string; value: string | number }[]
  reasons: string[]
  suggestions: string[]
  knowledge_hits: string[]
  markdown: string
}

export interface IpSummary { id: number; name: string; name_en?: string; type?: string; launch_date?: string; target_users?: string }

export const getCockpitSummary = () => fetchJSON<CockpitSummary>('/cockpit/summary')
export const getIpList = () => fetchJSON<{ data: IpSummary[] }>('/ip/list')
export const getCurrentIpAssets = () => fetchJSON<IpAssetsPayload>('/current-ip/assets')
export const getIpAssets = (ipId: number) => fetchJSON<IpAssetsPayload>(`/ip/${ipId}/assets`)
export const getCharacters = (ipId: number) => fetchJSON<{ data: CharacterRow[] }>(`/ip/${ipId}/characters`)
export const createCharacter = (ipId: number, body: Record<string,string>) =>
  fetchJSON<{id:number;message:string}>(`/ip/${ipId}/characters`, { method:'POST', body:JSON.stringify(body) })
export const updateCharacter = (cid: number, body: Record<string,string|null>) =>
  fetchJSON<{message:string}>(`/ip/characters/${cid}`, { method:'PUT', body:JSON.stringify(body) })
export const deleteCharacter = (cid: number) =>
  fetchJSON<{message:string}>(`/ip/characters/${cid}`, { method:'DELETE' })
export const getCharacterTrend = (characterId: number, days = 30) =>
  fetchJSON<{ character: CharacterRow; trend: TrendPoint[] }>(`/ip/characters/${characterId}/trend?days=${days}`)
export interface TrendPoint {
  date: string
  search_index: number
  discussions: number
  fan_growth: number
  fanworks: number
  commercial_score: number
}
/** 新增/修改某一天指标（角色分析编辑模式） */
export const upsertTrend = (characterId: number, point: Partial<TrendPoint>) =>
  fetchJSON<{ message: string }>(`/ip/characters/${characterId}/trend`, { method: 'POST', body: JSON.stringify(point) })
export const deleteTrend = (characterId: number, date: string) =>
  fetchJSON<{ message: string }>(`/ip/characters/${characterId}/trend/${date}`, { method: 'DELETE' })
export const getRelations = (ipId: number) => fetchJSON<RelationGraph>(`/ip/${ipId}/relations`)
/** 新增关系边（角色分析图谱编辑模式） */
export const createRelation = (ipId: number, body: { from_character_id: number; to_character_id?: number; from_label?: string; to_label?: string; relation_type: string; note?: string }) =>
  fetchJSON<{ id: number; message: string }>(`/ip/${ipId}/relations`, { method: 'POST', body: JSON.stringify(body) })
export const deleteRelation = (relationId: number) =>
  fetchJSON<{ message: string }>(`/ip/relations/${relationId}`, { method: 'DELETE' })
export const getOpsScenarios = () => fetchJSON<{ data: OpsScenario[] }>('/ops-agent/scenarios')
export const analyzeOps = (query: string, scenario?: string) =>
  fetchJSON<OpsAnalyzeResult>('/ops-agent/analyze', {
    method: 'POST',
    body: JSON.stringify({ query, scenario }),
  })

// ==================== Postiz 发布调度层 ====================

export interface PostizIntegration {
  id: string; platform: string; name: string; connected: boolean
}

export interface ContentItem {
  id: number; platform: string; postizChannelId: string
  title: string; body: string; mediaUrls: string[]
  scheduledAt: string
  status: 'draft' | 'pending_review' | 'approved' | 'scheduled' | 'published' | 'failed'
  reviewerNote?: string; reviewedBy?: string
  postizPostId?: string
  createdAt: string; updatedAt: string
}

export interface PostizListResponse {
  data: ContentItem[]; total: number
}

export const postizApi = {
  getIntegrations: () => fetchJSON<{ data: PostizIntegration[]; total: number }>('/postiz/integrations'),

  createPost: (body: Partial<ContentItem>) =>
    fetchJSON<ContentItem>('/postiz/posts', { method: 'POST', body: JSON.stringify(body) }),

  listPosts: (status?: string) =>
    fetchJSON<PostizListResponse>(`/postiz/posts${status ? `?status=${status}` : ''}`),

  reviewPost: (postId: number, action: 'approve' | 'reject', reviewedBy: string, reviewerNote?: string) =>
    fetchJSON<ContentItem>(`/postiz/posts/${postId}/review`, {
      method: 'PUT', body: JSON.stringify({ action, reviewedBy, reviewerNote }),
    }),

  publishToPostiz: (postId: number) =>
    fetchJSON<ContentItem>(`/postiz/posts/${postId}/publish`, { method: 'POST' }),

  deletePost: (postId: number) =>
    fetchJSON<{ deleted: boolean; id: number }>(`/postiz/posts/${postId}`, { method: 'DELETE' }),

  performance: () => fetchJSON<ContentPerformanceResponse>('/postiz/performance'),
}

// ==================== 内容表现（数据复盘，真实库表） ====================
export interface ContentPerformance {
  platform: string
  title: string
  content_type?: string
  published_at?: string
  reads_views: number
  interactions: number
  engagement: number
  trend: 'up' | 'flat'
}
export interface PlatformSummary { platform: string; cnt: number; views: number; ints: number }
export interface ContentPerformanceResponse { data: ContentPerformance[]; summary: PlatformSummary[] }

// ==================== 供应链 ====================
export interface Supplier { id: number; name: string; category: string; budget: string; mode: string; on_time: number; revisions: number; score: number; contact: string }
export interface SupplyTask { id: number; supplier_id: number; supplier_name?: string; task: string; deadline: string; status: string; overdue_days: number }

export const supplyApi = {
  listSuppliers: () => fetchJSON<{data:Supplier[]}>('/supply/suppliers'),
  createSupplier: (body: Partial<Supplier>) => fetchJSON<{id:number}>(`/supply/suppliers`, { method:'POST', body:JSON.stringify(body) }),
  updateSupplier: (id: number, body: Partial<Supplier>) => fetchJSON<{message:string}>(`/supply/suppliers/${id}`, { method:'PUT', body:JSON.stringify(body) }),
  deleteSupplier: (id: number) => fetchJSON<{message:string}>(`/supply/suppliers/${id}`, { method:'DELETE' }),
  listTasks: () => fetchJSON<{data:SupplyTask[]}>('/supply/tasks'),
  createTask: (body: Partial<SupplyTask>) => fetchJSON<{id:number}>(`/supply/tasks`, { method:'POST', body:JSON.stringify(body) }),
  updateTask: (id: number, body: Partial<SupplyTask>) => fetchJSON<{message:string}>(`/supply/tasks/${id}`, { method:'PUT', body:JSON.stringify(body) }),
  deleteTask: (id: number) => fetchJSON<{message:string}>(`/supply/tasks/${id}`, { method:'DELETE' }),
}

// ==================== 社区 ====================
export interface CommunityFeedback { id: number; platform: string; user_name: string; content: string; sentiment: string; role_type: string; date: string; source?: string; crawled_at?: string }
export interface CommunityEvent { id: number; date: string; title: string; level: string; action: string }
export interface UserPersona { id: number; type: string; pct: number; description: string; action: string }

export const communityApi = {
  listFeedback: (params?: { platform?: string; sentiment?: string; role_type?: string; limit?: number; offset?: number }) => {
    const q = new URLSearchParams()
    if (params?.platform) q.set('platform', params.platform)
    if (params?.sentiment) q.set('sentiment', params.sentiment)
    if (params?.role_type) q.set('role_type', params.role_type)
    if (params?.limit != null) q.set('limit', String(params.limit))
    if (params?.offset != null) q.set('offset', String(params.offset))
    const qs = q.toString()
    return fetchJSON<{ data: CommunityFeedback[]; total: number }>(`/community/feedback${qs ? `?${qs}` : ''}`)
  },
  feedbackStats: () => fetchJSON<{ total: number; platform: Record<string, number>; sentiment: Record<string, number>; role_type: Record<string, number>; source_stats?: Record<string, number> }>('/community/feedback/stats'),
  createFeedback: (body: Partial<CommunityFeedback>) => fetchJSON<{id:number}>(`/community/feedback`, { method:'POST', body:JSON.stringify(body) }),
  deleteFeedback: (id: number) => fetchJSON<{message:string}>(`/community/feedback/${id}`, { method:'DELETE' }),
  listEvents: () => fetchJSON<{data:CommunityEvent[]}>('/community/events'),
  createEvent: (body: Partial<CommunityEvent>) => fetchJSON<{id:number}>(`/community/events`, { method:'POST', body:JSON.stringify(body) }),
  deleteEvent: (id: number) => fetchJSON<{message:string}>(`/community/events/${id}`, { method:'DELETE' }),
  listPersonas: () => fetchJSON<{data:UserPersona[]}>('/community/personas'),
  updatePersona: (id: number, body: Partial<UserPersona>) => fetchJSON<{message:string}>(`/community/personas/${id}`, { method:'PUT', body:JSON.stringify(body) }),
  syncCrawler: () => fetchJSON<{data:CommunityFeedback[];db_found:boolean;imported:number;per_platform?:Record<string,number>;message:string}>(`/community/sync-crawler`, { method:'POST' }),
  crawlerStatus: () => fetchJSON<{db_found:boolean;tables?:Record<string,number>;message?:string}>(`/community/crawler-status`),
  /** 真实讨论量同步：MediaCrawler 真实评论 → 角色日讨论量（逻辑闭环） */
  syncDiscussions: () => fetchJSON<{imported:number;matched:number;updated_days:number;updated_chars:number;sentiment?:string;message:string}>(`/community/sync-discussions`, { method:'POST' }),
}

// ==================== 风险预警 ====================
export interface RiskAlert {
  level: 'red' | 'yellow'
  type: string
  title: string
  detail: string
  count: number
  link?: string
  /** 解决方案建议（岗位要求：及时风险预警并有相应解决方案） */
  suggestion?: string
}

export const riskApi = {
  alerts: () => fetchJSON<{ data: RiskAlert[]; critical: string | null }>('/risk/alerts'),
}

// ==================== 客户需求 ====================
export interface Requirement {
  id: number
  client: string
  title: string
  description: string
  source: string
  priority: string
  deadline: string
  status: string
  linked_task_ids: number[]
  tasks: { id: number; task: string; status: string; overdue_days: number }[]
  task_count: number
  created_at: string
  updated_at: string
}

export const requirementApi = {
  list: () => fetchJSON<{ data: Requirement[] }>('/requirements'),
  create: (body: Partial<Requirement>) => fetchJSON<{ id: number; message: string }>('/requirements', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: number, body: Partial<Requirement>) => fetchJSON<{ message: string }>(`/requirements/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  setStatus: (id: number, status: string) => fetchJSON<{ message: string }>(`/requirements/${id}/status?status=${encodeURIComponent(status)}`, { method: 'PUT' }),
  link: (id: number, task_id: number, linked: boolean) =>
    fetchJSON<{ message: string; linked_task_ids: number[] }>(`/requirements/${id}/link`, { method: 'PUT', body: JSON.stringify({ task_id, linked }) }),
  remove: (id: number) => fetchJSON<{ message: string }>(`/requirements/${id}`, { method: 'DELETE' }),
}

// ==================== 项目统筹 ====================
export interface PlanningItem {
  id: string
  kind: 'content' | 'task' | 'req' | 'activity'
  group: string
  title: string
  start: string
  end: string
  status: string
  priority?: string
}

export const planningApi = {
  overview: () => fetchJSON<{ data: PlanningItem[] }>('/planning/overview'),
}

// ==================== 数据导出 ====================
export const exportSummaryUrl = () => `${API}/export/summary`

// ==================== 玄机科技知识库（真实公开数据） ====================

export interface XuanjiKpi {
  label: string; value: number | string; unit: string
  delta: string; delta_dir: 'up' | 'down' | ''; sub: string
}
export interface XuanjiOverview {
  kpis: XuanjiKpi[]
  revenue_trend: { year: number; revenue: number; net_profit: number }[]
  composition: { agency: number; self_ip: number }
  client_trend: { year: number; tencent: number; top5: number }[]
}

export interface XuanjiIp {
  id: number; name: string; stage: string; status: string; progress: string
  lifecycle: string; platform: string; commercial: string; tags: string
  heat: number; discussion: number; fanwork: number; pay_convert: number; reputation: number
}
export interface XuanjiStrategy {
  combo: string; mode: string; feasibility: string; effect: string; priority: string
}
export interface XuanjiIps {
  data: XuanjiIp[]
  radar_indicators: string[]
  strategies: XuanjiStrategy[]
}

export interface XuanjiTimeline { date_label: string; title: string; detail: string; level: string }
export interface XuanjiInquiry { no: string; topic: string; concern: string; reply: string }
export interface XuanjiShareholder { name: string; role: string; note: string }
export interface XuanjiIpo {
  timeline: XuanjiTimeline[]
  inquiry: XuanjiInquiry[]
  shareholders: XuanjiShareholder[]
}

export interface XuanjiFunnelItem { layer: string; name: string; value: number }
export interface XuanjiBiliIp { name: string; play_w10k: number; fanwork_w: number; danmaku: number }
export interface XuanjiBili { funnel: XuanjiFunnelItem[]; ips: XuanjiBiliIp[] }

export interface XuanjiKnowledgeItem { title: string; desc: string }
export interface XuanjiKnowledge { modules: { module: string; items: XuanjiKnowledgeItem[] }[] }

export interface XuanjiReport {
  id: number; date_label: string; headline: string; detail: string
  tags: string; tags_list: string[]
}
export interface XuanjiReports { data: XuanjiReport[] }

export interface XuanjiSupplyItem {
  id: number; category: string; name: string; cost: string; pricing: string
  channel: string; risk: string; note: string
}
export interface XuanjiRevenueTarget {
  source: string; current_pct: number; target_pct: number; path: string
}
export interface XuanjiSupply {
  items: XuanjiSupplyItem[]
  revenue_targets: XuanjiRevenueTarget[]
}

export const xuanjiApi = {
  overview: () => fetchJSON<XuanjiOverview>('/xuanji/overview'),
  ips: () => fetchJSON<XuanjiIps>('/xuanji/ips'),
  ipo: () => fetchJSON<XuanjiIpo>('/xuanji/ipo'),
  bili: () => fetchJSON<XuanjiBili>('/xuanji/bili'),
  knowledge: () => fetchJSON<XuanjiKnowledge>('/xuanji/knowledge'),
  reports: () => fetchJSON<XuanjiReports>('/xuanji/reports'),
  supply: () => fetchJSON<XuanjiSupply>('/xuanji/supply'),
}

// ==================== 数据导入中心（Plan C：全链路智能导入） ====================
export interface ImportTask {
  id: number
  name: string
  source_type: string
  target: string
  status: 'pending' | 'analyzing' | 'ready' | 'committing' | 'done' | 'failed' | 'rolled_back'
  total: number
  processed: number
  succeeded: number
  failed: number
  model: string
  payload: Record<string, any>[]
  errors: string[]
  created_at: string
  finished_at: string | null
}

export const importApi = {
  targets: () => fetchJSON<{ data: { key: string; fields: string[] }[] }>('/import/targets'),
  tasks: (limit = 50) => fetchJSON<{ data: ImportTask[] }>(`/import/tasks?limit=${limit}`),
  task: (id: number) => fetchJSON<ImportTask>(`/import/tasks/${id}`),
  upload: (file: File, target: string) => {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('target', target)
    return fetch(`${API}/import/upload`, { method: 'POST', body: fd, headers: authHeaders() }).then(async (r) => {
      if (!r.ok) throw new Error(await r.text())
      return r.json() as Promise<{ task_id: number; rows: number; target: string; model: string; message: string }>
    })
  },
  analyze: (id: number, useLlm = true) =>
    fetchJSON<{ task_id: number; status: string; total: number; message: string }>(`/import/tasks/${id}/analyze`, { method: 'POST', body: JSON.stringify({ use_llm: useLlm }) }),
  commit: (id: number, batchSize = 50) =>
    fetchJSON<{ task_id: number; status: string; inserted: number; skipped: number; message: string }>(`/import/tasks/${id}/commit`, { method: 'POST', body: JSON.stringify({ batch_size: batchSize }) }),
  rollback: (id: number) =>
    fetchJSON<{ task_id: number; deleted: number; message: string }>(`/import/tasks/${id}/rollback`, { method: 'POST' }),
  mediacrawler: (target = 'community_feedback') =>
    fetchJSON<{ task_id: number; scanned: number; inserted: number; skipped: number; model: string; message: string }>(`/import/mediacrawler?target=${target}`, { method: 'POST' }),
}

// ==================== 动态知识库（新闻抓取 + LLM分析） ====================
export interface NewsKeyword { id: number; keyword: string; category: string; enabled: number }
export interface NewsConfig { keywords: NewsKeyword[]; zhipu: { configured: boolean; model: string } }
export interface NewsFeedItem { id: number; fetch_date: string; keyword: string; category: string; title: string; url: string; summary: string; score: number; interview_value: string }

export const newsApi = {
  getConfig: () => fetchJSON<NewsConfig>('/news/config'),
  addKeyword: (keyword: string, category = 'ip') =>
    fetchJSON<{message:string}>(`/news/config`, { method:'POST', body:JSON.stringify({keyword, category, enabled:1}) }),
  deleteKeyword: (id: number) => fetchJSON<{message:string}>(`/news/config/${id}`, { method:'DELETE' }),
  saveZhipu: (apiKey: string, model: string) =>
    fetchJSON<{configured:boolean}>(`/news/zhipu`, { method:'POST', body:JSON.stringify({apiKey, model}) }),
  clearZhipu: () => fetchJSON<{configured:boolean}>(`/news/zhipu`, { method:'DELETE' }),
  fetchNow: (keyword?: string) => fetchJSON<{message:string;count:number}>(`/news/fetch${keyword?`?keyword=${encodeURIComponent(keyword)}`:''}`, { method:'POST' }),
  listFeed: (params?: {date?:string; keyword?:string; category?:string; min_score?:number; page?:number; page_size?:number}) => {
    const q = new URLSearchParams()
    if (params?.date) q.set('date', params.date)
    if (params?.keyword) q.set('keyword', params.keyword)
    if (params?.category) q.set('category', params.category)
    if (params?.min_score) q.set('min_score', String(params.min_score))
    if (params?.page) q.set('page', String(params.page))
    if (params?.page_size) q.set('page_size', String(params.page_size))
    return fetchJSON<{data:NewsFeedItem[];total:number;page:number;page_size:number;pages:number}>(`/news/feed?${q.toString()}`)
  },
  deleteFeed: (id: number) => fetchJSON<{message:string}>(`/news/feed/${id}`, { method:'DELETE' }),
}
