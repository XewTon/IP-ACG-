// 玄策 · 用户社区运营中心 —— 后端 CRUD + MediaCrawler 真实抓取同步
// 反馈池支持：平台 / 情感 / 角色类型 三维分类 Tab + 服务端分页（数据量大时避免一次全量渲染）
import { useCallback, useEffect, useMemo, useState } from 'react'
import { communityApi, type CommunityFeedback, type CommunityEvent, type UserPersona } from '../api'

const levelStyle:Record<string,{dot:string;bg:string}> = {green:{dot:'#6a8a6a',bg:'rgba(106,138,106,0.06)'},yellow:{dot:'#DA1E2B',bg:'rgba(218,30,43,0.06)'},red:{dot:'#9b2d30',bg:'rgba(155,45,48,0.06)'}}

const PAGE_SIZE = 15
const EVENT_SHOW = 20

const tabStyle = (active: boolean): React.CSSProperties => ({
  background: active ? 'rgba(218,30,43,0.12)' : 'transparent',
  color: active ? '#DA1E2B' : '#8a8578',
  border: 'none',
  fontSize: '0.625rem',
  cursor: 'pointer',
  padding: '3px 10px',
  borderRadius: 3,
  fontFamily: '"Noto Sans SC",sans-serif',
})

/** 页码列表（页数多时用省略号折叠） */
function pageList(cur: number, total: number): (number | string)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const set = new Set<number>([1, total, cur - 1, cur, cur + 1])
  const arr = [...set].filter(n => n >= 1 && n <= total).sort((a, b) => a - b)
  const out: (number | string)[] = []
  let prev = 0
  for (const n of arr) {
    if (n - prev > 1) out.push('…')
    out.push(n)
    prev = n
  }
  return out
}

interface TabOption { key: string; label: string; count?: number }

function FilterTabs({ label, options, value, onChange }: { label: string; options: TabOption[]; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
      <span style={{ fontSize: '0.625rem', color: '#6B6258', width: 44, flexShrink: 0 }}>{label}</span>
      {options.map(o => (
        <button key={o.key} onClick={() => onChange(o.key)} style={tabStyle(value === o.key)}>
          {o.label}{o.count != null ? `（${o.count}）` : ''}
        </button>
      ))}
    </div>
  )
}

