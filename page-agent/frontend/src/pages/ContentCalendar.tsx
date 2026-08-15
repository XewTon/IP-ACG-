// 九歌 · 内容运营中心 —— Postiz对接 + AI辅助 + 审核流 + 数据复盘
import { useEffect, useState } from 'react'
import DOMPurify from 'dompurify'
import { postizApi, ContentItem } from '../api'
import TipTapEditor from '../components/TipTapEditor'
import { COPY_TEMPLATES, PLATFORM_RULES } from '../data/copyTemplates'

const PL: Record<string,string>={bilibili:'B站',weibo:'微博',xiaohongshu:'小红书',wechat:'公众号'}
const SL: Record<string,string>={draft:'草稿',pending_review:'待审核',approved:'已通过',scheduled:'已排期',published:'已发布',failed:'失败'}
const SC: Record<string,string>={draft:'#6B6258',pending_review:'#DA1E2B',approved:'#8a8578',scheduled:'#5b8c9e',published:'#6a8a6a',failed:'#c9a96e'}
const PCOL: Record<string,{c:string;bg:string}>={bilibili:{c:'#e8a0b0',bg:'rgba(232,160,176,0.06)'},weibo:{c:'#e0b888',bg:'rgba(224,184,136,0.06)'},xiaohongshu:{c:'#d4a0a0',bg:'rgba(212,160,160,0.06)'},wechat:{c:'#a0c8a0',bg:'rgba(160,200,160,0.06)'}}
/* 建议发布时段（平台参数：B站 周四/周五18:00 · 微博 10:00/12:30/21:00 · 小红书 12:00/20:00 · 公众号 周二/周四21:00） */
const SCHEDULE_HINT: Record<string,string>={bilibili:'周四/周五 18:00',weibo:'10:00 / 12:30 / 21:00',xiaohongshu:'12:00 / 20:00',wechat:'周二/周四 21:00'}

