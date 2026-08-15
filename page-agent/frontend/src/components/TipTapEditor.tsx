/*
 * 玄策 · TipTap 富文本编辑器（复�?tiptap / ProseMirror�? * 用于内容运营正文编辑：标�?加粗/斜体/删除�?列表/引用/撤销
 */
import { useEffect, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Bold, Italic, Strikethrough, Heading1, Heading2, List, ListOrdered, Quote, Undo2, Redo2, Eraser } from 'lucide-react'

interface Props {
  value?: string
  onChange: (html: string) => void
}

interface ToolbarBtnProps {
  label: React.ReactNode
  title: string
  active: boolean
  onClick: () => void
}

function ToolbarButton({ label, title, active, onClick }: ToolbarBtnProps) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      style={{
        background: active ? 'rgba(218,30,43,0.12)' : 'transparent',
        border: '1px solid rgba(218,30,43,0.15)',
        color: active ? '#DA1E2B' : '#8a8578',
        borderRadius: 6,
        padding: '4px 8px',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: '0.625rem',
        fontFamily: '"Noto Sans SC",sans-serif',
      }}
    >
      {label}
    </button>
  )
}

export default function TipTapEditor({ value, onChange }: Props) {
  const onChangeRef = useRef(onChange)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  const editor = useEditor({
    extensions: [StarterKit],
    content: value || '',
    onUpdate: ({ editor }) => onChangeRef.current(editor.getHTML()),
  })

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || '', { emitUpdate: false })
    }
  }, [value, editor])

  if (!editor) return null

  return (
    <div className="xj-tiptap">
      <style>{`
.xj-tiptap .ProseMirror{min-height:130px;outline:none;padding:12px 14px;background:#FFFFFF;border:1px solid rgba(218,30,43,0.15);border-top:none;border-radius:0 0 10px 10px;font-size:0.8125rem;color:#2A2E37;line-height:1.9;font-family:"Noto Sans SC",sans-serif}
.xj-tiptap .ProseMirror p{margin:0.35em 0}
.xj-tiptap .ProseMirror h1{font-size:1.25rem;font-weight:600;margin:0.7em 0 0.35em}
.xj-tiptap .ProseMirror h2{font-size:1.05rem;font-weight:600;margin:0.6em 0 0.3em}
.xj-tiptap .ProseMirror blockquote{border-left:2px solid rgba(218,30,43,0.4);padding-left:10px;color:#6B6258;margin:0.5em 0}
.xj-tiptap .ProseMirror ul,.xj-tiptap .ProseMirror ol{padding-left:1.4em;margin:0.4em 0}
.xj-tiptap .ProseMirror pre{background:rgba(42,46,55,0.06);padding:8px 10px;border-radius:6px;font-size:0.6875rem}
.xj-tiptap .ProseMirror code{font-size:0.75rem}
.xj-tiptap .ProseMirror a{color:#DA1E2B}
.xj-tiptap .ProseMirror hr{border:none;border-top:1px solid rgba(218,30,43,0.2);margin:0.6em 0}
`}</style>
      <div style={{ display: 'flex', gap: 6, padding: '8px 10px', background: '#FFFDF7', border: '1px solid rgba(218,30,43,0.15)', borderBottom: 'none', borderRadius: '10px 10px 0 0', flexWrap: 'wrap' }}>
        <ToolbarButton title="一级标题" label={<Heading1 size={13} />} active={editor.isActive('heading', { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} />
        <ToolbarButton title="二级标题" label={<Heading2 size={13} />} active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} />
        <ToolbarButton title="加粗" label={<Bold size={13} />} active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} />
        <ToolbarButton title="斜体" label={<Italic size={13} />} active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} />
        <ToolbarButton title="删除线" label={<Strikethrough size={13} />} active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()} />
        <ToolbarButton title="无序列表" label={<List size={13} />} active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} />
        <ToolbarButton title="有序列表" label={<ListOrdered size={13} />} active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} />
        <ToolbarButton title="引用" label={<Quote size={13} />} active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()} />
        <ToolbarButton title="清除格式" label={<Eraser size={13} />} active={false} onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()} />
        <div style={{ flex: 1 }} />
        <ToolbarButton title="撤销" label={<Undo2 size={13} />} active={false} onClick={() => editor.chain().focus().undo().run()} />
        <ToolbarButton title="重做" label={<Redo2 size={13} />} active={false} onClick={() => editor.chain().focus().redo().run()} />
      </div>
      <EditorContent editor={editor} />
    </div>
  )
}
