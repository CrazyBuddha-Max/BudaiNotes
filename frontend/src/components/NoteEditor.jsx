import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  Trash2,
  Save,
  Heading2,
  Bold,
  Italic,
  List,
  ListOrdered,
  ListChecks,
  Quote,
  Code,
  SquareCode,
  Link as LinkIcon,
  Image,
  Minus,
  Table,
} from 'lucide-react'
import { HStack } from '@astryxdesign/core/HStack'
import { VStack } from '@astryxdesign/core/VStack'
import { Button } from '@astryxdesign/core/Button'
import { IconButton } from '@astryxdesign/core/IconButton'
import { TextInput } from '@astryxdesign/core/TextInput'
import { Switch } from '@astryxdesign/core/Switch'
import { Card } from '@astryxdesign/core/Card'
import { Grid } from '@astryxdesign/core/Grid'
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl'
import { DropdownMenu } from '@astryxdesign/core/DropdownMenu'
import { Markdown } from '@astryxdesign/core/Markdown'
import { Text } from '@astryxdesign/core/Text'
import { Icon } from '@astryxdesign/core/Icon'
import { useToast } from '@astryxdesign/core/Toast'

import { uploadImage } from '../api'
import MarkdownEditor from './MarkdownEditor'

const MODES = [
  { value: 'edit', label: '编辑' },
  { value: 'split', label: '分栏' },
  { value: 'preview', label: '预览' },
]

function estimateWords(text) {
  const cjk = (text.match(/[\u4e00-\u9fff]/g) || []).length
  const latin = text.replace(/[\u4e00-\u9fff]/g, ' ').trim().split(/\s+/).filter(Boolean).length
  return cjk + latin
}

