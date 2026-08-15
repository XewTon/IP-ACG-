import { useState, useRef, useEffect, useCallback } from 'react'
import { Bot, X, Send, Zap, Loader2 } from 'lucide-react'

// page-agent 通过 CDN script 暴露到 window.PageAgent
declare global {
  interface Window {
    PageAgent: any
  }
}

interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
}

const QUICK_COMMANDS = [
  { icon: '📝', label: '决策：沈砚30天表现', prompt: '打开AI助手页面，或直接分析：分析最近30天沈砚表现' },
  { icon: '🎯', label: '决策：生日活动方案', prompt: '设计沈砚生日活动方案，包含主题、用户群体、宣传渠道、预期效果' },
  { icon: '📊', label: '驾驶舱：查看健康指数', prompt: '切换到驾驶舱首页，找到IP健康指数、热度趋势和角色排名' },
  { icon: '✅', label: 'IP审核：检查内容调性', prompt: '切换到内容运营页面，对照IP规范检查世界观一致性与禁用表达' },
  { icon: '👥', label: '社区：用户反馈总结', prompt: '切换到社区页面，总结最近用户反馈的正负面评价' },
]

export default function AiCopilot() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: '你好！我是玄策 AI 运营助手（Page-Agent 操控层）。\n\n复杂决策请打开「AI助手」全页决策台；我可以帮你：\n🎯 跳转驾驶舱 / 角色分析 / 内容页\n📝 在页面上定位指标与内容\n✅ 辅助 IP 调性检查\n\n也可直接使用下方快捷指令。' },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [agentReady, setAgentReady] = useState(false)
  const [apiKeyMissing, setApiKeyMissing] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const agentRef = useRef<any>(null)

  // 初始化 page-agent
  useEffect(() => {
    let cancelled = false

    const initAgent = async () => {
      try {
        const res = await fetch('/api/agent/config')
        const cfg = await res.json()
        if (cancelled) return
        const apiKey: string = cfg.apiKey || ''
        const model: string = cfg.model || 'qwen-turbo'
        if (!apiKey) {
          setApiKeyMissing(true)
          return
        }

        // 动态加载 page-agent CDN
        if (!window.PageAgent) {
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement('script')
            script.src = 'https://cdn.jsdelivr.net/npm/page-agent@1.12.2/dist/iife/page-agent.demo.js'
            script.crossOrigin = 'anonymous'
            script.onload = () => resolve()
            script.onerror = () => reject(new Error('page-agent CDN 加载失败'))
            document.head.appendChild(script)
          })
        }
        if (cancelled) return

        const { PageAgent } = window
        const agent = new PageAgent({
          model,
          baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
          apiKey,
          language: 'zh-CN',
        })
        agentRef.current = agent
        setAgentReady(true)
        setApiKeyMissing(false)
      } catch (e) {
        console.error('PageAgent init failed:', e)
        setAgentReady(false)
      }
    }

    if (open) {
      initAgent()
    }
    return () => { cancelled = true }
  }, [open])

  // 滚动到最新消息
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = useCallback(async (text?: string) => {
    const msg = text || input
    if (!msg.trim() || loading) return

    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: msg }])
    setLoading(true)

    try {
      if (agentRef.current && agentReady) {
        // 使用 page-agent 执行自然语言指令
        const result = await agentRef.current.execute(msg)
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
        }])
      } else {
        // 降级：使用后端 API 的简单对话
        const res = await fetch('/api/agent/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: msg }),
        })
        const data = await res.json()
        setMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
      }
    } catch (e: any) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `抱歉，执行出错了：${e.message || '未知错误'}\n\n请检查 API Key 配置或网络连接。`,
      }])
    } finally {
      setLoading(false)
    }
  }, [input, loading, agentReady])

  return (
    <>
      {/* 右下角浮动按钮 */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-ink-800 text-white rounded-full shadow-lg hover:bg-ink-700 hover:scale-105 transition-all flex items-center justify-center group"
          title="AI 运营助手"
        >
          <Bot size={24} />
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-vermilion-400 rounded-full border-2 border-white animate-pulse" />
        </button>
      )}

      {/* 聊天面板 */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-96 h-[560px] bg-white rounded-2xl shadow-2xl border border-ink-200 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-ink-100 bg-gradient-to-r from-ink-800 to-ink-700 text-white">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white/15 rounded-lg flex items-center justify-center">
                <Bot size={18} />
              </div>
              <div>
                <div className="text-sm font-semibold">AI 运营助手</div>
                <div className="text-[10px] text-ink-300">
                  {agentReady ? 'Page-Agent + Qwen 已就绪' : apiKeyMissing ? '未配置 API Key' : '初始化中...'}
                </div>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="text-ink-300 hover:text-white transition-colors">
              <X size={18} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-ink-50">
            {apiKeyMissing && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
                <p className="font-medium mb-1">未配置 DashScope API Key</p>
                <p>请在设置页面配置通义千问 API Key 后使用 AI 助手。</p>
                <a href="/settings" className="text-amber-900 underline mt-1 inline-block">前往设置 →</a>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'bg-ink-800 text-white rounded-br-md'
                    : m.role === 'system'
                    ? 'bg-ink-100 text-ink-500 text-xs italic'
                    : 'bg-white border border-ink-200 text-ink-700 rounded-bl-md shadow-sm'
                }`}>
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border border-ink-200 rounded-xl rounded-bl-md px-4 py-3 shadow-sm">
                  <Loader2 size={18} className="animate-spin text-ink-400" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Commands */}
          {messages.length <= 1 && (
            <div className="px-4 py-2 border-t border-ink-100 bg-white">
              <p className="text-[10px] text-ink-400 mb-2 flex items-center gap-1">
                <Zap size={10} /> 快捷指令
              </p>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_COMMANDS.map((cmd, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(cmd.prompt)}
                    disabled={loading || apiKeyMissing}
                    className="text-xs px-2.5 py-1.5 bg-ink-50 border border-ink-200 rounded-lg hover:bg-ink-100 disabled:opacity-40 transition-colors text-left"
                  >
                    {cmd.icon} {cmd.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="p-3 border-t border-ink-100 bg-white">
            <div className="flex gap-2">
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                placeholder={apiKeyMissing ? '请先在设置中配置 API Key' : '输入指令，如：帮我查看今日数据...'}
                disabled={apiKeyMissing}
                className="flex-1 border border-ink-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ink-400 disabled:bg-ink-50 disabled:text-ink-400"
              />
              <button
                onClick={() => handleSend()}
                disabled={loading || !input.trim() || apiKeyMissing}
                className="w-9 h-9 bg-ink-800 text-white rounded-lg flex items-center justify-center hover:bg-ink-700 disabled:opacity-40 transition-colors"
              >
                <Send size={15} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
