const API = '/api'

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${url}`, { headers: { 'Content-Type': 'application/json' }, ...options })
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

export const getCockpitSummary = () => fetchJSON<CockpitSummary>('/cockpit/summary')
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