export default function ContentCalendar() {
  const [items,setItems]=useState<ContentItem[]>([])
  const [filter,setFilter]=useState('')
  const [showForm,setShowForm]=useState(false)
  const [reviewTarget,setReviewTarget]=useState<ContentItem|null>(null)
  const [aiPrompt,setAiPrompt]=useState('')
  const [aiResult,setAiResult]=useState('')
  const [form,setForm]=useState({platform:'bilibili',title:'',body:'',scheduledAt:'',mediaUrls:''})
  const [tab,setTab]=useState<'list'|'flow'|'review'|'copy'>('list')

  const fetchData=async()=>{
    try{const r=await postizApi.listPosts(filter||undefined);setItems(r.data)}catch(e){console.error(e)}
  }
  useEffect(()=>{fetchData()},[filter])

  const handleCreate=async()=>{
    await postizApi.createPost({platform:form.platform,postizChannelId:`int_${form.platform}_mock`,title:form.title,body:form.body,scheduledAt:form.scheduledAt,mediaUrls:form.mediaUrls?form.mediaUrls.split(',').map(s=>s.trim()):[],status:'draft'})
    setShowForm(false);setForm({platform:'bilibili',title:'',body:'',scheduledAt:'',mediaUrls:''});fetchData()
  }
  const handleSubmitReview=async(id:number)=>{
    await fetch(`/api/postiz/posts/${id}/status?status=pending_review`,{method:'PUT'});fetchData()}
  const handleReview=async(action:'approve'|'reject')=>{
    if(!reviewTarget)return
    const note=(document.getElementById('review-note')as HTMLTextAreaElement)?.value||''
    await postizApi.reviewPost(reviewTarget.id,action,'运营负责人',note)
    setReviewTarget(null);fetchData()
  }
  const handlePublish=async(id:number)=>{await postizApi.publishToPostiz(id);fetchData()}
  const handleDelete=async(id:number)=>{if(confirm('删除？')){await postizApi.deletePost(id);fetchData()}}
  const handleAiGenerate=async()=>{
    setAiResult('生成中...')
    try{const r=await fetch('/api/agent/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:`为九歌IP生成一条${aiPrompt}的社交媒体内容，平台自选，含标题和正文`})});const d=await r.json();setAiResult(d.reply)}catch{setAiResult('AI生成失败')}
  }

  return (
    <div style={{maxWidth:860,margin:'0 auto',padding:'48px 32px'}}>
      <h2 className="xj-section-title" style={{padding:'0 0 6px',margin:0}}>内容运营中心</h2>
      <p style={{fontSize:'0.625rem',color:'#6B6258',margin:'0 0 20px'}}>九歌负责内容生成+审核 → Postiz负责排期发布（Mock API）</p>

      {/* Tab */}
      <div style={{display:'flex',gap:16,marginBottom:20}}>
        {[{k:'list',l:'内容列表'},{k:'flow',l:'审核流程'},{k:'review',l:'数据复盘'},{k:'copy',l:'文案模板'}].map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k as any)} style={{background:'none',border:'none',color:tab===t.k?'#DA1E2B':'#8a8578',fontSize:'0.75rem',cursor:'pointer',fontFamily:'"Noto Sans SC",sans-serif',borderBottom:tab===t.k?'1px solid #DA1E2B':'1px solid transparent',padding:'4px 0'}}>{t.l}</button>
        ))}
        <div style={{flex:1}}/>
        <button className="xj-btn" style={{padding:'7px 18px',fontSize:'0.6875rem'}} onClick={()=>setShowForm(true)}>+ 新建内容</button>
      </div>

      {tab==='list'&&(<>
        {/* Filter */}
        <div style={{display:'flex',gap:8,marginBottom:16}}>
          {['','draft','pending_review','scheduled','published'].map(s=>(
            <button key={s} onClick={()=>setFilter(s)} style={{background:filter===s?'rgba(218,30,43,0.12)':'transparent',color:filter===s?'#DA1E2B':'#8a8578',border:'none',fontSize:'0.625rem',cursor:'pointer',padding:'3px 10px',fontFamily:'"Noto Sans SC",sans-serif'}}>{s?SL[s]:'全部'}{s==='pending_review'&&items.filter(i=>i.status==='pending_review').length>0&&` (${items.filter(i=>i.status==='pending_review').length})`}</button>
          ))}
        </div>
        {/* List */}
        <div className="xj-panel">
          <div style={{display:'grid',gridTemplateColumns:'60px 1fr 1.2fr 130px 80px 80px',padding:'8px 18px',borderBottom:'1px solid rgba(218,30,43,0.12)',fontSize:'0.625rem',color:'#6B6258'}}><span>平台</span><span>标题</span><span>排期</span><span>状态</span><span>Postiz</span><span>操作</span></div>
          {items.length===0&&<div style={{padding:'32px',textAlign:'center',fontSize:'0.75rem',color:'#4a4540'}}>暂无内容</div>}
          {items.map(item=>{
            const pc=PCOL[item.platform]||{c:'#8a8578',bg:'transparent'}
            return(<div key={item.id} className="xj-row" style={{padding:'0 18px'}}>
              <span style={{fontSize:'0.6875rem',fontWeight:500,color:pc.c,background:pc.bg,padding:'1px 6px',width:52,textAlign:'center',flexShrink:0}}>{PL[item.platform]||item.platform}</span>
              <span style={{fontSize:'0.8125rem',color:'#2A2E37',fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',paddingRight:12}}>{item.title}</span>
              <span style={{fontSize:'0.6875rem',color:'#8a8578'}}>{item.scheduledAt?new Date(item.scheduledAt).toLocaleString('zh-CN',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}):<span style={{fontSize:'0.5625rem',color:'#c9a96e'}}>建议 {SCHEDULE_HINT[item.platform]||'—'}</span>}</span>
              <span style={{fontSize:'0.75rem',fontWeight:item.status==='pending_review'?500:400,color:SC[item.status]||'#8a8578',flexShrink:0,width:72}}>{SL[item.status]}{item.reviewerNote&&<span style={{marginLeft:3,fontSize:'0.5625rem',color:'#DA1E2B'}}>朱</span>}</span>
              <span style={{fontSize:'0.625rem',color:item.postizPostId?'#6a8a6a':'#4a4540',flexShrink:0,width:72}}>{item.postizPostId?item.postizPostId.slice(-8):'—'}</span>
              <span style={{display:'flex',gap:6,flexShrink:0}}>
                {item.status==='draft'&&<button onClick={()=>handleSubmitReview(item.id)} style={{background:'none',border:'none',color:'#DA1E2B',cursor:'pointer',fontSize:'0.6875rem'}}>提交</button>}
                {item.status==='pending_review'&&<button onClick={()=>setReviewTarget(item)} style={{background:'none',border:'none',color:'#c9a96e',cursor:'pointer',fontSize:'0.6875rem'}}>朱批</button>}
                {item.status==='scheduled'&&!item.postizPostId&&<button onClick={()=>handlePublish(item.id)} style={{background:'none',border:'none',color:'#5b8c9e',cursor:'pointer',fontSize:'0.6875rem'}}>发布</button>}
                {item.postizPostId&&<span style={{fontSize:'0.625rem',color:'#6a8a6a'}}>✓</span>}
                <button onClick={()=>handleDelete(item.id)} style={{background:'none',border:'none',color:'#6B6258',cursor:'pointer',fontSize:'0.625rem'}}>×</button>
              </span>
            </div>)
          })}
        </div>
      </>)}

      {tab==='flow'&&(
        <div className="xj-panel" style={{padding:24}}>
          <h3 style={{fontSize:'0.8125rem',color:'#DA1E2B',margin:'0 0 20px',fontFamily:'"Noto Serif SC",serif'}}>审核工作流</h3>
          <div style={{display:'flex',alignItems:'center',gap:0,fontSize:'0.75rem',color:'#8a8578'}}>
            {['草稿','→','提交审核','→','运营初审','→','IP一致性检查','→','朱批通过/驳回','→','Postiz排期','→','已发布'].map((s,i)=>(
              <span key={i} style={{padding:i%2===0?'6px 12px':'4px',background:i%2===0?'rgba(218,30,43,0.06)':'transparent',border:i%2===0?'1px solid rgba(218,30,43,0.15)':'none',color:i%2===0?'#2A2E37':'#6B6258',fontSize:i%2===0?'0.75rem':'0.625rem'}}>{s}</span>
            ))}
          </div>
          <div style={{marginTop:20,fontSize:'0.6875rem',color:'#6B6258'}}>
            <p>审核维度：世界观一致性 / 角色行为合理性 / 品牌风险 / 用户接受度</p>
            <p>结果标注：✅ 通过 / ⚠ 建议修改（不阻止发布）/ 🔴 必须修改（阻止发布）</p>
          </div>
        </div>
      )}

      {tab==='review'&&(
        <div className="xj-panel" style={{padding:24}}>
          <h3 style={{fontSize:'0.8125rem',color:'#DA1E2B',margin:'0 0 16px',fontFamily:'"Noto Serif SC",serif'}}>近期内容数据复盘</h3>
          {[{title:'世界观短片#8',platform:'B站',views:'46,100',interactions:'4,550',trend:'↑'},{title:'林疏影角色PV',platform:'B站',views:'71,300',interactions:'11,680',trend:'↑↑'},{title:'幕后花絮：线稿分享',platform:'微博',views:'3,800',interactions:'120',trend:'→'},{title:'东方幻想推荐笔记',platform:'小红书',views:'5,200',interactions:'2,300',trend:'↑'}].map((c,i)=>(
            <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 14px',borderBottom:i<3?'1px solid rgba(218,30,43,0.04)':'none',fontSize:'0.75rem'}}>
              <span style={{color:'#8a8578',width:80}}>{c.platform}</span>
              <span style={{color:'#2A2E37',flex:1}}>{c.title}</span>
              <span style={{color:'#8a8578',marginRight:16}}>{c.views} 阅 · {c.interactions} 互动</span>
              <span style={{color:c.trend.includes('↑')?'#c9a96e':'#8a8578'}}>{c.trend}</span>
            </div>
          ))}
        </div>
      )}

      {tab==='copy'&&(
        <div>
          <div style={{display:'flex',gap:8,marginBottom:14,flexWrap:'wrap'}}>
            {PLATFORM_RULES.map((p)=>(
              <details key={p.platform} style={{flex:'1 1 220px'}}>
                <summary style={{cursor:'pointer',fontSize:'0.75rem',color:'#DA1E2B',fontFamily:'"Noto Serif SC",serif',background:'rgba(218,30,43,0.05)',border:'1px solid rgba(218,30,43,0.15)',padding:'8px 12px',borderRadius:8}}>
                  {p.platform} 发布规则
                </summary>
                <div style={{padding:'10px 12px',background:'rgba(255,253,247,0.8)',border:'1px solid #E4DCC8',borderRadius:'0 0 8px 8px'}}>
                  {p.rules.map((r,i)=>(<div key={i} style={{fontSize:'0.625rem',color:'#6B6258',lineHeight:1.8}}>· {r}</div>))}
                </div>
              </details>
            ))}
          </div>
          <div className="xj-panel">
            {COPY_TEMPLATES.map((t)=>(
              <div key={t.id} style={{padding:'16px 20px',borderBottom:'1px solid rgba(218,30,43,0.08)'}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
                  <div style={{display:'flex',alignItems:'center',gap:10}}>
                    <span style={{fontSize:'0.8125rem',fontWeight:600,color:'#2A2E37'}}>{t.name}</span>
                    <span style={{fontSize:'0.5625rem',color:'#DA1E2B',border:'1px solid rgba(218,30,43,0.3)',padding:'0 6px',borderRadius:4}}>{t.category}</span>
                    <span style={{fontSize:'0.5625rem',color:'#5b8c9e'}}>{t.platform}</span>
                  </div>
                  <button className="xj-btn" style={{padding:'5px 14px',fontSize:'0.625rem'}} onClick={()=>{ setForm({...form,title:t.name,body:t.body}); setShowForm(true); setTab('list') }}>填入新建草稿</button>
                </div>
                <p style={{fontSize:'0.625rem',color:'#6B6258',margin:'0 0 8px'}}>{t.notes}</p>
                <div style={{fontSize:'0.6875rem',color:'var(--xj-muted)',border:'1px dashed rgba(218,30,43,0.2)',borderRadius:6,padding:'8px 12px',maxHeight:88,overflow:'hidden'}} dangerouslySetInnerHTML={{__html:DOMPurify.sanitize(t.body)}} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI生成 */}
      <div className="xj-panel" style={{padding:'16px 20px',marginTop:20}}>
        <div style={{display:'flex',gap:10,alignItems:'center'}}>
          <span style={{fontSize:'0.6875rem',color:'#DA1E2B',whiteSpace:'nowrap',fontFamily:'"Noto Serif SC",serif'}}>AI 内容助手</span>
          <input placeholder="输入主题，如：角色生日活动、世界观短片、幕后花絮..." value={aiPrompt} onChange={e=>setAiPrompt(e.target.value)}
            style={{flex:1,background:'#FFFFFF',border:'1px solid rgba(218,30,43,0.15)',color:'#2A2E37',padding:'7px 12px',fontSize:'0.75rem',fontFamily:'"Noto Sans SC",sans-serif'}} />
          <button className="xj-btn" style={{padding:'7px 16px',fontSize:'0.6875rem'}} onClick={handleAiGenerate}>生成</button>
        </div>
        {aiResult&&<div style={{marginTop:12,padding:'10px 14px',background:'rgba(218,30,43,0.04)',border:'1px solid rgba(218,30,43,0.08)',fontSize:'0.6875rem',color:'#8a8578',lineHeight:1.7,whiteSpace:'pre-wrap'}}>{aiResult}</div>}
      </div>

      {/* Modals */}
      {showForm&&(<div style={{position:'fixed',inset:0,background:'rgba(28,30,38,0.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:100}} onClick={()=>setShowForm(false)}>
        <div className="xj-panel" style={{padding:'32px 36px',maxWidth:480,width:'90%'}} onClick={e=>e.stopPropagation()}>
          <h3 style={{fontSize:'0.9375rem',color:'#DA1E2B',margin:'0 0 20px',fontFamily:'"Noto Serif SC",serif'}}>新建内容</h3>
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            <select value={form.platform} onChange={e=>setForm({...form,platform:e.target.value})} style={{background:'#FFFFFF',border:'1px solid rgba(218,30,43,0.15)',color:'#2A2E37',padding:'8px 12px',fontSize:'0.8125rem'}}>{Object.entries(PL).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select>
            <input placeholder="标题" value={form.title} onChange={e=>setForm({...form,title:e.target.value})} style={{background:'#FFFFFF',border:'1px solid rgba(218,30,43,0.15)',color:'#2A2E37',padding:'8px 12px',fontSize:'0.8125rem'}} />
            <TipTapEditor value={form.body} onChange={(html)=>setForm({...form,body:html})} />
            <input placeholder="配图URL" value={form.mediaUrls} onChange={e=>setForm({...form,mediaUrls:e.target.value})} style={{background:'#FFFFFF',border:'1px solid rgba(218,30,43,0.15)',color:'#2A2E37',padding:'8px 12px',fontSize:'0.8125rem'}} />
            <input type="datetime-local" value={form.scheduledAt} onChange={e=>setForm({...form,scheduledAt:e.target.value})} style={{background:'#FFFFFF',border:'1px solid rgba(218,30,43,0.15)',color:'#2A2E37',padding:'8px 12px',fontSize:'0.8125rem'}} />
            {/* 平台适配检查 */}
            {(() => {
              const rule = PLATFORM_RULES.find((r) => r.platform === PL[form.platform])
              const bodyLen = form.body.replace(/<[^>]*>/g, ' ').length
              const lenOk = rule?.rules.some((r) => /字数|正文|时长/.test(r))
              return (
                <div style={{ background: 'rgba(218,30,43,0.04)', border: '1px solid rgba(218,30,43,0.1)', borderRadius: 8, padding: '10px 12px', fontSize: '0.625rem', color: '#6B6258', lineHeight: 1.9 }}>
                  <div style={{ color: '#DA1E2B', fontFamily: '"Noto Serif SC",serif', marginBottom: 4 }}>平台适配 · {PL[form.platform]}</div>
                  <div>当前正文约 <b style={{ color: lenOk ? '#2A2E37' : '#DA1E2B' }}>{bodyLen}</b> 字</div>
                  {rule && rule.rules.slice(0, 3).map((r, i) => (<div key={i}>· {r}</div>))}
                </div>
              )
            })()}
          </div>
          <div style={{display:'flex',gap:10,marginTop:20,justifyContent:'flex-end'}}>
            <button onClick={()=>setShowForm(false)} style={{background:'transparent',color:'#8a8578',border:'1px solid rgba(218,30,43,0.2)',padding:'8px 20px',fontSize:'0.75rem',cursor:'pointer'}}>取消</button>
            <button className="xj-btn" style={{padding:'8px 24px',fontSize:'0.75rem'}} onClick={handleCreate}>保存草稿</button>
          </div>
        </div>
      </div>)}

      {reviewTarget&&(<div style={{position:'fixed',inset:0,background:'rgba(28,30,38,0.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:100}} onClick={()=>setReviewTarget(null)}>
        <div className="xj-panel" style={{padding:'32px 36px',maxWidth:520,width:'90%'}} onClick={e=>e.stopPropagation()}>
          <h3 style={{fontSize:'0.9375rem',color:'#DA1E2B',margin:'0 0 8px',fontFamily:'"Noto Serif SC",serif'}}>朱批校对</h3>
          <p style={{fontSize:'0.6875rem',color:'#6B6258',margin:'0 0 20px'}}>[{PL[reviewTarget.platform]}] {reviewTarget.title}</p>
          <div style={{background:'rgba(218,30,43,0.06)',border:'1px solid rgba(218,30,43,0.1)',padding:'12px 14px',marginBottom:16,fontSize:'0.75rem',color:'#8a8578',lineHeight:1.7,maxHeight:160,overflow:'auto'}}>{(reviewTarget.body||'(无正文)').replace(/<[^>]*>/g,' ')}</div>
          <textarea id="review-note" placeholder="朱批意见" rows={3} style={{width:'100%',background:'#FFFFFF',border:'1px solid rgba(218,30,43,0.15)',color:'#2A2E37',padding:'10px 14px',fontSize:'0.8125rem',resize:'vertical',marginBottom:16}} />
          <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
            <button onClick={()=>handleReview('reject')} style={{background:'transparent',color:'#c9a96e',border:'1px solid rgba(218,30,43,0.3)',padding:'8px 20px',fontSize:'0.75rem',cursor:'pointer'}}>驳回</button>
            <button className="xj-btn" style={{padding:'8px 24px',fontSize:'0.75rem'}} onClick={()=>handleReview('approve')}>通过·排期到Postiz</button>
          </div>
        </div>
      </div>)}
    </div>
  )
}