export default function NoteEditor({ note, onSave, onDelete, onBack, dark = false }) {
  const toast = useToast()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [tags, setTags] = useState([])
  const [tagDraft, setTagDraft] = useState('')
  const [folder, setFolder] = useState('')
  const [pinned, setPinned] = useState(false)
  const [mode, setMode] = useState('split')
  const [saving, setSaving] = useState(false)
  const [savingAuto, setSavingAuto] = useState(false)
  const [autosavedAt, setAutosavedAt] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [recoverable, setRecoverable] = useState(null)

  const viewRef = useRef(null)
  const fileRef = useRef(null)
  const previewRef = useRef(null)
  const autosaveTimer = useRef(null)
  const lastSavedRef = useRef(null)
  const latestPayloadRef = useRef(null)

  const editing = Boolean(note)
  const draftKey = `buda-draft:${note?.id || 'new'}`

  useEffect(() => {
    setTitle(note?.title || '')
    setContent(note?.content || '')
    setTags(
      (note?.tags || '')
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    )
    setTagDraft('')
    setFolder(note?.folder || '')
    setPinned(note?.pinned || false)
    setMode('split')
    setAutosavedAt(null)

    const base = {
      title: note?.title || '',
      content: note?.content || '',
      tags: (note?.tags || '').split(',').map((t) => t.trim()).filter(Boolean),
      folder: note?.folder || '',
      pinned: note?.pinned || false,
    }
    lastSavedRef.current = JSON.stringify(base)

    let raw = null
    try {
      raw = localStorage.getItem(draftKey)
    } catch {}
    if (raw) {
      try {
        const d = JSON.parse(raw)
        const same =
          (d.title || '') === base.title &&
          (d.content || '') === base.content &&
          (Array.isArray(d.tags) ? d.tags : []).join(',') === base.tags.join(',') &&
          (d.folder || '') === base.folder &&
          Boolean(d.pinned) === Boolean(base.pinned)
        if (!same) setRecoverable(d)
      } catch {}
    }
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note])

  useEffect(() => {
    if (!note?.id) return
    const cur = JSON.stringify({ title, content, tags: tags.join(','), folder, pinned })
    latestPayloadRef.current = cur
    if (cur === lastSavedRef.current) return
    if (!recoverable) {
      try {
        localStorage.setItem(
          draftKey,
          JSON.stringify({ title, content, tags, folder, pinned, savedAt: Date.now() }),
        )
      } catch {}
    }
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    autosaveTimer.current = setTimeout(runAutosave, 1500)
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, content, tags, folder, pinned, note?.id])

  useEffect(() => {
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
      if (latestPayloadRef.current === lastSavedRef.current) {
        try {
          localStorage.removeItem(draftKey)
        } catch {}
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        handleSave()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, content, tags, folder, pinned, note, editing])

  const clearDraft = () => {
    try {
      localStorage.removeItem(draftKey)
    } catch {}
  }

  const runAutosave = async () => {
    if (!note?.id) return
    const cur = JSON.stringify({ title, content, tags: tags.join(','), folder, pinned })
    if (cur === lastSavedRef.current) return
    setSavingAuto(true)
    try {
      await onSave({ title, content, tags: tags.join(','), folder, pinned })
      lastSavedRef.current = cur
      setAutosavedAt(new Date())
      setRecoverable(null)
      clearDraft()
    } catch (err) {
      toast({ body: `自动保存失败：${err.message || '网络错误'}`, type: 'error' })
    } finally {
      setSavingAuto(false)
    }
  }

  const applyRecoverable = () => {
    const d = recoverable
    if (!d) return
    setTitle(d.title || '')
    setContent(d.content || '')
    setTags(Array.isArray(d.tags) ? d.tags : [])
    setFolder(d.folder || '')
    setPinned(Boolean(d.pinned))
    lastSavedRef.current = JSON.stringify({
      title: d.title || '',
      content: d.content || '',
      tags: (Array.isArray(d.tags) ? d.tags : []).join(','),
      folder: d.folder || '',
      pinned: Boolean(d.pinned),
    })
    clearDraft()
    setRecoverable(null)
    toast({ body: '已恢复上次的草稿', type: 'info' })
  }

  const discardRecoverable = () => {
    clearDraft()
    setRecoverable(null)
  }

  const addTag = () => {
    const t = tagDraft.trim().replace(/^#/, '')
    if (t && !tags.includes(t)) setTags((prev) => [...prev, t])
    setTagDraft('')
  }

  const handleTagKey = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag()
    } else if (e.key === 'Backspace' && tagDraft === '' && tags.length > 0) {
      setTags((prev) => prev.slice(0, -1))
    }
  }

  const handleSave = async () => {
    if (!title.trim() && !content.trim()) {
      toast({ body: '内容为空，无法保存', type: 'error' })
      return
    }
    setSaving(true)
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    try {
      await onSave({ title, content, tags: tags.join(','), folder, pinned })
      lastSavedRef.current = JSON.stringify({ title, content, tags: tags.join(','), folder, pinned })
      setRecoverable(null)
      clearDraft()
      setAutosavedAt(new Date())
      toast({
        body: note ? '笔记已保存' : '笔记已创建',
        type: 'info',
        uniqueID: note ? `save-${note.id}` : 'create',
      })
      onBack()
    } catch (err) {
      toast({ body: `保存失败：${err.message || '网络错误'}`, type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const insertMarkdown = (builder) => {
    const view = viewRef.current
    if (!view) {
      setContent((prev) => prev + builder('', prev.length).text)
      return
    }
    const { from, to } = view.state.selection.main
    const selected = view.state.sliceDoc(from, to)
    const { text, caret } = builder(selected, from)
    view.dispatch({
      changes: { from, to, insert: text },
      selection: { anchor: caret },
      scrollIntoView: true,
    })
    view.focus()
  }

  const wrap = (a, b, placeholder) => (selected, start) => {
    const inner = selected || placeholder
    return { text: a + inner + b, caret: start + a.length + inner.length }
  }

  const block = (prefix, suffix = '') => (selected, start) => ({
    text: `${start > 0 ? '\n' : ''}${prefix}${selected}${suffix}`,
    caret: start + (start > 0 ? 1 : 0) + prefix.length,
  })

  const insertImageMd = (url, name) =>
    insertMarkdown((_s, start) => {
      const text = `![${name || '图片'}](${url})`
      return { text, caret: start + text.length }
    })

  const handleUpload = async (file) => {
    if (!file) return
    if (!/^image\//.test(file.type)) {
      toast({ body: '请选择图片文件', type: 'error' })
      return
    }
    setUploading(true)
    try {
      const { url, name } = await uploadImage(file)
      insertImageMd(url, name)
      toast({ body: '图片已插入', type: 'info' })
    } catch (err) {
      toast({ body: `上传失败：${err.message}`, type: 'error' })
    } finally {
      setUploading(false)
      fileRef.current.value = ''
    }
  }

  const wordCount = estimateWords(content)
  const minutes = Math.max(1, Math.round(wordCount / 300))

  const editMode = mode !== 'preview'

  const markdownTools = (
    <HStack gap={2} vAlign="center" wrap="wrap" className="buda-md-toolbar">
      <DropdownMenu
        button={{ label: '标题', variant: 'ghost', size: 'sm', icon: <Heading2 size={16} /> }}
        items={[
          { label: '一级标题', onClick: () => insertMarkdown(block('# ')) },
          { label: '二级标题', onClick: () => insertMarkdown(block('## ')) },
          { label: '三级标题', onClick: () => insertMarkdown(block('### ')) },
          { label: '四级标题', onClick: () => insertMarkdown(block('#### ')) },
          { label: '五级标题', onClick: () => insertMarkdown(block('##### ')) },
          { label: '六级标题', onClick: () => insertMarkdown(block('###### ')) },
        ]}
      />
      <IconButton size="sm" variant="ghost" label="粗体" icon={<Bold size={16} />} tooltip="粗体" onClick={() => insertMarkdown(wrap('**', '**', '粗体文本'))} />
      <IconButton size="sm" variant="ghost" label="斜体" icon={<Italic size={16} />} tooltip="斜体" onClick={() => insertMarkdown(wrap('*', '*', '斜体文本'))} />
      <IconButton size="sm" variant="ghost" label="无序列表" icon={<List size={16} />} tooltip="无序列表" onClick={() => insertMarkdown(block('- '))} />
      <IconButton size="sm" variant="ghost" label="有序列表" icon={<ListOrdered size={16} />} tooltip="有序列表" onClick={() => insertMarkdown(block('1. '))} />
      <IconButton size="sm" variant="ghost" label="任务列表" icon={<ListChecks size={16} />} tooltip="任务列表" onClick={() => insertMarkdown(block('- [ ] '))} />
      <IconButton size="sm" variant="ghost" label="引用" icon={<Quote size={16} />} tooltip="引用" onClick={() => insertMarkdown(block('> '))} />
      <IconButton size="sm" variant="ghost" label="行内代码" icon={<Code size={16} />} tooltip="行内代码" onClick={() => insertMarkdown(wrap('`', '`', '代码'))} />
      <IconButton size="sm" variant="ghost" label="代码块" icon={<SquareCode size={16} />} tooltip="代码块" onClick={() => insertMarkdown(block('```\n', '\n```'))} />
      <IconButton size="sm" variant="ghost" label="链接" icon={<LinkIcon size={16} />} tooltip="链接" onClick={() => insertMarkdown((sel, start) => {
        const pick = sel || '链接文字'
        return { text: `[${pick}](https://)`, caret: start + pick.length + 2 }
      })} />
      <IconButton size="sm" variant="ghost" label="表格" icon={<Table size={16} />} tooltip="表格" onClick={() => insertMarkdown(block('| 列1 | 列2 |\n| --- | --- |\n| 内容 | 内容 |\n'))} />
      <IconButton size="sm" variant="ghost" label="分割线" icon={<Minus size={16} />} tooltip="分割线" onClick={() => insertMarkdown((_s, start) => ({ text: `\n---\n`, caret: start + 5 }))} />
      <IconButton size="sm" variant="ghost" label="插入图片" icon={<Image size={16} />} tooltip="插入图片" isLoading={uploading} disabled={uploading} onClick={() => fileRef.current?.click()} />
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => handleUpload(e.target.files[0])}
      />
    </HStack>
  )

  const editorPane = (
    <MarkdownEditor
      value={content}
      onChange={setContent}
      viewRef={viewRef}
      dark={dark}
      placeholderText="# 在这里用 Markdown 记录…"
    />
  )

  const previewPane = (
    <div ref={previewRef} className="buda-md-preview">
      <Markdown headingLevel={2} contentWidth={760}>
        {content || '_（暂无内容）_'}
      </Markdown>
    </div>
  )

  useEffect(() => {
    const host = previewRef.current
    if (!host) return undefined
    const onClick = (e) => {
      const box = e.target.closest('.astryx-checkbox-input')
      if (!box) return
      e.preventDefault()
      e.stopPropagation()
      const boxes = host.querySelectorAll('.astryx-checkbox-input')
      const idx = Array.prototype.indexOf.call(boxes, box)
      if (idx < 0) return
      setContent((prev) => {
        const lines = prev.split('\n')
        let count = -1
        for (let i = 0; i < lines.length; i += 1) {
          const m = lines[i].match(/^(\s*[-*+]) \[([ xX])\]/)
          if (!m) continue
          count += 1
          if (count === idx) {
            const checked = m[2].toLowerCase() === 'x'
            lines[i] = lines[i].replace(
              /^(\s*[-*+]) \[([ xX])\]/,
              `$1 [${checked ? ' ' : 'x'}]`,
            )
            break
          }
        }
        return lines.join('\n')
      })
    }
    host.addEventListener('click', onClick, true)
    return () => host.removeEventListener('click', onClick, true)
  }, [content, mode])

  const editorBody = (
    <VStack gap={0}>
      {markdownTools}
      <div className="buda-md-wrap">{editorPane}</div>
      <div className="buda-statusbar">
        <HStack gap={3} vAlign="center">
          <Text type="supporting" color="secondary">
            {wordCount} 词 · {content.length} 字 · 约 {minutes} 分钟
          </Text>
          <div style={{ flex: 1 }} />
          <Text type="label" color="secondary">
            {savingAuto
              ? '保存中…'
              : autosavedAt
                ? `已自动保存 ${autosavedAt.toLocaleTimeString()}`
                : editing
                  ? '自动保存已开启'
                  : ''}
          </Text>
        </HStack>
      </div>
    </VStack>
  )

  return (
    <VStack gap={4}>
      {recoverable ? (
        <div className="buda-recover-bar">
          <Icon icon="warning" size="sm" color="warning" />
          <Text type="supporting" color="secondary">
            有未保存的草稿（{new Date(recoverable.savedAt).toLocaleTimeString()}）
          </Text>
          <div style={{ flex: 1 }} />
          <Button label="恢复" size="sm" variant="secondary" onClick={applyRecoverable} />
          <IconButton
            label="丢弃草稿"
            size="sm"
            variant="ghost"
            icon={<Trash2 size={14} />}
            onClick={discardRecoverable}
          />
        </div>
      ) : null}

      <HStack gap={3} vAlign="center">
        <IconButton
          label="返回笔记列表"
          variant="ghost"
          icon={<ArrowLeft size={18} />}
          onClick={onBack}
          tooltip="返回"
        />
        <VStack gap={0} style={{ flex: 1, minWidth: 0 }}>
          <TextInput
            label="标题"
            isLabelHidden
            value={title}
            onChange={setTitle}
            placeholder="笔记标题（Markdown 编辑器）…"
            width="100%"
          />
        </VStack>
        <SegmentedControl value={mode} onChange={setMode} label="编辑视图">
          {MODES.map((m) => (
            <SegmentedControlItem key={m.value} label={m.label} value={m.value} />
          ))}
        </SegmentedControl>
        {note ? (
          <Button
            label="删除"
            variant="destructive"
            icon={<Trash2 size={16} />}
            onClick={() => onDelete(note)}
          />
        ) : null}
        <Button
          label={note ? '保存笔记' : '创建笔记'}
          variant="primary"
          icon={<Save size={16} />}
          isLoading={saving}
          onClick={handleSave}
        />
      </HStack>

      <div className="buda-toolbar-cards">
        <VStack gap={4}>
          {editMode ? (
            <>
              <HStack gap={2} vAlign="center" wrap="wrap">
                <TextInput
                  label="所属笔记本"
                  isLabelHidden
                  value={folder}
                  onChange={setFolder}
                  placeholder="所属笔记本（如：工作）"
                  width={180}
                />
                <div className="buda-tag-input">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="buda-tag-chip"
                      onClick={() => setTags((prev) => prev.filter((t) => t !== tag))}
                    >
                      #{tag}
                      <span className="buda-tag-remove" aria-hidden="true">
                        ×
                      </span>
                    </span>
                  ))}
                  <input
                    value={tagDraft}
                    onChange={(e) => setTagDraft(e.target.value)}
                    onKeyDown={handleTagKey}
                    onBlur={addTag}
                    placeholder={tags.length === 0 ? '输入标签，回车添加…' : ''}
                    aria-label="标签"
                  />
                </div>
                <div style={{ flex: 1 }} />
                <Switch label="置顶显示" value={pinned} onChange={setPinned} />
              </HStack>
            </>
          ) : null}

          {mode === 'edit' && (
            <Card className="buda-editor-card" padding={5}>{editorBody}</Card>
          )}

          {mode === 'split' && (
            <Grid columns={2} gap={5}>
              <Card className="buda-editor-card" padding={5}>{editorBody}</Card>
              <Card className="buda-preview-card" padding={5}>{previewPane}</Card>
            </Grid>
          )}

          {mode === 'preview' && (
            <Card className="buda-preview-card" padding={5}>{previewPane}</Card>
          )}
        </VStack>
      </div>
    </VStack>
  )
}