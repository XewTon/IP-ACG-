// 九歌 · 数据仪表盘 —— 四维指标 + 竞品 + AI周报
import { useEffect, useState } from 'react'

interface Metrics {content:Record<string,{value:number;change:string}>;user:Record<string,{value:number;change:string}>;supply:Record<string,{value:number;change:string}>;ipHealth:Record<string,any>}
interface Competitor {name:string;platform:string;followers:number;growth:string;strategy:string;threat:string}

export default function Dashboard() {
  const [metrics,setMetrics]=useState<Metrics|null>(null)
  const [competitors,setCompetitors]=useState<Competitor[]>([])
  const [report,setReport]=useState('')

  useEffect(()=>{
    fetch('/api/dashboard/metrics').then(r=>r.json()).then(setMetrics)
    fetch('/api/dashboard/competitors').then(r=>r.json()).then(d=>setCompetitors(d.data))
  },[])

  const genReport=async()=>{
    const r=await fetch('/api/dashboard/weekly-report');const d=await r.json();setReport(d.content)
  }

  if(!metrics)return <div style={{padding:'48px 32px',color:'#8a8578'}}>加载中...</div>

  const MetricBox=({label,value,change}:{label:string;value:number;change:string})=>(
    <div className="xj-panel" style={{padding:'16px 18px'}}>
      <div style={{fontSize:'0.625rem',color:'#6B6258',marginBottom:4}}>{label}</div>
      <div style={{fontSize:'1.25rem',fontWeight:700,color:'#e8e0d0',fontFamily:'"Noto Serif SC",serif'}}>{typeof value==='number'&&value<100?value+'%':value.toLocaleString()}</div>
      <div style={{fontSize:'0.625rem',color:change.startsWith('+')?'#6a8a6a':'#c9a96e',marginTop:2}}>{change}</div>
    </div>
  )

  return (
    <div style={{maxWidth:960,margin:'0 auto',padding:'48px 32px'}}>
      <h2 className="xj-section-title" style={{padding:'0 0 6px',margin:0}}>数据仪表盘</h2>
      <p style={{fontSize:'0.625rem',color:'#6B6258',margin:'0 0 28px'}}>四维指标：内容 · 用户 · 供应链 · IP健康</p>

      {/* 内容指标 */}
      <h3 style={{fontSize:'0.75rem',color:'#C89B3C',marginBottom:10,fontFamily:'"Noto Serif SC",serif'}}>内容指标</h3>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:24}}>
        {Object.entries(metrics.content).map(([k,v])=><MetricBox key={k} label={{exposure:'曝光量',clickRate:'点击率',engagementRate:'互动率',shareRate:'转发率'}[k]||k} value={v.value} change={v.change} />)}
      </div>

      {/* 用户指标 */}
      <h3 style={{fontSize:'0.75rem',color:'#C89B3C',marginBottom:10,fontFamily:'"Noto Serif SC",serif'}}>用户指标</h3>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:24}}>
        {Object.entries(metrics.user).map(([k,v])=><MetricBox key={k} label={{totalFollowers:'全网粉丝',activeUsers:'周活跃用户',communityParticipation:'社群参与'}[k]||k} value={v.value} change={v.change} />)}
      </div>

      {/* 供应链指标 */}
      <h3 style={{fontSize:'0.75rem',color:'#C89B3C',marginBottom:10,fontFamily:'"Noto Serif SC",serif'}}>供应链指标</h3>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:24}}>
        {Object.entries(metrics.supply).map(([k,v])=><MetricBox key={k} label={{onTimeDelivery:'按时交付率',avgRevisions:'平均修改轮次',costControl:'成本控制率'}[k]||k} value={v.value} change={v.change} />)}
      </div>

      {/* IP健康 */}
      <h3 style={{fontSize:'0.75rem',color:'#C89B3C',marginBottom:10,fontFamily:'"Noto Serif SC",serif'}}>IP 健康</h3>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:24}}>
        <MetricBox label="用户喜爱度" value={metrics.ipHealth.userLove.value} change={metrics.ipHealth.userLove.change} />
        <MetricBox label="品牌一致性" value={metrics.ipHealth.brandConsistency.value} change={metrics.ipHealth.brandConsistency.change} />
        <div className="xj-panel" style={{padding:'16px 18px'}}>
          <div style={{fontSize:'0.625rem',color:'#6B6258',marginBottom:4}}>角色热度</div>
          {Object.entries(metrics.ipHealth.characterHeat as Record<string,number>).map(([k,v])=>(
            <div key={k} style={{display:'flex',justifyContent:'space-between',fontSize:'0.6875rem',color:'#8a8578',marginTop:2}}><span>{k}</span><span style={{color:'#C89B3C'}}>{v}</span></div>
          ))}
        </div>
        <div className="xj-panel" style={{padding:'16px 18px'}}>
          <div style={{fontSize:'0.625rem',color:'#6B6258',marginBottom:4}}>内容生命周期</div>
          <div style={{fontSize:'1.25rem',fontWeight:700,color:'#e8e0d0',fontFamily:'"Noto Serif SC",serif'}}>{metrics.ipHealth.contentLifecycle.value}天</div>
        </div>
      </div>

      {/* 竞品 */}
      <h3 style={{fontSize:'0.75rem',color:'#C89B3C',marginBottom:10,fontFamily:'"Noto Serif SC",serif'}}>竞品动态</h3>
      <div className="xj-panel" style={{marginBottom:24}}>
        <div style={{display:'grid',gridTemplateColumns:'1fr 0.6fr 0.6fr 0.5fr 1fr 0.5fr',padding:'8px 18px',borderBottom:'1px solid rgba(200,155,60,0.12)',fontSize:'0.625rem',color:'#6B6258'}}><span>IP</span><span>平台</span><span>粉丝</span><span>增长</span><span>策略</span><span>威胁</span></div>
        {competitors.map((c,i)=>(
          <div key={i} style={{display:'grid',gridTemplateColumns:'1fr 0.6fr 0.6fr 0.5fr 1fr 0.5fr',padding:'12px 18px',fontSize:'0.75rem',alignItems:'center',borderBottom:i<competitors.length-1?'1px solid rgba(200,155,60,0.04)':'none',background:c.threat==='medium'?'rgba(200,155,60,0.03)':'transparent'}}>
            <span style={{color:'#e8e0d0',fontWeight:500}}>{c.name}</span>
            <span style={{color:'#8a8578'}}>{c.platform}</span>
            <span style={{color:'#e8e0d0'}}>{c.followers.toLocaleString()}</span>
            <span style={{color:c.growth.startsWith('+')?'#6a8a6a':'#c9a96e'}}>{c.growth}</span>
            <span style={{color:'#8a8578',fontSize:'0.6875rem'}}>{c.strategy}</span>
            <span style={{color:c.threat==='medium'?'#C89B3C':'#6B6258',fontSize:'0.625rem'}}>{c.threat==='medium'?'⚠ 关注':'正常'}</span>
          </div>
        ))}
      </div>

      {/* AI周报 */}
      <div style={{display:'flex',gap:10,alignItems:'center',marginBottom:16}}>
        <h3 style={{fontSize:'0.75rem',color:'#C89B3C',margin:0,fontFamily:'"Noto Serif SC",serif'}}>AI 运营周报</h3>
        <button className="xj-btn" style={{padding:'6px 16px',fontSize:'0.625rem'}} onClick={genReport}>生成周报</button>
      </div>
      {report&&<div className="xj-panel" style={{padding:20,fontSize:'0.6875rem',color:'#8a8578',lineHeight:1.8,whiteSpace:'pre-wrap'}}>{report}</div>}

      <p style={{fontSize:'0.5625rem',color:'#4a4540',paddingTop:24}}>数据仪表盘对接 Metabase 风格极简图表 · 竞品扫描由 competitor-scan 每周一自动触发 · 周报由 analyze-data Skill 生成</p>
    </div>
  )
}
