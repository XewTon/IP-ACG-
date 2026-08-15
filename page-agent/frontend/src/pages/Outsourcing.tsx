// 玄策 · 供应链协同中心 —— 后端 CRUD + react-trello 任务看板 + 客户需求单
import { useEffect, useMemo, useState } from 'react'
import Board from 'react-trello'
import { supplyApi, requirementApi, type Supplier, type SupplyTask, type Requirement } from '../api'

export default function Outsourcing() {
  const [tab, setTab] = useState<'board' | 'req'>('board')
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [tasks, setTasks] = useState<SupplyTask[]>([])
  const [reqs, setReqs] = useState<Requirement[]>([])
  const [aiBrief,setAiBrief]=useState(''); const [briefResult,setBriefResult]=useState('')
  const [showSup, setShowSup] = useState(false); const [showTask, setShowTask] = useState(false)
  const [showReq, setShowReq] = useState(false)
  const [pendingReqId, setPendingReqId] = useState<number | null>(null)
  const [sForm, setSForm] = useState({ name:'', category:'', budget:'', mode:'', on_time:90, revisions:1.5, score:4.0, contact:'' })
  const [tForm, setTForm] = useState({ supplier_id:0, task:'', deadline:'', status:'待派单', overdue_days:0 })
  const [rForm, setRForm] = useState({ client:'', title:'', description:'', source:'', priority:'中', deadline:'' })

  const refetch = async () => {
    Promise.all([supplyApi.listSuppliers(), supplyApi.listTasks(), requirementApi.list()]).then(([s,t,r]) => { setSuppliers(s.data); setTasks(t.data); setReqs(r.data) })
  }
  useEffect(() => { refetch() }, [])

  const addSupplier = async () => { await supplyApi.createSupplier(sForm); setShowSup(false); setSForm({ name:'',category:'',budget:'',mode:'',on_time:90,revisions:1.5,score:4.0,contact:'' }); refetch() }
  const addTask = async () => { const r = await supplyApi.createTask(tForm); if (pendingReqId) { await requirementApi.link(pendingReqId, r.id, true); setPendingReqId(null) } setShowTask(false); setTForm({ supplier_id:0,task:'',deadline:'',status:'待派单',overdue_days:0 }); refetch() }
  const addRequirement = async () => { await requirementApi.create(rForm); setShowReq(false); setRForm({ client:'',title:'',description:'',source:'',priority:'中',deadline:'' }); refetch() }
  const delSupplier = async (id:number) => { if(confirm('删除?')){ await supplyApi.deleteSupplier(id); refetch() } }
  const delTask = async (id:number) => { if(confirm('删除?')){ await supplyApi.deleteTask(id); refetch() } }
  const genBrief=async()=>{ setBriefResult('生成中...'); try{const r=await window.fetch('/api/agent/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:`为玄策IP生成一份外包需求文档：${aiBrief}`})});const d=await r.json();setBriefResult(d.reply)}catch{setBriefResult('生成失败')} }

  // 看板：状态 → 泳道
  const LANES = [
    { id: 'todo', title: '待派单', statuses: ['待派单'] },
    { id: 'doing', title: '制作中', statuses: ['进行中', '初稿提交', '修改中'] },
    { id: 'review', title: '待验收', statuses: ['内部反馈', '待验收'] },
    { id: 'done', title: '已验收', statuses: ['已验收'] },
    { id: 'overdue', title: '逾期', statuses: ['逾期'] },
  ]
  const laneOf = (t: SupplyTask) =>
    t.overdue_days > 0 || t.status === '逾期' ? 'overdue' : (LANES.find((l) => l.statuses.includes(t.status))?.id ?? 'todo')
  const statusOf = (laneId: string) =>
    LANES.find((l) => l.id === laneId)?.statuses[0] ?? '待派单'

  const boardData = useMemo(
    () => ({
      lanes: LANES.map((l) => ({
        id: l.id,
        title: l.title,
        cards: tasks.filter((t) => laneOf(t) === l.id).map((t) => ({
          id: String(t.id),
          title: t.task,
          label: t.supplier_name ? `${t.supplier_name}` : `供应商#${t.supplier_id}`,
          description: `${t.deadline}${t.overdue_days > 0 ? ` · 超期 ${t.overdue_days} 天` : ''}`,
          badgeText: t.overdue_days > 0 ? '逾期' : undefined,
          metadata: { taskId: t.id },
        })),
      })),
    }),
    [tasks]
  )

  const moveTask = async (cardId: string, _src: string, target: string) => {
    const id = Number(cardId)
    const status = statusOf(target)
    try {
      await supplyApi.updateTask(id, { status })
      refetch()
    } catch (e) {
      console.error(e)
    }
  }

  const delTaskById = (id: number) => { if (confirm('删除该任务？')) { delTask(id) } }

  const inputStyle:React.CSSProperties = { background:'#FFFFFF',border:'1px solid rgba(218,30,43,0.15)',color:'#2A2E37',padding:'8px 12px',fontSize:'0.8125rem',fontFamily:'"Noto Sans SC",sans-serif' }

  return (
    <div style={{maxWidth:960,margin:'0 auto',padding:'48px 32px'}}>
      <h2 className="xj-section-title" style={{padding:'0 0 6px',margin:0}}>供应链协同中心</h2>
      <p style={{fontSize:'0.625rem',color:'#6B6258',margin:'0 0 20px'}}>供应商管理 · 外包任务看板 · 客户需求单 · AI需求文档</p>

      <div style={{display:'flex',gap:18,marginBottom:16}}>
        {[{k:'board',l:'任务看板'},{k:'req',l:'客户需求'}].map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k as any)} style={{background:'none',border:'none',color:tab===t.k?'#DA1E2B':'#8a8578',fontSize:'0.75rem',cursor:'pointer',fontFamily:'"Noto Sans SC",sans-serif',borderBottom:tab===t.k?'1px solid #DA1E2B':'1px solid transparent',padding:'4px 0'}}>{t.l}</button>
        ))}
      </div>

      {tab==='board'&&(<>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
        <h3 style={{fontSize:'0.75rem',color:'#DA1E2B',margin:0,fontFamily:'"Noto Serif SC",serif'}}>供应商评估</h3>
        <button onClick={()=>setShowSup(true)} className="xj-btn" style={{padding:'5px 14px',fontSize:'0.625rem'}}>+ 添加</button>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:28}}>
        {suppliers.map((s)=>(
          <div key={s.id} className="xj-panel" style={{padding:18}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
              <div>
                <div style={{fontSize:'0.8125rem',fontWeight:500,color:'#2A2E37'}}>{s.name}</div>
                <div style={{fontSize:'0.625rem',color:'#DA1E2B',marginTop:2}}>{s.category} · {s.mode}</div>
              </div>
              <span style={{fontSize:'0.875rem',fontWeight:700,color:s.score>=4?'#6a8a6a':s.score>=3?'#DA1E2B':'#c9a96e',fontFamily:'"Noto Serif SC",serif'}}>{s.score}</span>
            </div>
            <div style={{fontSize:'0.6875rem',color:'#8a8578',lineHeight:1.6}}>
              <div>预算：{s.budget} | {s.contact}</div>
              <div style={{marginTop:4,display:'flex',gap:16}}>
                <span>按时：<span style={{color:s.on_time>=90?'#6a8a6a':s.on_time>=70?'#DA1E2B':'#c9a96e'}}>{s.on_time}%</span></span>
                <span>修改：{s.revisions}轮</span>
              </div>
            </div>
            <button onClick={()=>delSupplier(s.id)} style={{background:'none',border:'none',color:'#6B6258',cursor:'pointer',fontSize:'0.5625rem',marginTop:8}}>删除</button>
          </div>
        ))}
      </div>

      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
        <h3 style={{fontSize:'0.75rem',color:'#DA1E2B',margin:0,fontFamily:'"Noto Serif SC",serif'}}>项目任务看板</h3>
        <button onClick={()=>setShowTask(true)} className="xj-btn" style={{padding:'5px 14px',fontSize:'0.625rem'}}>+ 新建任务</button>
      </div>
      <div className="xj-panel" style={{ marginBottom: 28, padding: '14px 8px 10px' }}>
        <div style={{ margin: '0 10px 10px', fontSize: '0.625rem', color: '#6B6258' }}>
          拖拽卡片切换状态 · 点击卡片删除 · 逾期任务自动落入「逾期」泳道
        </div>
        <Board
          data={boardData}
          draggable
          onCardDragEnd={moveTask}
          onCardClick={(cardId) => delTaskById(Number(cardId))}
          style={{ backgroundColor: 'transparent' }}
          laneStyle={{
            background: 'rgba(247,243,233,0.55)',
            border: '1px solid #E4DCC8',
            borderRadius: 10,
            minHeight: 260,
          }}
          cardStyle={{
            background: '#FFFFFF',
            border: '1px solid #E8E0D0',
            borderRadius: 8,
            boxShadow: '0 1px 3px rgba(42,46,55,0.06)',
            fontSize: '0.75rem',
            color: '#2A2E37',
            fontFamily: '"Noto Sans SC",sans-serif',
          }}
          cardDragStyle={{ background: '#FFFDF7', border: '1px solid rgba(218,30,43,0.35)' }}
        />
      </div>

      {/* AI需求单 */}
      <div className="xj-panel" style={{padding:'16px 20px'}}>
        <div style={{display:'flex',gap:10,alignItems:'center'}}>
          <span style={{fontSize:'0.6875rem',color:'#DA1E2B',whiteSpace:'nowrap',fontFamily:'"Noto Serif SC",serif'}}>AI 需求单生成</span>
          <input placeholder="如：制作沈砚角色PV，45秒水墨风格" value={aiBrief} onChange={e=>setAiBrief(e.target.value)} style={{flex:1,...inputStyle,fontSize:'0.75rem'}} />
          <button className="xj-btn" style={{padding:'7px 16px',fontSize:'0.6875rem'}} onClick={genBrief}>生成</button>
        </div>
        {briefResult&&<div style={{marginTop:12,padding:'10px 14px',background:'rgba(218,30,43,0.04)',border:'1px solid rgba(218,30,43,0.08)',fontSize:'0.6875rem',color:'#8a8578',lineHeight:1.7,whiteSpace:'pre-wrap'}}>{briefResult}</div>}
      </div>
      </>)}

      {tab==='req'&&(<>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
          <h3 style={{fontSize:'0.75rem',color:'#DA1E2B',margin:0,fontFamily:'"Noto Serif SC",serif'}}>客户需求单</h3>
          <button onClick={()=>setShowReq(true)} className="xj-btn" style={{padding:'5px 14px',fontSize:'0.625rem'}}>+ 登记需求</button>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:20}}>
          {reqs.length===0&&<div style={{padding:'36px',textAlign:'center',fontSize:'0.75rem',color:'#4a4540'}}>暂无客户需求 —— 对接客户需求后在此登记，并拆分关联到外包任务</div>}
          {reqs.map((rq)=>{
            const pc = rq.priority==='高' ? '#DA1E2B' : rq.priority==='中' ? '#D9A845' : '#6B6258'
            return (
              <div key={rq.id} className="xj-panel" style={{padding:'16px 20px'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12}}>
                  <div style={{flex:1}}>
                    <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',marginBottom:6}}>
                      <span style={{fontSize:'0.8125rem',fontWeight:600,color:'#2A2E37'}}>{rq.title}</span>
                      <span style={{fontSize:'0.625rem',color:pc,border:'1px solid '+pc,padding:'0 6px',borderRadius:4}}>{rq.priority}</span>
                      {rq.task_count>0&&<span style={{fontSize:'0.625rem',color:'#5b8c9e'}}>已关联 {rq.task_count} 个任务</span>}
                    </div>
                    <div style={{fontSize:'0.6875rem',color:'#8a8578',lineHeight:1.7}}>
                      <div>客户：{rq.client}{rq.source?` · 来源：${rq.source}`:''} · 截止：{rq.deadline||'未设定'}</div>
                      {rq.description&&<div style={{marginTop:4}}>{rq.description}</div>}
                    </div>
                    {rq.tasks.length>0&&(
                      <div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:8}}>
                        {rq.tasks.map((tk)=>(
                          <span key={tk.id} style={{display:'inline-flex',alignItems:'center',gap:6,background:'rgba(91,140,158,0.1)',border:'1px solid rgba(91,140,158,0.25)',color:'#5b8c9e',fontSize:'0.625rem',padding:'2px 8px',borderRadius:999}}>
                            {tk.task}
                            <a href="#" style={{textDecoration:'none',color:'#DA1E2B'}} onClick={(e)=>{e.preventDefault(); requirementApi.link(rq.id, tk.id, false).then(refetch)}}>×</a>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:8,flexShrink:0}}>
                    <select value={rq.status} onChange={(e)=>requirementApi.setStatus(rq.id, e.target.value).then(refetch)} style={{...inputStyle,fontSize:'0.6875rem',padding:'5px 8px'}}>
                      {['未处理','拆解中','制作中','验收中','已交付','已关闭'].map(s=>(
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    <div style={{display:'flex',gap:6}}>
                      <button onClick={()=>{setTForm({supplier_id:0,task:`【需求#${rq.id}】${rq.title}`,deadline:rq.deadline||'',status:'待派单',overdue_days:0}); setPendingReqId(rq.id); setShowTask(true)}} style={{background:'none',border:'1px solid rgba(218,30,43,0.3)',color:'#DA1E2B',fontSize:'0.625rem',cursor:'pointer',padding:'3px 8px',borderRadius:4}}>+ 建关联任务</button>
                      <button onClick={()=>{ if(confirm('删除该需求？')) requirementApi.remove(rq.id).then(refetch) }} style={{background:'none',border:'none',color:'#6B6258',fontSize:'0.625rem',cursor:'pointer'}}>删除</button>
                    </div>
                  </div>
                </div>
                <div style={{marginTop:10,paddingTop:8,borderTop:'1px dashed rgba(218,30,43,0.12)',display:'flex',alignItems:'center',gap:8}}>
                  <select id={`req-link-${rq.id}`} style={{...inputStyle,fontSize:'0.625rem',padding:'4px 8px'}}>
                    <option value="">选择已有任务关联</option>
                    {tasks.filter((t)=>!rq.linked_task_ids.includes(t.id)).map((t)=>(
                      <option key={t.id} value={t.id}>{t.supplier_name||'供应商#'+t.supplier_id} · {t.task}</option>
                    ))}
                  </select>
                  <button
                    style={{background:'none',border:'1px solid rgba(91,140,158,0.4)',color:'#5b8c9e',fontSize:'0.625rem',cursor:'pointer',padding:'4px 10px',borderRadius:4}}
                    onClick={()=>{ const v=(document.getElementById(`req-link-${rq.id}`) as HTMLSelectElement)?.value; if(v) requirementApi.link(rq.id, +v, true).then(refetch) }}
                  >关联</button>
                </div>
              </div>
            )
          })}
        </div>
      </>)}

      {/* 供应商 Modal */}
      {showSup&&(
        <div style={{position:'fixed',inset:0,background:'rgba(28,30,38,0.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:100}} onClick={()=>setShowSup(false)}>
          <div className="xj-panel" style={{padding:'28px 32px',maxWidth:420,width:'90%'}} onClick={e=>e.stopPropagation()}>
            <h3 style={{fontSize:'0.9375rem',color:'#DA1E2B',margin:'0 0 16px',fontFamily:'"Noto Serif SC",serif'}}>添加供应商</h3>
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {[{k:'name',l:'名称'},{k:'category',l:'类型(漫画/设计/视频)'},{k:'budget',l:'预算'},{k:'mode',l:'合作模式'},{k:'contact',l:'联系人'}].map(({k,l})=>(
                <input key={k} placeholder={l} value={(sForm as any)[k]} onChange={e=>setSForm({...sForm,[k]:e.target.value})} style={inputStyle} />
              ))}
            </div>
            <div style={{display:'flex',gap:10,marginTop:16,justifyContent:'flex-end'}}>
              <button onClick={()=>setShowSup(false)} style={{background:'transparent',color:'#8a8578',border:'1px solid rgba(218,30,43,0.2)',padding:'8px 20px',fontSize:'0.75rem',cursor:'pointer'}}>取消</button>
              <button className="xj-btn" style={{padding:'8px 24px',fontSize:'0.75rem'}} onClick={addSupplier}>添加</button>
            </div>
          </div>
        </div>
      )}

      {/* 需求 Modal */}
      {showReq&&(
        <div style={{position:'fixed',inset:0,background:'rgba(28,30,38,0.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:100}} onClick={()=>setShowReq(false)}>
          <div className="xj-panel" style={{padding:'28px 32px',maxWidth:440,width:'90%'}} onClick={e=>e.stopPropagation()}>
            <h3 style={{fontSize:'0.9375rem',color:'#DA1E2B',margin:'0 0 16px',fontFamily:'"Noto Serif SC",serif'}}>登记客户需求</h3>
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              <input placeholder="客户名称" value={rForm.client} onChange={e=>setRForm({...rForm,client:e.target.value})} style={inputStyle} />
              <input placeholder="需求标题" value={rForm.title} onChange={e=>setRForm({...rForm,title:e.target.value})} style={inputStyle} />
              <textarea placeholder="需求描述（交付物/规格/验收要点）" value={rForm.description} onChange={e=>setRForm({...rForm,description:e.target.value})} rows={3} style={{...inputStyle,resize:'vertical'}} />
              <div style={{display:'flex',gap:10}}>
                <input placeholder="来源渠道" value={rForm.source} onChange={e=>setRForm({...rForm,source:e.target.value})} style={{...inputStyle,flex:1}} />
                <select value={rForm.priority} onChange={e=>setRForm({...rForm,priority:e.target.value})} style={inputStyle}>
                  {['高','中','低'].map(p=><option key={p} value={p}>{p}优先级</option>)}
                </select>
              </div>
              <input placeholder="预计交付日期" value={rForm.deadline} onChange={e=>setRForm({...rForm,deadline:e.target.value})} style={inputStyle} />
            </div>
            <div style={{display:'flex',gap:10,marginTop:16,justifyContent:'flex-end'}}>
              <button onClick={()=>setShowReq(false)} style={{background:'transparent',color:'#8a8578',border:'1px solid rgba(218,30,43,0.2)',padding:'8px 20px',fontSize:'0.75rem',cursor:'pointer'}}>取消</button>
              <button className="xj-btn" style={{padding:'8px 24px',fontSize:'0.75rem'}} onClick={addRequirement}>登记</button>
            </div>
          </div>
        </div>
      )}

      {/* 任务 Modal */}
      {showTask&&(
        <div style={{position:'fixed',inset:0,background:'rgba(28,30,38,0.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:100}} onClick={()=>setShowTask(false)}>
          <div className="xj-panel" style={{padding:'28px 32px',maxWidth:420,width:'90%'}} onClick={e=>e.stopPropagation()}>
            <h3 style={{fontSize:'0.9375rem',color:'#DA1E2B',margin:'0 0 16px',fontFamily:'"Noto Serif SC",serif'}}>新建任务</h3>
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              <select value={tForm.supplier_id} onChange={e=>setTForm({...tForm,supplier_id:+e.target.value})} style={inputStyle}>
                <option value={0}>选择供应商</option>
                {suppliers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <input placeholder="任务描述" value={tForm.task} onChange={e=>setTForm({...tForm,task:e.target.value})} style={inputStyle} />
              <input placeholder="截止日期" value={tForm.deadline} onChange={e=>setTForm({...tForm,deadline:e.target.value})} style={inputStyle} />
              <select value={tForm.status} onChange={e=>setTForm({...tForm,status:e.target.value})} style={inputStyle}>
                {['待派单','进行中','初稿提交','内部反馈','修改中','待验收','已验收','逾期'].map(s=><option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div style={{display:'flex',gap:10,marginTop:16,justifyContent:'flex-end'}}>
              <button onClick={()=>setShowTask(false)} style={{background:'transparent',color:'#8a8578',border:'1px solid rgba(218,30,43,0.2)',padding:'8px 20px',fontSize:'0.75rem',cursor:'pointer'}}>取消</button>
              <button className="xj-btn" style={{padding:'8px 24px',fontSize:'0.75rem'}} onClick={addTask}>添加</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
