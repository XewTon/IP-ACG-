import { useState, useEffect } from 'react'
import { Key, Save, Check, Eye, EyeOff, Users, Sparkles, Trash2 } from 'lucide-react'

export default function Settings() {
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('qwen-turbo')
  const [configured, setConfigured] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [figParticles, setFigParticles] = useState(() => localStorage.getItem('bg_figure_particles') !== '0')
  const [envParticles, setEnvParticles] = useState(() => localStorage.getItem('bg_env_particles') !== '0')

  useEffect(() => {
    fetch('/api/agent/config')
      .then(r => r.json())
      .then((cfg: { configured: boolean; model: string }) => {
        setConfigured(cfg.configured)
        setModel(cfg.model || 'qwen-turbo')
      })
      .catch(() => {})
  }, [])

  const toggleSetting = (key: string, value: boolean) => {
    localStorage.setItem(key, value ? '1' : '0')
    window.dispatchEvent(new Event('bgfx-changed'))
  }

  const handleSave = async () => {
    if (!apiKey.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/agent/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: apiKey.trim(), model }),
      })
      if (!res.ok) throw new Error(await res.text())
      setConfigured(true)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e: any) {
      alert(`保存失败：${e.message || '未知错误'}`)
    } finally {
      setSaving(false)
    }
  }

  const handleClear = async () => {
    if (!confirm('确定清除已保存的 API Key？')) return
    try {
      const res = await fetch('/api/agent/config', { method: 'DELETE' })
      if (!res.ok) throw new Error('HTTP ' + res.status)
      setApiKey('')
      setConfigured(false)
    } catch (e: any) {
      alert('清除失败：' + (e?.message || e))
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h2 className="text-xl font-bold text-ink-800 mb-2">设置</h2>
      <p className="text-sm text-ink-500 mb-6">配置 AI 助手所需的 API Key 和模型参数</p>

      {/* API Key */}
      <div className="bg-white rounded-xl border border-ink-200 p-6 mb-4">
        <div className="flex items-center gap-2 mb-4">
          <Key size={18} className="text-ink-500" />
          <h3 className="font-semibold text-ink-800">DashScope API Key</h3>
        </div>

        <label className="text-xs text-ink-500 block mb-1.5">
          通义千问 API Key{configured && <span className="ml-2 text-green-600">已配置（存储于后端）</span>}
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxx"
              className="w-full border border-ink-200 rounded-lg px-3 py-2.5 pr-10 text-sm font-mono focus:outline-none focus:border-ink-400"
            />
            <button
              onClick={() => setShowKey(!showKey)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600"
            >
              {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
        <p className="text-xs text-ink-400 mt-2">
          前往 <a href="https://dashscope.console.aliyun.com/apiKey" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">阿里云 DashScope 控制台</a> 获取 API Key。Key 保存在后端本地文件，不再写入浏览器 localStorage。
        </p>
        {configured && (
          <button
            onClick={handleClear}
            className="mt-3 flex items-center gap-1.5 text-xs text-ink-400 hover:text-vermilion-500 transition-colors"
          >
            <Trash2 size={13} /> 清除已保存的 Key
          </button>
        )}
      </div>

      {/* Model Selection */}
      <div className="bg-white rounded-xl border border-ink-200 p-6 mb-6">
        <h3 className="font-semibold text-ink-800 mb-4">模型选择</h3>

        <div className="space-y-3">
          {[
            { value: 'qwen-turbo', label: 'Qwen-Turbo (免费)', desc: 'DashScope·完全免费，速度最快，适合日常对话', price: '免费 · 200万tokens/月' },
            { value: 'qwen-plus', label: 'Qwen-Plus', desc: 'DashScope·能力更强，适合复杂数据分析', price: '新用户免费100万tokens/月' },
            { value: 'qwen-max', label: 'Qwen-Max', desc: 'DashScope·最强模型', price: '按量付费' },
            { value: 'glm-4.5', label: 'GLM-4.5 (智谱)', desc: '智谱·当前项目已配置的真实可用模型', price: '按量付费' },
            { value: 'glm-4-flash', label: 'GLM-4-Flash (智谱·免费)', desc: '智谱·免费档，适合高频对话', price: '免费' },
          ].map(opt => (
            <label
              key={opt.value}
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                model === opt.value
                  ? 'border-ink-800 bg-ink-50'
                  : 'border-ink-200 hover:border-ink-300'
              }`}
            >
              <input
                type="radio"
                name="model"
                value={opt.value}
                checked={model === opt.value}
                onChange={e => setModel(e.target.value)}
                className="mt-0.5"
              />
              <div>
                <div className="text-sm font-medium text-ink-800">{opt.label}</div>
                <div className="text-xs text-ink-500 mt-0.5">{opt.desc}</div>
                <div className="text-[10px] text-ink-400 mt-0.5">{opt.price}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Background Particles */}
      <div className="bg-white rounded-xl border border-ink-200 p-6 mb-4">
        <h3 className="font-semibold text-ink-800 mb-1">背景粒子</h3>
        <p className="text-xs text-ink-500 mb-4">人物粒子基于官方海报像素渲染，作为页面主视觉背景</p>

        <div className="space-y-3">
          <label className="flex items-center justify-between gap-3 p-3 rounded-lg border border-ink-200 hover:border-ink-300 cursor-pointer">
            <div className="flex items-center gap-3">
              <Users size={18} className="text-ink-500 shrink-0" />
              <div>
                <div className="text-sm font-medium text-ink-800">人物粒子</div>
                <div className="text-xs text-ink-500 mt-0.5">海报人物轮廓粒子 · 鼠标交互</div>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={figParticles}
              onClick={() => { setFigParticles(!figParticles); toggleSetting('bg_figure_particles', !figParticles) }}
              className={`relative w-11 h-6 rounded-full transition-colors ${figParticles ? 'bg-ink-800' : 'bg-ink-200'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${figParticles ? 'translate-x-5' : ''}`} />
            </button>
          </label>

          <label className="flex items-center justify-between gap-3 p-3 rounded-lg border border-ink-200 hover:border-ink-300 cursor-pointer">
            <div className="flex items-center gap-3">
              <Sparkles size={18} className="text-ink-500 shrink-0" />
              <div>
                <div className="text-sm font-medium text-ink-800">环境粒子</div>
                <div className="text-xs text-ink-500 mt-0.5">月光尘埃 · 灵气 · 落花 · 天气</div>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={envParticles}
              onClick={() => { setEnvParticles(!envParticles); toggleSetting('bg_env_particles', !envParticles) }}
              className={`relative w-11 h-6 rounded-full transition-colors ${envParticles ? 'bg-ink-800' : 'bg-ink-200'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${envParticles ? 'translate-x-5' : ''}`} />
            </button>
          </label>
        </div>
      </div>

      {/* Save */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving || !apiKey.trim()}
          className="flex items-center gap-2 px-6 py-2.5 bg-ink-800 text-white rounded-lg text-sm hover:bg-ink-700 disabled:opacity-40 transition-colors"
        >
          {saved ? <Check size={16} /> : <Save size={16} />}
          {saved ? '已保存' : saving ? '保存中...' : '保存配置'}
        </button>
        {configured && (
          <span className="text-xs text-ink-400">当前模型：{model}</span>
        )}
      </div>

      {/* How to use */}
      <div className="mt-8 p-5 bg-ink-50 rounded-xl border border-ink-200">
        <h4 className="text-sm font-semibold text-ink-700 mb-3">Page-Agent 使用说明</h4>
        <div className="text-xs text-ink-600 space-y-2 leading-relaxed">
          <p><strong>1. 配置 API Key</strong> — 在阿里云 DashScope 开通服务并获取 Key</p>
          <p><strong>2. 打开 AI 助手</strong> — 点击右下角机器人图标</p>
          <p><strong>3. 输入自然语言指令</strong> — 例如：</p>
          <ul className="list-disc list-inside pl-2 space-y-1 text-ink-500">
            <li>"帮我在数据看板页面找到全网粉丝总数"</li>
            <li>"切换到竞品监控页面，告诉我竞品A的粉丝数"</li>
            <li>"帮我在内容排程中查看所有待发布的内容"</li>
          </ul>
          <p className="mt-2"><strong>Page-Agent 工作原理</strong>：读取当前页面 DOM → 发送给 Qwen 模型分析 → 模型返回操作指令 → 自动执行点击/输入等操作</p>
          <p className="text-ink-400 mt-2">基于 <a href="https://github.com/alibaba/page-agent" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">alibaba/page-agent</a> 开源项目构建</p>
        </div>
      </div>
    </div>
  )
}
