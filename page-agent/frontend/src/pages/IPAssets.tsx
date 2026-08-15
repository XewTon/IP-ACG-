// 玄策 · IP资产中心 —— 数据来自后端，支持增删改
import { useEffect, useState } from 'react'
import { getCurrentIpAssets, type IpAssetsPayload, deleteCharacter, createCharacter, updateCharacter } from '../api'

export default function IPAssets() {
  const [data, setData] = useState<IpAssetsPayload | null>(null)
  const [selChar, setSelChar] = useState(0)
  const [err, setErr] = useState('')
  const [ipId, setIpId] = useState<number>(0)
  const [showAdd, setShowAdd] = useState(false)
  const [editId, setEditId] = useState<number>(0)
  const [form, setForm] = useState({ name:'', role:'', tag:'', keywords:'', description:'', assets:'' })

  const fetchData = () => {
    getCurrentIpAssets().then((d) => { setData(d); setSelChar(0); setIpId(d.ip.id) }).catch((e) => setErr(String(e.message || e)))
  }
  useEffect(() => { fetchData() }, [])

  const handleSave = async () => {
    if (!form.name) return
    if (editId) { await updateCharacter(editId, form); setEditId(0) }
    else await createCharacter(ipId, form)
    setShowAdd(false); setForm({ name:'', role:'', tag:'', keywords:'', description:'', assets:'' }); fetchData()
  }

  const openEdit = (ch: any) => {
    setForm({ name:ch.name, role:ch.role, tag:ch.tag, keywords:ch.keywords, description:ch.description, assets:ch.assets })
    setEditId(ch.id); setShowAdd(true)
  }

  if (err) return <div style={{ padding: '48px 32px', color: '#c9a96e' }}>加载失败：{err}</div>
  if (!data) return <div style={{ padding: '48px 32px', color: '#8a8578' }}>加载 IP 资产...</div>

  const characters = data.characters; const ch = characters[selChar]

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '48px 32px' }}>
      <h2 className="xj-section-title" style={{ padding: '0 0 6px', margin: 0 }}>IP 资产中心</h2>
      <p style={{ fontSize: '0.625rem', color: '#6B6258', margin: '0 0 8px' }}>{data.ip.name} · {data.ip.type} · 上线 {data.ip.launch_date}</p>
      <p style={{ fontSize: '0.625rem', color: '#8a8578', margin: '0 0 20px' }}>目标用户：{data.ip.target_users} · 商业价值 {data.ip.commercial_score}</p>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h3 style={{ fontSize: '0.75rem', color: '#DA1E2B', margin: 0, fontFamily: '"Noto Serif SC",serif' }}>角色资产库</h3>
        <button onClick={() => { setEditId(0); setForm({ name:'', role:'', tag:'', keywords:'', description:'', assets:'' }); setShowAdd(true) }} className="xj-btn" style={{ padding: '5px 14px', fontSize: '0.625rem' }}>+ 添加角色</button>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {characters.map((c, i) => (
          <button key={c.id} onClick={() => setSelChar(i)} style={{ background: selChar === i ? 'rgba(218,30,43,0.12)' : 'transparent', color: selChar === i ? '#DA1E2B' : '#8a8578', border: '1px solid rgba(218,30,43,0.15)', padding: '4px 16px', fontSize: '0.75rem', cursor: 'pointer', fontFamily: '"Noto Sans SC",sans-serif' }}>{c.name}</button>
        ))}
      </div>

      {ch && (
        <div className="xj-panel" style={{ padding: 24, marginBottom: 28 }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            <span className="xj-initial" style={{ fontSize: '2rem', width: 'auto' }}>{ch.name[0]}</span>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
                <span style={{ fontSize: '1rem', fontWeight: 700, color: '#2A2E37', fontFamily: '"Noto Serif SC",serif' }}>{ch.name}</span>
                <span style={{ fontSize: '0.6875rem', color: '#DA1E2B' }}>{ch.role}</span>
                <span style={{ fontSize: '0.625rem', color: '#6B6258', border: '1px solid rgba(218,30,43,0.15)', padding: '1px 8px' }}>{ch.tag}</span>
                <button onClick={() => openEdit(ch)} style={{ background:'none', border:'none', color:'#DA1E2B', cursor:'pointer', fontSize:'0.625rem', marginLeft:'auto' }}>编辑</button>
                <button onClick={async () => { if (confirm(`删除角色 ${ch.name}？`)) { await deleteCharacter(ch.id); fetchData() } }} style={{ background:'none', border:'none', color:'#6B6258', cursor:'pointer', fontSize:'0.625rem' }}>删除</button>
              </div>
              <p style={{ fontSize: '0.75rem', color: '#8a8578', lineHeight: 1.6, margin: '0 0 8px' }}>{ch.description}</p>
              <div style={{ fontSize: '0.6875rem', color: '#6B6258', marginBottom: 16 }}>关键词：{ch.keywords} | 素材：{ch.assets} | 商业价值：{ch.commercial_value}</div>
              <div style={{ borderTop: '1px solid rgba(218,30,43,0.1)', paddingTop: 14 }}>
                <div style={{ fontSize: '0.6875rem', color: '#DA1E2B', marginBottom: 8 }}>版本历史</div>
                {ch.versions.map((v, i) => (
                  <div key={i} style={{ display: 'flex', gap: 12, padding: '6px 0', fontSize: '0.6875rem', borderBottom: i < ch.versions.length - 1 ? '1px solid rgba(218,30,43,0.04)' : 'none' }}>
                    <span style={{ color: '#DA1E2B', width: 110, flexShrink: 0 }}>{v.version}</span>
                    <span style={{ color: '#6B6258', width: 50, flexShrink: 0 }}>{v.date}</span>
                    <span style={{ color: '#8a8578' }}>{v.description}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <h3 style={{ fontSize: '0.75rem', color: '#DA1E2B', marginBottom: 12, fontFamily: '"Noto Serif SC",serif' }}>世界观时间线</h3>
      <div className="xj-panel" style={{ padding: 16, marginBottom: 28 }}>
        {data.lore.map((t, i) => (
          <div key={i} style={{ display: 'flex', gap: 14, padding: '10px 8px', borderBottom: i < data.lore.length - 1 ? '1px solid rgba(218,30,43,0.06)' : 'none' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#DA1E2B', width: 60, flexShrink: 0, fontFamily: '"Noto Serif SC",serif' }}>{t.date_label}</span>
            <span style={{ fontSize: '0.75rem', color: '#8a8578' }}>{t.event}</span>
          </div>
        ))}
      </div>

      <h3 style={{ fontSize: '0.75rem', color: '#DA1E2B', marginBottom: 12, fontFamily: '"Noto Serif SC",serif' }}>IP 规范中心</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
        {data.rules.map((r, i) => (
          <div key={i} className="xj-panel" style={{ padding: 18 }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 500, color: '#DA1E2B', marginBottom: 10 }}>{r.category}</div>
            {r.items.map((item, j) => (<div key={j} style={{ fontSize: '0.6875rem', color: '#8a8578', lineHeight: 1.7, marginBottom: 4 }}>· {item}</div>))}
          </div>
        ))}
      </div>

      {/* 添加/编辑角色 Modal */}
      {showAdd && (
        <div style={{ position:'fixed',inset:0,background:'rgba(28,30,38,0.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:100 }} onClick={()=>setShowAdd(false)}>
          <div className="xj-panel" style={{ padding:'28px 32px',maxWidth:420,width:'90%' }} onClick={e=>e.stopPropagation()}>
            <h3 style={{ fontSize:'0.9375rem',color:'#DA1E2B',margin:'0 0 16px',fontFamily:'"Noto Serif SC",serif' }}>{editId ? '编辑角色' : '添加角色'}</h3>
            <div style={{ display:'flex',flexDirection:'column',gap:10 }}>
              {[{k:'name',l:'名称'},{k:'role',l:'身份定位'},{k:'tag',l:'标签'},{k:'keywords',l:'关键词'},{k:'description',l:'描述'},{k:'assets',l:'已有素材'}].map(({k,l})=>(
                <input key={k} placeholder={l} value={(form as any)[k]} onChange={e=>setForm({...form,[k]:e.target.value})}
                  style={{ background:'#FFFFFF',border:'1px solid rgba(218,30,43,0.15)',color:'#2A2E37',padding:'8px 12px',fontSize:'0.8125rem',fontFamily:'"Noto Sans SC",sans-serif' }} />
              ))}
            </div>
            <div style={{ display:'flex',gap:10,marginTop:16,justifyContent:'flex-end' }}>
              <button onClick={()=>setShowAdd(false)} style={{ background:'transparent',color:'#8a8578',border:'1px solid rgba(218,30,43,0.2)',padding:'8px 20px',fontSize:'0.75rem',cursor:'pointer' }}>取消</button>
              <button className="xj-btn" style={{ padding:'8px 24px',fontSize:'0.75rem' }} onClick={handleSave}>{editId ? '保存' : '添加'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
