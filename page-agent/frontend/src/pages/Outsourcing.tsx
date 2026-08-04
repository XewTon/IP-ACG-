// 玄策 · 供应链协同中心 —— 后端 CRUD
import { useEffect, useState } from 'react'
import { supplyApi, type Supplier, type SupplyTask } from '../api'

export default function Outsourcing() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [tasks, setTasks] = useState<SupplyTask[]>([])
  const [aiBrief,setAiBrief]=useState(''); const [briefResult,setBriefResult]=useState('')
  const [showSup, setShowSup] = useState(false); const [showTask, setShowTask] = useState(false)
  const [sForm, setSForm] = useState({ name:'', category:'', budget:'', mode:'', on_time:90, revisions:1.5, score:4.0, contact:'' })
  const [tForm, setTForm] = useState({ supplier_id:0, task:'', deadline:'', status:'待派单', overdue_days:0 })

  const refetch = async () => {
    Promise.all([supplyApi.listSuppliers(), supplyApi.listTasks()]).then(([s,t]) => { setSuppliers(s.data); setTasks(t.data) })
  }
  useEffect(() => { refetch() }, [])

  const addSupplier = async () => { await supplyApi.createSupplier(sForm); setShowSup(false); setSForm({ name:'',category:'',budget:'',mode:'',on_time:90,revisions:1.5,score:4.0,contact:'' }); refetch() }
  const addTask = async () => { await supplyApi.createTask(tForm); setShowTask(false); setTForm({ supplier_id:0,task:'',deadline:'',status:'待派单',overdue_days:0 }); refetch() }
  const delSupplier = async (id:number) => { if(confirm('删除?')){ await supplyApi.deleteSupplier(id); refetch() } }
  const delTask = async (id:number) => { if(confirm('删除?')){ await supplyApi.deleteTask(id); refetch() } }
  const genBrief=async()=>{ setBriefResult('生成中...'); try{const r=await fetch('/api/agent/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:`为九歌IP生成一份外包需求文档：${aiBrief}`})});const d=await r.json();setBriefResult(d.reply)}catch(e){setBriefResult('生成失败')} }

  const inputStyle:React.CSSProperties = { background:'#0a0c14',border:'1px solid rgba(200,155,60,0.15)',color:'#e8e0d0',padding:'8px 12px',fontSize:'0.8125rem',fontFamily:'"Noto Sans SC",sans-serif' }

  return (
    <div style={{maxWidth:960,margin:'0 auto',padding:'48px 32px'}}>
      <h2 className="xj-section-title" style={{padding:'0 0 6px',margin:0}}>供应链协同中心</h2>
      <p style={{fontSize:'0.625rem',color:'#6B6258',margin:'0 0 28px'}}>供应商管理 · 任务看板 · AI需求单</p>

      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
        <h3 style={{fontSize:'0.75rem',color:'#C89B3C',margin:0,fontFamily:'"Noto Serif SC",serif'}}>供应商评估</h3>
        <button onClick={()=>setShowSup(true)} className="xj-btn" style={{padding:'5px 14px',fontSize:'0.625rem'}}>+ 添加</button>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:28}}>
        {suppliers.map((s)=>(
          <div key={s.id} className="xj-panel" style={{padding:18}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
              <div>
                <div style={{fontSize:'0.8125rem',fontWeight:500,color:'#e8e0d0'}}>{s.name}</div>
                <div style={{fontSize:'0.625rem',color:'#C89B3C',marginTop:2}}>{s.category} · {s.mode}</div>
              </div>
              <span style={{fontSize:'0.875rem',fontWeight:700,color:s.score>=4?'#6a8a6a':s.score>=3?'#C89B3C':'#c9a96e',fontFamily:'"Noto Serif SC",serif'}}>{s.score}</span>
            </div>
            <div style={{fontSize:'0.6875rem',color:'#8a8578',lineHeight:1.6}}>
              <div>预算：{s.budget} | {s.contact}</div>
              <div style={{marginTop:4,display:'flex',gap:16}}>
                <span>按时：<span style={{color:s.on_time>=90?'#6a8a6a':s.on_time>=70?'#C89B3C':'#c9a96e'}}>{s.on_time}%</span></span>
                <span>修改：{s.revisions}轮</span>
              </div>
            </div>
            <button onClick={()=>delSupplier(s.id)} style={{background:'none',border:'none',color:'#6B6258',cursor:'pointer',fontSize:'0.5625rem',marginTop:8}}>删除</button>
          </div>
        ))}
      </div>

      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
        <h3 style={{fontSize:'0.75rem',color:'#C89B3C',margin:0,fontFamily:'"Noto Serif SC",serif'}}>项目任务看板</h3>
        <button onClick={()=>setShowTask(true)} className="xj-btn" style={{padding:'5px 14px',fontSize:'0.625rem'}}>+ 新建任务</button>
      </div>
      <div className="xj-panel" style={{marginBottom:28}}>
        <div style={{display:'grid',gridTemplateColumns:'140px 1fr 80px 100px 40px',padding:'8px 20px',borderBottom:'1px solid rgba(200,155,60,0.12)',fontSize:'0.625rem',color:'#6B6258'}}><span>合作方</span><span>任务</span><span>截止</span><span>状态</span><span/></div>
        {tasks.map((t)=>(
          <div key={t.id} className={`xj-row${t.overdue_days>0?' xj-row-warning':''}`} style={{padding:'0 20px'}}>
            <span style={{fontSize:'0.8125rem',fontWeight:500,color:'#e8e0d0',width:140,flexShrink:0}}>{t.supplier_name||t.supplier_id}</span>
            <span style={{fontSize:'0.75rem',color:'#8a8578',flex:1}}>{t.task}</span>
            <span style={{fontSize:'0.75rem',color:t.overdue_days>0?'#c9a96e':'#8a8578',width:80,flexShrink:0}}>{t.deadline}</span>
            <span style={{fontSize:'0.75rem',fontWeight:t.overdue_days>0?500:400,color:t.overdue_days>0?'#c9a96e':'#8a8578',width:100,flexShrink:0,display:'flex',alignItems:'center',gap:4}}>
              {t.overdue_days>0&&<span className="xj-warning-dot"></span>}{t.overdue_days>0?`${t.status} ${t.overdue_days}天`:t.status}
            </span>
            <button onClick={()=>delTask(t.id)} style={{background:'none',border:'none',color:'#6B6258',cursor:'pointer',fontSize:'0.6875rem'}}>×</button>
          </div>
        ))}
      </div>

      {/* AI需求单 */}
      <div className="xj-panel" style={{padding:'16px 20px'}}>
        <div style={{display:'flex',gap:10,alignItems:'center'}}>
          <span style={{fontSize:'0.6875rem',color:'#C89B3C',whiteSpace:'nowrap',fontFamily:'"Noto Serif SC",serif'}}>AI 需求单生成</span>
          <input placeholder="如：制作沈砚角色PV，45秒水墨风格" value={aiBrief} onChange={e=>setAiBrief(e.target.value)} style={{flex:1,...inputStyle,fontSize:'0.75rem'}} />
          <button className="xj-btn" style={{padding:'7px 16px',fontSize:'0.6875rem'}} onClick={genBrief}>生成</button>
        </div>
        {briefResult&&<div style={{marginTop:12,padding:'10px 14px',background:'rgba(200,155,60,0.04)',border:'1px solid rgba(200,155,60,0.08)',fontSize:'0.6875rem',color:'#8a8578',lineHeight:1.7,whiteSpace:'pre-wrap'}}>{briefResult}</div>}
      </div>

      {/* 供应商 Modal */}
      {showSup&&(
        <div style={{position:'fixed',inset:0,background:'rgba(4,4,8,0.85)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:100}} onClick={()=>setShowSup(false)}>
          <div className="xj-panel" style={{padding:'28px 32px',maxWidth:420,width:'90%'}} onClick={e=>e.stopPropagation()}>
            <h3 style={{fontSize:'0.9375rem',color:'#C89B3C',margin:'0 0 16px',fontFamily:'"Noto Serif SC",serif'}}>添加供应商</h3>
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {[{k:'name',l:'名称'},{k:'category',l:'类型(漫画/设计/视频)'},{k:'budget',l:'预算'},{k:'mode',l:'合作模式'},{k:'contact',l:'联系人'}].map(({k,l})=>(
                <input key={k} placeholder={l} value={(sForm as any)[k]} onChange={e=>setSForm({...sForm,[k]:e.target.value})} style={inputStyle} />
              ))}
            </div>
            <div style={{display:'flex',gap:10,marginTop:16,justifyContent:'flex-end'}}>
              <button onClick={()=>setShowSup(false)} style={{background:'transparent',color:'#8a8578',border:'1px solid rgba(200,155,60,0.2)',padding:'8px 20px',fontSize:'0.75rem',cursor:'pointer'}}>取消</button>
              <button className="xj-btn" style={{padding:'8px 24px',fontSize:'0.75rem'}} onClick={addSupplier}>添加</button>
            </div>
          </div>
        </div>
      )}

      {/* 任务 Modal */}
      {showTask&&(
        <div style={{position:'fixed',inset:0,background:'rgba(4,4,8,0.85)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:100}} onClick={()=>setShowTask(false)}>
          <div className="xj-panel" style={{padding:'28px 32px',maxWidth:420,width:'90%'}} onClick={e=>e.stopPropagation()}>
            <h3 style={{fontSize:'0.9375rem',color:'#C89B3C',margin:'0 0 16px',fontFamily:'"Noto Serif SC",serif'}}>新建任务</h3>
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
              <button onClick={()=>setShowTask(false)} style={{background:'transparent',color:'#8a8578',border:'1px solid rgba(200,155,60,0.2)',padding:'8px 20px',fontSize:'0.75rem',cursor:'pointer'}}>取消</button>
              <button className="xj-btn" style={{padding:'8px 24px',fontSize:'0.75rem'}} onClick={addTask}>添加</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