export default function Community() {
  const [feedbacks, setFeedbacks] = useState<CommunityFeedback[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [platformFilter, setPlatformFilter] = useState('')
  const [sentFilter, setSentFilter] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [stats, setStats] = useState<{ total: number; platform: Record<string, number>; sentiment: Record<string, number>; role_type: Record<string, number>; source_stats?: Record<string, number> } | null>(null)
  const [events, setEvents] = useState<CommunityEvent[]>([])
  const [evExpand, setEvExpand] = useState(false)
  const [personas, setPersonas] = useState<UserPersona[]>([])
  const [showFb, setShowFb] = useState(false); const [showEv, setShowEv] = useState(false)
  const [fbForm, setFbForm] = useState({ platform:'B站', user_name:'', content:'', sentiment:'positive', role_type:'剧情党', date:'' })
  const [evForm, setEvForm] = useState({ title:'', level:'green', action:'', date:'' })
  const [syncMsg, setSyncMsg] = useState('')
  const [syncBusy, setSyncBusy] = useState(false)
  const [loadErr, setLoadErr] = useState('')

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const refreshFeedback = useCallback(async () => {
    try {
      const r = await communityApi.listFeedback({
        platform: platformFilter || undefined,
        sentiment: sentFilter || undefined,
        role_type: roleFilter || undefined,
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
      })
      setFeedbacks(r.data)
      setTotal(r.total)
      setLoadErr('')
    } catch (e: any) { setLoadErr('数据加载失败：' + String(e?.message || e)) }
  }, [platformFilter, sentFilter, roleFilter, page])

  const refreshStats = useCallback(async () => {
    try { setStats(await communityApi.feedbackStats()) } catch { /* 后端未启动时保持为空，不阻断页面 */ }
  }, [])

  const refresh = useCallback(async () => {
    await Promise.all([refreshFeedback(), refreshStats()])
  }, [refreshFeedback, refreshStats])

  useEffect(() => { refreshFeedback() }, [refreshFeedback])

  useEffect(() => {
    refreshStats()
    communityApi.crawlerStatus().then((s)=>{ if(!s.db_found) setSyncMsg('MediaCrawler 抓取库尚未运行 —— 在「数据采集」页抓取后，点「同步抓取数据」汇入真实社区反馈') }).catch(()=>{})
  }, [refreshStats])

  // 删除数据后总页数可能缩小，自动回退到最后一页
  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [total, page, totalPages])

  const changeFilter = (setter: (v: string) => void) => (v: string) => { setter(v); setPage(1) }

  const syncCrawler = async () => {
    setSyncBusy(true); setSyncMsg('同步中...')
    try {
      const r = await communityApi.syncCrawler()
      const per = r.per_platform ? `（${Object.entries(r.per_platform).map(([k,v])=>`${k}×${v}`).join(' / ')}）` : ''
      setSyncMsg(r.message + per)
      refresh()
    } catch (e: any) { setSyncMsg('同步失败: ' + String(e.message || e)) }
    setSyncBusy(false)
  }

  const addFeedback = async () => { try { await communityApi.createFeedback(fbForm); setShowFb(false); setFbForm({ platform:'B站',user_name:'',content:'',sentiment:'positive',role_type:'剧情党',date:'' }); refresh() } catch (e: any) { alert('添加失败：' + String(e?.message || e)) } }
  const addEvent = async () => { try { await communityApi.createEvent(evForm); setShowEv(false); setEvForm({ title:'',level:'green',action:'',date:'' }); refresh() } catch (e: any) { alert('添加失败：' + String(e?.message || e)) } }
  const delFb = async (id:number) => { if(confirm('删除?')){ try { await communityApi.deleteFeedback(id); refresh() } catch (e: any) { alert('删除失败：' + String(e?.message || e)) } } }
  const delEv = async (id:number) => { if(confirm('删除?')){ try { await communityApi.deleteEvent(id); refresh() } catch (e: any) { alert('删除失败：' + String(e?.message || e)) } } }
  const savePersona = async (p:UserPersona) => { try { await communityApi.updatePersona(p.id, p); refresh() } catch (e: any) { alert('保存失败：' + String(e?.message || e)) } }

  const inputStyle:React.CSSProperties = { background:'#FFFFFF',border:'1px solid rgba(218,30,43,0.15)',color:'#2A2E37',padding:'7px 10px',fontSize:'0.75rem',fontFamily:'"Noto Sans SC",sans-serif' }

  // 分类 Tab 选项（角标来自后端统计接口）
  const platformOptions = useMemo<TabOption[]>(() => {
    const keys = stats ? Object.keys(stats.platform) : []
    const order = ['B站', '微博', '小红书', '公众号', '抖音', '其他']
    const ordered = [...order.filter(k => keys.includes(k)), ...keys.filter(k => !order.includes(k))]
    return [
      { key: '', label: '全部', count: stats?.total ?? 0 },
      ...ordered.map(k => ({ key: k, label: k, count: stats!.platform[k] })),
    ]
  }, [stats])

  const sentimentOptions = useMemo<TabOption[]>(() => [
    { key: '', label: '全部', count: stats?.total ?? 0 },
    { key: 'positive', label: '正面', count: stats?.sentiment['positive'] ?? 0 },
    { key: 'neutral', label: '中立', count: stats?.sentiment['neutral'] ?? 0 },
    { key: 'negative', label: '负面', count: stats?.sentiment['negative'] ?? 0 },
  ], [stats])

  const roleOptions = useMemo<TabOption[]>(() => {
    const keys = stats ? Object.keys(stats.role_type) : []
    const order = ['剧情党', '角色党', '美术党', '收集党', '路人']
    const ordered = [...order.filter(k => keys.includes(k)), ...keys.filter(k => !order.includes(k))]
    return [
      { key: '', label: '全部', count: stats?.total ?? 0 },
      ...ordered.map(k => ({ key: k, label: k, count: stats!.role_type[k] })),
    ]
  }, [stats])

  const evVisible = evExpand ? events : events.slice(0, EVENT_SHOW)

  return (
    <div style={{maxWidth:900,margin:'0 auto',padding:'48px 32px'}}>
      <h2 className="xj-section-title" style={{padding:'0 0 6px',margin:0}}>用户社区运营中心</h2>
      <p style={{fontSize:'0.625rem',color:'#6B6258',margin:'0 0 28px'}}>反馈池 + 玩家画像 + 社区事件</p>

      {loadErr && <div style={{ fontSize:'0.75rem', color:'var(--xj-red)', marginBottom:12 }}>{loadErr}（请确认后端已启动）</div>}

      {/* 数据来源状态 */}
      {stats?.source_stats && (
        <div className="xj-panel" style={{ padding: '10px 16px', marginBottom: 20, display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '0.6875rem', color: '#DA1E2B', fontFamily: '"Noto Serif SC",serif' }}>反馈来源分布</span>
          {Object.entries(stats.source_stats).map(([k, v]) => (
            <span key={k} style={{ fontSize: '0.625rem', color: '#6B6258' }}>
              {k === 'crawler' ? '真实抓取' : k === 'import' ? '导入中心' : k === 'manual' ? '人工登记' : k}：<b style={{ color: '#2A2E37' }}>{v}</b>
            </span>
          ))}
          <span style={{ fontSize: '0.5625rem', color: '#8a8578' }}>共 {stats.total} 条</span>
        </div>
      )}

      {/* 玩家画像 */}
      <h3 style={{fontSize:'0.75rem',color:'#DA1E2B',marginBottom:12,fontFamily:'"Noto Serif SC",serif'}}>玩家画像</h3>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:28}}>
        {personas.map((p)=>(
          <div key={p.id} className="xj-panel" style={{padding:16}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
              <span style={{fontSize:'0.8125rem',fontWeight:500,color:'#2A2E37'}}>{p.type}</span>
              <input type="number" value={p.pct} onChange={e=>{const np=personas.map(x=>x.id===p.id?{...x,pct:+e.target.value}:x);setPersonas(np)}}
                style={{width:48,textAlign:'center',...inputStyle,fontSize:'0.6875rem',padding:'2px 4px'}} />
            </div>
            <div style={{fontSize:'0.6875rem',color:'#8a8578',lineHeight:1.5,marginBottom:6}}>{p.description}</div>
            <div style={{fontSize:'0.625rem',color:'#6B6258',borderTop:'1px solid rgba(218,30,43,0.08)',paddingTop:6}}>→ {p.action}</div>
            <button onClick={()=>savePersona(p)} style={{background:'none',border:'none',color:'#DA1E2B',cursor:'pointer',fontSize:'0.5625rem',marginTop:6}}>保存</button>
          </div>
        ))}
      </div>

      {/* 反馈池 */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12,flexWrap:'wrap',gap:8}}>
        <h3 style={{fontSize:'0.75rem',color:'#DA1E2B',margin:0,fontFamily:'"Noto Serif SC",serif'}}>用户反馈池</h3>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <button onClick={syncCrawler} disabled={syncBusy} className="xj-btn" style={{padding:'5px 14px',fontSize:'0.625rem'}}>
            {syncBusy ? '同步中...' : '⇅ 同步抓取数据（MediaCrawler）'}
          </button>
          <button onClick={()=>setShowFb(true)} className="xj-btn" style={{padding:'5px 14px',fontSize:'0.625rem'}}>+ 手工登记</button>
        </div>
      </div>
      {syncMsg && <div style={{fontSize:'0.625rem',color:'#5b8c9e',marginBottom:8,lineHeight:1.6}}>{syncMsg}</div>}

      <div className="xj-panel" style={{marginBottom:28}}>
        {/* 三维分类筛选栏 */}
        <div style={{padding:'10px 18px 4px',borderBottom:'1px solid rgba(218,30,43,0.12)'}}>
          <FilterTabs label="平台" options={platformOptions} value={platformFilter} onChange={changeFilter(setPlatformFilter)} />
          <FilterTabs label="情感" options={sentimentOptions} value={sentFilter} onChange={changeFilter(setSentFilter)} />
          <FilterTabs label="人群" options={roleOptions} value={roleFilter} onChange={changeFilter(setRoleFilter)} />
        </div>

        <div style={{display:'grid',gridTemplateColumns:'50px 60px 1fr 50px 30px',padding:'8px 18px',borderBottom:'1px solid rgba(218,30,43,0.12)',fontSize:'0.625rem',color:'#6B6258'}}><span>平台</span><span>用户</span><span>反馈</span><span>情感</span><span/></div>
        {feedbacks.map((f)=>(
          <div key={f.id} className="xj-row" style={{padding:'0 18px'}}>
            <span style={{fontSize:'0.6875rem',color:'#8a8578',width:50,flexShrink:0}}>{f.platform}</span>
            <span style={{fontSize:'0.75rem',color:'#2A2E37',width:60,flexShrink:0}}>{f.user_name}</span>
            <span style={{fontSize:'0.75rem',color:'#8a8578',flex:1,paddingRight:12}}>
              {f.source === 'crawler' && <span style={{fontSize:'0.5625rem',color:'#5b8c9e',border:'1px solid rgba(91,140,158,0.4)',padding:'0 5px',borderRadius:3,marginRight:6}}>抓取</span>}
              "{f.content}"
            </span>
            <span style={{fontSize:'0.6875rem',color:f.sentiment==='positive'?'#6a8a6a':f.sentiment==='negative'?'#c9a96e':'#8a8578',width:50,flexShrink:0,textAlign:'right'}}>{f.sentiment==='positive'?'喜欢':f.sentiment==='negative'?'负面':'中立'}</span>
            <button onClick={()=>delFb(f.id)} style={{background:'none',border:'none',color:'#6B6258',cursor:'pointer',fontSize:'0.625rem'}}>×</button>
          </div>
        ))}
        {!feedbacks.length && (
          <div style={{padding:'28px 18px',textAlign:'center',fontSize:'0.6875rem',color:'#8a8578'}}>
            {total === 0 ? '暂无反馈数据 —— 可手工登记或同步 MediaCrawler 抓取数据' : '当前分类下暂无数据'}
          </div>
        )}

        {/* 分页 */}
        {total > PAGE_SIZE && (
          <div style={{display:'flex',alignItems:'center',justifyContent:'flex-end',gap:6,padding:'10px 18px'}}>
            <span style={{fontSize:'0.625rem',color:'#6B6258',marginRight:6}}>共 {total} 条 · 第 {page}/{totalPages} 页</span>
            <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page<=1} style={pageBtnStyle(page<=1)}>上一页</button>
            {pageList(page, totalPages).map((n,i)=> typeof n === 'number' ? (
              <button key={i} onClick={()=>setPage(n)} style={{...pageBtnStyle(false), ...(n===page?{background:'rgba(218,30,43,0.12)',color:'#DA1E2B'}:{})}}>{n}</button>
            ) : <span key={i} style={{fontSize:'0.625rem',color:'#8a8578',padding:'0 2px'}}>{n}</span>)}
            <button onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page>=totalPages} style={pageBtnStyle(page>=totalPages)}>下一页</button>
          </div>
        )}
      </div>

      {/* 社区事件 */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
        <h3 style={{fontSize:'0.75rem',color:'#DA1E2B',margin:0,fontFamily:'"Noto Serif SC",serif'}}>社区事件日志</h3>
        <button onClick={()=>setShowEv(true)} className="xj-btn" style={{padding:'5px 14px',fontSize:'0.625rem'}}>+ 添加事件</button>
      </div>
      <div className="xj-panel">
        {evVisible.map((e)=>(
          <div key={e.id} style={{display:'flex',alignItems:'center',padding:'12px 20px',gap:14,borderBottom:'1px solid rgba(218,30,43,0.06)',background:levelStyle[e.level].bg}}>
            <span style={{width:6,height:6,borderRadius:'50%',background:levelStyle[e.level].dot,flexShrink:0}} />
            <span style={{fontSize:'0.6875rem',color:'#6B6258',width:50}}>{e.date}</span>
            <span style={{fontSize:'0.75rem',color:'#2A2E37',flex:1}}>{e.title}</span>
            <span style={{fontSize:'0.6875rem',color:'#8a8578'}}>{e.action}</span>
            <button onClick={()=>delEv(e.id)} style={{background:'none',border:'none',color:'#6B6258',cursor:'pointer',fontSize:'0.625rem'}}>×</button>
          </div>
        ))}
        {!events.length && <div style={{padding:'24px 20px',textAlign:'center',fontSize:'0.6875rem',color:'#8a8578'}}>暂无社区事件</div>}
        {events.length > EVENT_SHOW && (
          <button onClick={()=>setEvExpand(v=>!v)} style={{background:'none',border:'none',color:'#DA1E2B',cursor:'pointer',fontSize:'0.625rem',padding:'10px 20px'}}>
            {evExpand ? '收起' : `展开全部 ${events.length} 条`}
          </button>
        )}
      </div>

      {/* 反馈 Modal */}
      {showFb&&(
        <div style={{position:'fixed',inset:0,background:'rgba(28,30,38,0.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:100}} onClick={()=>setShowFb(false)}>
          <div className="xj-panel" style={{padding:'28px 32px',maxWidth:420,width:'90%'}} onClick={e=>e.stopPropagation()}>
            <h3 style={{fontSize:'0.9375rem',color:'#DA1E2B',margin:'0 0 16px',fontFamily:'"Noto Serif SC",serif'}}>添加反馈</h3>
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              <select value={fbForm.platform} onChange={e=>setFbForm({...fbForm,platform:e.target.value})} style={inputStyle}>
                {['B站','微博','小红书','公众号'].map(s=><option key={s} value={s}>{s}</option>)}
              </select>
              <input placeholder="用户名" value={fbForm.user_name} onChange={e=>setFbForm({...fbForm,user_name:e.target.value})} style={inputStyle} />
              <input placeholder="反馈内容" value={fbForm.content} onChange={e=>setFbForm({...fbForm,content:e.target.value})} style={inputStyle} />
              <select value={fbForm.sentiment} onChange={e=>setFbForm({...fbForm,sentiment:e.target.value})} style={inputStyle}>
                <option value="positive">正面</option><option value="neutral">中立</option><option value="negative">负面</option>
              </select>
              <select value={fbForm.role_type} onChange={e=>setFbForm({...fbForm,role_type:e.target.value})} style={inputStyle}>
                {['剧情党','角色党','美术党','收集党'].map(s=><option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div style={{display:'flex',gap:10,marginTop:16,justifyContent:'flex-end'}}>
              <button onClick={()=>setShowFb(false)} style={{background:'transparent',color:'#8a8578',border:'1px solid rgba(218,30,43,0.2)',padding:'8px 20px',fontSize:'0.75rem',cursor:'pointer'}}>取消</button>
              <button className="xj-btn" style={{padding:'8px 24px',fontSize:'0.75rem'}} onClick={addFeedback}>添加</button>
            </div>
          </div>
        </div>
      )}

      {/* 事件 Modal */}
      {showEv&&(
        <div style={{position:'fixed',inset:0,background:'rgba(28,30,38,0.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:100}} onClick={()=>setShowEv(false)}>
          <div className="xj-panel" style={{padding:'28px 32px',maxWidth:420,width:'90%'}} onClick={e=>e.stopPropagation()}>
            <h3 style={{fontSize:'0.9375rem',color:'#DA1E2B',margin:'0 0 16px',fontFamily:'"Noto Serif SC",serif'}}>添加事件</h3>
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              <input placeholder="事件标题" value={evForm.title} onChange={e=>setEvForm({...evForm,title:e.target.value})} style={inputStyle} />
              <input placeholder="日期" value={evForm.date} onChange={e=>setEvForm({...evForm,date:e.target.value})} style={inputStyle} />
              <select value={evForm.level} onChange={e=>setEvForm({...evForm,level:e.target.value})} style={inputStyle}>
                <option value="green">🟢 正常</option><option value="yellow">🟡 关注</option><option value="red">🔴 高风险</option>
              </select>
              <input placeholder="处理措施" value={evForm.action} onChange={e=>setEvForm({...evForm,action:e.target.value})} style={inputStyle} />
            </div>
            <div style={{display:'flex',gap:10,marginTop:16,justifyContent:'flex-end'}}>
              <button onClick={()=>setShowEv(false)} style={{background:'transparent',color:'#8a8578',border:'1px solid rgba(218,30,43,0.2)',padding:'8px 20px',fontSize:'0.75rem',cursor:'pointer'}}>取消</button>
              <button className="xj-btn" style={{padding:'8px 24px',fontSize:'0.75rem'}} onClick={addEvent}>添加</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const pageBtnStyle = (disabled: boolean): React.CSSProperties => ({
  background: 'transparent',
  border: '1px solid rgba(218,30,43,0.15)',
  color: disabled ? '#c9c4b8' : '#6B6258',
  fontSize: '0.625rem',
  cursor: disabled ? 'default' : 'pointer',
  padding: '2px 8px',
  borderRadius: 3,
  fontFamily: '"Noto Sans SC",sans-serif',
})
