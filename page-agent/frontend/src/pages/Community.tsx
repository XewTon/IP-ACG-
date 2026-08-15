// 玄策 · 用户社区运营中心 —— 后端 CRUD
import { useEffect, useState } from 'react'
import { communityApi, type CommunityFeedback, type CommunityEvent, type UserPersona } from '../api'

const levelStyle:Record<string,{dot:string;bg:string}> = {green:{dot:'#6a8a6a',bg:'rgba(106,138,106,0.06)'},yellow:{dot:'#DA1E2B',bg:'rgba(218,30,43,0.06)'},red:{dot:'#9b2d30',bg:'rgba(155,45,48,0.06)'}}

export default function Community() {
  const [feedbacks, setFeedbacks] = useState<CommunityFeedback[]>([])
  const [events, setEvents] = useState<CommunityEvent[]>([])
  const [personas, setPersonas] = useState<UserPersona[]>([])
  const [sentFilter, setSentFilter] = useState('')
  const [showFb, setShowFb] = useState(false); const [showEv, setShowEv] = useState(false)
  const [fbForm, setFbForm] = useState({ platform:'B站', user_name:'', content:'', sentiment:'positive', role_type:'剧情党', date:'' })
  const [evForm, setEvForm] = useState({ title:'', level:'green', action:'', date:'' })

  const fetch = async () => {
    Promise.all([communityApi.listFeedback(), communityApi.listEvents(), communityApi.listPersonas()]).then(([f,e,p])=>{setFeedbacks(f.data);setEvents(e.data);setPersonas(p.data)})
  }
  useEffect(()=>{fetch()},[])

  const addFeedback = async () => { await communityApi.createFeedback(fbForm); setShowFb(false); setFbForm({ platform:'B站',user_name:'',content:'',sentiment:'positive',role_type:'剧情党',date:'' }); fetch() }
  const addEvent = async () => { await communityApi.createEvent(evForm); setShowEv(false); setEvForm({ title:'',level:'green',action:'',date:'' }); fetch() }
  const delFb = async (id:number) => { if(confirm('删除?')){ await communityApi.deleteFeedback(id); fetch() } }
  const delEv = async (id:number) => { if(confirm('删除?')){ await communityApi.deleteEvent(id); fetch() } }
  const savePersona = async (p:UserPersona) => { await communityApi.updatePersona(p.id, p); fetch() }

  const inputStyle:React.CSSProperties = { background:'#FFFFFF',border:'1px solid rgba(218,30,43,0.15)',color:'#2A2E37',padding:'7px 10px',fontSize:'0.75rem',fontFamily:'"Noto Sans SC",sans-serif' }

  return (
    <div style={{maxWidth:900,margin:'0 auto',padding:'48px 32px'}}>
      <h2 className="xj-section-title" style={{padding:'0 0 6px',margin:0}}>用户社区运营中心</h2>
      <p style={{fontSize:'0.625rem',color:'#6B6258',margin:'0 0 28px'}}>反馈池 + 玩家画像 + 社区事件</p>

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
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
        <h3 style={{fontSize:'0.75rem',color:'#DA1E2B',margin:0,fontFamily:'"Noto Serif SC",serif'}}>用户反馈池</h3>
        <button onClick={()=>setShowFb(true)} className="xj-btn" style={{padding:'5px 14px',fontSize:'0.625rem'}}>+ 添加反馈</button>
      </div>
      <div style={{display:'flex',gap:8,marginBottom:12}}>
        {['','positive','neutral','negative'].map(s=>(
          <button key={s} onClick={()=>setSentFilter(s)} style={{background:sentFilter===s?'rgba(218,30,43,0.12)':'transparent',color:sentFilter===s?'#DA1E2B':'#8a8578',border:'none',fontSize:'0.625rem',cursor:'pointer',padding:'3px 10px',fontFamily:'"Noto Sans SC",sans-serif'}}>{s?{positive:'正面',neutral:'中立',negative:'负面'}[s]:'全部'}</button>
        ))}
      </div>
      <div className="xj-panel" style={{marginBottom:28}}>
        <div style={{display:'grid',gridTemplateColumns:'50px 60px 1fr 50px 30px',padding:'8px 18px',borderBottom:'1px solid rgba(218,30,43,0.12)',fontSize:'0.625rem',color:'#6B6258'}}><span>平台</span><span>用户</span><span>反馈</span><span>情感</span><span/></div>
        {feedbacks.filter(f=>!sentFilter||f.sentiment===sentFilter).map((f)=>(
          <div key={f.id} className="xj-row" style={{padding:'0 18px'}}>
            <span style={{fontSize:'0.6875rem',color:'#8a8578',width:50,flexShrink:0}}>{f.platform}</span>
            <span style={{fontSize:'0.75rem',color:'#2A2E37',width:60,flexShrink:0}}>{f.user_name}</span>
            <span style={{fontSize:'0.75rem',color:'#8a8578',flex:1,paddingRight:12}}>"{f.content}"</span>
            <span style={{fontSize:'0.6875rem',color:f.sentiment==='positive'?'#6a8a6a':f.sentiment==='negative'?'#c9a96e':'#8a8578',width:50,flexShrink:0,textAlign:'right'}}>{f.sentiment==='positive'?'喜欢':f.sentiment==='negative'?'负面':'中立'}</span>
            <button onClick={()=>delFb(f.id)} style={{background:'none',border:'none',color:'#6B6258',cursor:'pointer',fontSize:'0.625rem'}}>×</button>
          </div>
        ))}
      </div>

      {/* 社区事件 */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
        <h3 style={{fontSize:'0.75rem',color:'#DA1E2B',margin:0,fontFamily:'"Noto Serif SC",serif'}}>社区事件日志</h3>
        <button onClick={()=>setShowEv(true)} className="xj-btn" style={{padding:'5px 14px',fontSize:'0.625rem'}}>+ 添加事件</button>
      </div>
      <div className="xj-panel">
        {events.map((e)=>(
          <div key={e.id} style={{display:'flex',alignItems:'center',padding:'12px 20px',gap:14,borderBottom:'1px solid rgba(218,30,43,0.06)',background:levelStyle[e.level].bg}}>
            <span style={{width:6,height:6,borderRadius:'50%',background:levelStyle[e.level].dot,flexShrink:0}} />
            <span style={{fontSize:'0.6875rem',color:'#6B6258',width:50}}>{e.date}</span>
            <span style={{fontSize:'0.75rem',color:'#2A2E37',flex:1}}>{e.title}</span>
            <span style={{fontSize:'0.6875rem',color:'#8a8578'}}>{e.action}</span>
            <button onClick={()=>delEv(e.id)} style={{background:'none',border:'none',color:'#6B6258',cursor:'pointer',fontSize:'0.625rem'}}>×</button>
          </div>
        ))}
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
