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
  heat_trend: { date: string; heat: number }[]
  user_growth: { date: string; followers: number }[]
  platform_share: { platform: string; followers: number }[]
  character_rank: { name: string; discussions: number; search_index: number; commercial_score: number; fan_growth: number; fanworks: number }[]
  sentiment: { positive: number; neutral: number; negative: number; keywords: string[]; risk_level: string; summary: string } | null
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
  edges: { source: string; target: string; relation: string; note: string }[]
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
  fetchJSON<{ character: CharacterRow; trend: any[] }>(`/ip/characters/${characterId}/trend?days=${days}`)
export const getRelations = (ipId: number) => fetchJSON<RelationGraph>(`/ip/${ipId}/relations`)
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
}

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
export interface CommunityFeedback { id: number; platform: string; user_name: string; content: string; sentiment: string; role_type: string; date: string }
export interface CommunityEvent { id: number; date: string; title: string; level: string; action: string }
export interface UserPersona { id: number; type: string; pct: number; description: string; action: string }

export const communityApi = {
  listFeedback: () => fetchJSON<{data:CommunityFeedback[]}>('/community/feedback'),
  createFeedback: (body: Partial<CommunityFeedback>) => fetchJSON<{id:number}>(`/community/feedback`, { method:'POST', body:JSON.stringify(body) }),
  deleteFeedback: (id: number) => fetchJSON<{message:string}>(`/community/feedback/${id}`, { method:'DELETE' }),
  listEvents: () => fetchJSON<{data:CommunityEvent[]}>('/community/events'),
  createEvent: (body: Partial<CommunityEvent>) => fetchJSON<{id:number}>(`/community/events`, { method:'POST', body:JSON.stringify(body) }),
  deleteEvent: (id: number) => fetchJSON<{message:string}>(`/community/events/${id}`, { method:'DELETE' }),
  listPersonas: () => fetchJSON<{data:UserPersona[]}>('/community/personas'),
  updatePersona: (id: number, body: Partial<UserPersona>) => fetchJSON<{message:string}>(`/community/personas/${id}`, { method:'PUT', body:JSON.stringify(body) }),
}

// ==================== 风险预警 ====================
export interface RiskAlert {
  level: 'red' | 'yellow'
  type: string
  title: string
  detail: string
  count: number
  link?: string
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
  listFeed: (params?: {date?:string; keyword?:string; category?:string; min_score?:number}) => {
    const q = new URLSearchParams()
    if (params?.date) q.set('date', params.date)
    if (params?.keyword) q.set('keyword', params.keyword)
    if (params?.category) q.set('category', params.category)
    if (params?.min_score) q.set('min_score', String(params.min_score))
    return fetchJSON<{data:NewsFeedItem[];total:number}>(`/news/feed?${q.toString()}`)
  },
  deleteFeed: (id: number) => fetchJSON<{message:string}>(`/news/feed/${id}`, { method:'DELETE' }),
}
