import { useEffect, useMemo, useRef, useState } from 'react'
import { Theme } from '@astryxdesign/core/theme'
import { registerIcons } from '@astryxdesign/core/Icon'
import { neutralTheme, neutralIconRegistry } from '@astryxdesign/theme-neutral'
import { AppShell } from '@astryxdesign/core/AppShell'
import { TopNav, TopNavHeading } from '@astryxdesign/core/TopNav'
import { SideNav, SideNavHeading, SideNavItem, SideNavSection } from '@astryxdesign/core/SideNav'
import { Heading } from '@astryxdesign/core/Heading'
import { Text } from '@astryxdesign/core/Text'
import { Button } from '@astryxdesign/core/Button'
import { IconButton } from '@astryxdesign/core/IconButton'
import { Icon } from '@astryxdesign/core/Icon'
import { TextInput } from '@astryxdesign/core/TextInput'
import { Grid } from '@astryxdesign/core/Grid'
import { HStack } from '@astryxdesign/core/HStack'
import { VStack } from '@astryxdesign/core/VStack'
import { Badge } from '@astryxdesign/core/Badge'
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { Spinner } from '@astryxdesign/core/Spinner'
import { Banner } from '@astryxdesign/core/Banner'
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog'
import { useToast } from '@astryxdesign/core/Toast'

import {
  NotebookPen,
  Sun,
  Moon,
  Plus,
  Star,
  Layers,
  Tags,
  Lightbulb,
  Pin,
  FolderOpen,
  Archive,
  Trash2,
} from 'lucide-react'

import {
  fetchNotes,
  createNote,
  updateNote,
  trashNote,
  restoreNote,
  deleteNoteForever,
  emptyTrash,
  exportNotesToFile,
  importNotesFromFile,
  downloadBackup,
  downloadNoteMarkdown,
} from './api'
import NoteCard from './components/NoteCard'
import NoteEditor from './components/NoteEditor'

registerIcons(neutralIconRegistry)

function BudaiLogo() {
  return (
    <div
      style={{
        width: 30,
        height: 30,
        borderRadius: 10,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background:
          'linear-gradient(135deg, #6ee7ff, #a78bfa 55%, #f472b6)',
        color: '#fff',
        boxShadow: '0 4px 14px rgba(167,139,250,.5)',
      }}
    >
      <NotebookPen size={16} />
    </div>
  )
}

export default function App() {
  const [mode, setMode] = useState('dark')
  return (
    <Theme theme={neutralTheme} mode={mode}>
      <NotesApp mode={mode} onToggleMode={() => setMode(mode === 'dark' ? 'light' : 'dark')} />
    </Theme>
  )
}

function NotesApp({ mode, onToggleMode }) {
  const toast = useToast()
  const [notes, setNotes] = useState([])
  const [trashNotes, setTrashNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [activeTag, setActiveTag] = useState(null)
  const [activeFolder, setActiveFolder] = useState(null)
  const [showTrash, setShowTrash] = useState(false)

  const [view, setView] = useState('list')
  const [editingNote, setEditingNote] = useState(null)
  const [dialog, setDialog] = useState(null)
  const [busy, setBusy] = useState(false)

  const debounceRef = useRef(null)
  const searchWrapRef = useRef(null)
  const importInputRef = useRef(null)

  const loadNotes = async (q = query) => {
    setLoading(true)
    setError('')
    try {
      const data = await fetchNotes(q)
      setNotes(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const loadTrash = async () => {
    try {
      setTrashNotes(await fetchNotes('', { deleted: 1 }))
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => {
    loadNotes('')
    loadTrash()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => loadNotes(query), 300)
    return () => clearTimeout(debounceRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  useEffect(() => {
    const onKey = (e) => {
      const target = e.target
      const isTyping =
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault()
        openCreate()
      } else if (e.key === '/' && !isTyping) {
        e.preventDefault()
        searchWrapRef.current?.querySelector('input')?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const tagCounts = useMemo(() => {
    const map = {}
    notes.forEach((note) => {
      ;(note.tags || '')
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
        .forEach((t) => {
          map[t] = (map[t] || 0) + 1
        })
    })
    return map
  }, [notes])

  const folderCounts = useMemo(() => {
    const map = {}
    notes.forEach((note) => {
      const f = (note.folder || '').trim()
      if (f) map[f] = (map[f] || 0) + 1
    })
    return map
  }, [notes])

  const filtered = useMemo(() => {
    let list = notes
    if (filter === 'pinned') list = list.filter((n) => n.pinned)
    if (activeFolder) list = list.filter((n) => (n.folder || '').trim() === activeFolder)
    if (activeTag) list = list.filter((n) => (n.tags || '').split(',').includes(activeTag))
    return list
  }, [notes, filter, activeTag, activeFolder])

  const filteredTrash = useMemo(() => {
    if (!query.trim()) return trashNotes
    const q = query.toLowerCase()
    return trashNotes.filter((n) =>
      (n.title || '').toLowerCase().includes(q) ||
      (n.content || '').toLowerCase().includes(q) ||
      (n.tags || '').toLowerCase().includes(q),
    )
  }, [trashNotes, query])

  const pinnedCount = useMemo(() => notes.filter((n) => n.pinned).length, [notes])

  const openCreate = () => {
    setEditingNote(null)
    setView('note')
  }

  const openEdit = (note) => {
    setEditingNote(note)
    setView('note')
  }

  const backToList = () => {
    setView('list')
    setEditingNote(null)
  }

  const saveNote = async (payload) => {
    if (editingNote) {
      const saved = await updateNote(editingNote.id, payload)
      setNotes((prev) =>
        [...prev.map((n) => (n.id === saved.id ? saved : n))].sort((a, b) => b.pinned - a.pinned),
      )
      return saved
    }
    const created = await createNote(payload)
    setNotes((prev) => [created, ...prev])
    return created
  }

  const handleTogglePin = async (note) => {
    try {
      await updateNote(note.id, { pinned: !note.pinned })
      setNotes((prev) =>
        [...prev.map((n) => (n.id === note.id ? { ...n, pinned: !n.pinned } : n))].sort(
          (a, b) => b.pinned - a.pinned,
        ),
      )
      toast({
        body: note.pinned ? '已取消置顶' : '已置顶',
        type: 'info',
        uniqueID: `pin-${note.id}`,
      })
    } catch (err) {
      setError(err.message)
    }
  }

  const handleRestore = async (note) => {
    try {
      await restoreNote(note.id)
      setTrashNotes((prev) => prev.filter((n) => n.id !== note.id))
      setNotes((prev) => [{ ...note, deleted_at: null }, ...prev])
      toast({ body: '已还原到笔记列表', type: 'info' })
    } catch (err) {
      setError(err.message)
    }
  }

  const handleExportMd = (note) => {
    downloadNoteMarkdown(note)
    toast({ body: '已下载 Markdown', type: 'info' })
  }

  const handleExport = async () => {
    try {
      const count = await exportNotesToFile()
      toast({ body: `已导出 ${count} 篇笔记`, type: 'info' })
    } catch (err) {
      toast({ body: `导出失败：${err.message}`, type: 'error' })
    }
  }

  const handleBackup = async () => {
    try {
      await downloadBackup()
      toast({ body: '数据库备份已下载', type: 'info' })
    } catch (err) {
      toast({ body: `备份失败：${err.message}`, type: 'error' })
    }
  }

  const handleImportFile = async (file) => {
    if (!file) return
    try {
      const imported = await importNotesFromFile(file)
      await loadNotes(query)
      toast({ body: `已导入 ${imported} 篇笔记`, type: 'info' })
    } catch (err) {
      toast({ body: `导入失败：${err.message}`, type: 'error' })
    }
  }

  const confirmDialog = async () => {
    if (!dialog) return
    setBusy(true)
    try {
      if (dialog.type === 'trash') {
        await trashNote(dialog.target.id)
        setNotes((prev) => prev.filter((n) => n.id !== dialog.target.id))
        await loadTrash()
        if (view === 'note') backToList()
        toast({ body: '已移到回收站', type: 'info' })
      } else if (dialog.type === 'forever') {
        await deleteNoteForever(dialog.target.id)
        setTrashNotes((prev) => prev.filter((n) => n.id !== dialog.target.id))
        toast({ body: '已彻底删除', type: 'info' })
      } else if (dialog.type === 'empty') {
        const res = await emptyTrash()
        setTrashNotes([])
        toast({ body: `已清空 ${res.deleted} 篇笔记`, type: 'info' })
      }
      setDialog(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const dialogCopy = {
    trash: {
      title: '移到回收站？',
      desc: '笔记会保留在回收站，可随时还原。',
      name: dialog?.target?.title,
      confirm: '移到回收站',
    },
    forever: {
      title: '彻底删除？',
      desc: '此操作不可恢复，将永久删除该笔记。',
      name: dialog?.target?.title,
      confirm: '彻底删除',
    },
    empty: {
      title: '清空回收站？',
      desc: `将永久删除全部 ${trashNotes.length} 篇笔记，无法恢复。`,
      name: null,
      confirm: '清空回收站',
    },
  }[dialog?.type] || { title: '', desc: '', name: null, confirm: '' }

  const topNav = (
    <TopNav
      heading={<TopNavHeading logo={<BudaiLogo />} heading="BudaNodes" subheading="笔记管理" />}
      endContent={
        <HStack gap={2} vAlign="center">
          <div ref={searchWrapRef}>
            <TextInput
              label="搜索笔记"
              isLabelHidden
              value={query}
              onChange={setQuery}
              placeholder="搜索标题、内容、标签…"
              startIcon="search"
              hasClear
              width={240}
            />
          </div>
          <IconButton
            label={mode === 'dark' ? '切换到亮色' : '切换到暗色'}
            variant="ghost"
            icon={mode === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            onClick={onToggleMode}
            tooltip={mode === 'dark' ? '切换到亮色' : '切换到暗色'}
          />
          <Button label="新建笔记" variant="primary" icon={<Plus size={16} />} onClick={openCreate} />
        </HStack>
      }
    />
  )

  const sideNav = (
    <SideNav
      header={
        <SideNavHeading
          heading="我的笔记"
          subheading={`共 ${notes.length} 篇`}
        />
      }
      topContent={
        <VStack padding={3}>
          <Button
            label="新建笔记"
            variant="primary"
            icon={<Plus size={16} />}
            width="100%"
            onClick={openCreate}
          />
        </VStack>
      }
      footer={
        <VStack padding={3} gap={3}>
          <HStack gap={2} vAlign="center">
            <Icon icon="info" size="sm" color="tertiary" />
            <Text type="supporting">数据保存在本地 SQLite</Text>
          </HStack>
          <HStack gap={1}>
            <Button
              label="导出"
              size="sm"
              variant="secondary"
              onClick={handleExport}
            />
            <Button
              label="导入"
              size="sm"
              variant="secondary"
              onClick={() => importInputRef.current?.click()}
            />
            <Button
              label="备份"
              size="sm"
              variant="secondary"
              onClick={handleBackup}
            />
          </HStack>
          <input
            ref={importInputRef}
            type="file"
            accept=".json,application/json"
            style={{ display: 'none' }}
            onChange={(e) => {
              handleImportFile(e.target.files[0])
              e.target.value = ''
            }}
          />
        </VStack>
      }
    >
      <SideNavSection title="视图">
        <SideNavItem
          label="全部笔记"
          icon={<Layers size={16} />}
          selectedIcon={<Layers size={16} />}
          isSelected={filter === 'all' && !activeTag && !activeFolder && !showTrash}
          onClick={() => {
            setFilter('all')
            setActiveTag(null)
            setActiveFolder(null)
            setShowTrash(false)
          }}
          endContent={<Badge variant="neutral" label={notes.length} />}
        />
        <SideNavItem
          label="置顶"
          icon={<Pin size={16} />}
          selectedIcon={<Pin size={16} />}
          isSelected={filter === 'pinned' && !showTrash}
          onClick={() => {
            setFilter('pinned')
            setActiveTag(null)
            setActiveFolder(null)
            setShowTrash(false)
          }}
          endContent={<Badge variant="warning" label={pinnedCount} />}
        />
      </SideNavSection>
      {Object.keys(folderCounts).length > 0 ? (
        <SideNavSection title="笔记本">
          {Object.entries(folderCounts).map(([folder, count]) => (
            <SideNavItem
              key={folder}
              label={folder}
              icon={<FolderOpen size={16} />}
              selectedIcon={<FolderOpen size={16} />}
              isSelected={activeFolder === folder && !showTrash}
              onClick={() => {
                setActiveFolder(folder)
                setFilter('all')
                setActiveTag(null)
                setShowTrash(false)
              }}
              endContent={<Badge variant="cyan" label={count} />}
            />
          ))}
        </SideNavSection>
      ) : null}
      {Object.keys(tagCounts).length > 0 ? (
        <SideNavSection title="标签">
          {Object.entries(tagCounts).map(([tag, count]) => (
            <SideNavItem
              key={tag}
              label={`# ${tag}`}
              icon={<Tags size={16} />}
              selectedIcon={<Tags size={16} />}
              isSelected={activeTag === tag && !showTrash}
              onClick={() => {
                setActiveTag(tag)
                setFilter('all')
                setActiveFolder(null)
                setShowTrash(false)
              }}
              endContent={<Badge variant="purple" label={count} />}
            />
          ))}
        </SideNavSection>
      ) : null}
      <SideNavSection title="系统">
        <SideNavItem
          label="回收站"
          icon={<Archive size={16} />}
          selectedIcon={<Archive size={16} />}
          isSelected={showTrash}
          onClick={() => {
            setShowTrash(true)
            setActiveFolder(null)
            setActiveTag(null)
            setFilter('all')
          }}
          endContent={
            <Badge variant={trashNotes.length ? 'danger' : 'neutral'} label={trashNotes.length} />
          }
        />
      </SideNavSection>
    </SideNav>
  )

  const statsRow = (
    <div className="buda-fade">
      <HStack gap={4} vAlign="center" wrap="wrap">
        <div className="buda-stat">
          <Icon icon="info" size="lg" color="accent" />
          <VStack gap={0}>
            <div className="buda-stat-value">{notes.length}</div>
            <Text type="label" color="secondary">全部笔记</Text>
          </VStack>
        </div>
        <div className="buda-stat">
          <Star size={22} color="#f59e0b" />
          <VStack gap={0}>
            <div className="buda-stat-value">{pinnedCount}</div>
            <Text type="label" color="secondary">置顶</Text>
          </VStack>
        </div>
        <div className="buda-stat">
          <Tags size={22} color="#a78bfa" />
          <VStack gap={0}>
            <div className="buda-stat-value">{Object.keys(tagCounts).length}</div>
            <Text type="label" color="secondary">标签</Text>
          </VStack>
        </div>
        <div className="buda-stat">
          <FolderOpen size={22} color="#22d3ee" />
          <VStack gap={0}>
            <div className="buda-stat-value">{Object.keys(folderCounts).length}</div>
            <Text type="label" color="secondary">笔记本</Text>
          </VStack>
        </div>
      </HStack>
    </div>
  )

  const headingText = showTrash
    ? '回收站'
    : filter === 'pinned'
      ? '置顶笔记'
      : activeTag
        ? `# ${activeTag}`
        : activeFolder
          ? activeFolder
          : '全部笔记'

  const listPane = (
    <VStack gap={5}>
      <VStack gap={1}>
        <Heading level={2}>{headingText}</Heading>
        <Text type="body" color="secondary">
          {showTrash
            ? filteredTrash.length > 0
              ? `共 ${filteredTrash.length} 篇，可随时还原`
              : '回收站是空的'
            : filtered.length > 0
              ? `共 ${filtered.length} 篇笔记`
              : '这里还没有笔记'}
        </Text>
      </VStack>

      {!showTrash && notes.length > 0 ? statsRow : null}

      {error ? (
        <Banner
          status="error"
          title="加载失败"
          description={error}
          isDismissable
          onDismiss={() => setError('')}
          endContent={
            <Button label="重试" variant="secondary" size="sm" onClick={() => loadNotes(query)} />
          }
        />
      ) : null}

      {showTrash && trashNotes.length > 0 ? (
        <HStack justify="end">
          <Button
            label="清空回收站"
            variant="destructive"
            size="sm"
            icon={<Trash2 size={14} />}
            onClick={() => setDialog({ type: 'empty' })}
          />
        </HStack>
      ) : null}

      {loading && notes.length === 0 && !showTrash ? (
        <VStack vAlign="center" hAlign="center" padding={8} gap={2}>
          <Spinner size="lg" label="正在加载笔记…" />
        </VStack>
      ) : (showTrash ? filteredTrash : filtered).length === 0 && !loading ? (
        <EmptyState
          title={showTrash ? '回收站是空的' : query ? '没有匹配的笔记' : '还没有笔记'}
          description={
            showTrash
              ? '删除的笔记会暂时存放在这里，随时可以还原。'
              : query
                ? '换个关键词试试，或者清空搜索。'
                : '点击「新建笔记」创建你的第一篇笔记吧。'
          }
          icon={showTrash ? <Archive size={40} /> : <Lightbulb size={40} />}
          actions={
            showTrash ? null : query ? (
              <Button label="清空搜索" variant="secondary" onClick={() => setQuery('')} />
            ) : (
              <Button label="新建笔记" variant="primary" icon={<Plus size={16} />} onClick={openCreate} />
            )
          }
        />
      ) : (
        <Grid columns={{ minWidth: 300, max: 3 }} gap={4}>
          {(showTrash ? filteredTrash : filtered).map((note, index) => (
            <NoteCard
              key={note.id}
              note={note}
              index={index}
              inTrash={showTrash}
              highlight={query}
              onOpen={openEdit}
              onTrash={(n) => setDialog({ type: 'trash', target: n })}
              onRestore={handleRestore}
              onDeleteForever={(n) => setDialog({ type: 'forever', target: n })}
              onTogglePin={handleTogglePin}
              onExportMd={handleExportMd}
            />
          ))}
        </Grid>
      )}
    </VStack>
  )

  const content =
    view === 'note' ? (
      <NoteEditor
        note={editingNote}
        folders={Object.keys(folderCounts)}
        dark={mode === 'dark'}
        onSave={saveNote}
        onBack={backToList}
        onDelete={(n) => setDialog({ type: 'trash', target: n })}
      />
    ) : (
      listPane
    )

  return (
    <>
      <div className="buda-backdrop" aria-hidden="true" />
      <AppShell topNav={topNav} sideNav={sideNav} contentPadding={4}>
        {content}
      </AppShell>

      <Dialog
        isOpen={Boolean(dialog)}
        onOpenChange={(open) => !open && setDialog(null)}
        width={420}
        purpose="required"
      >
        <DialogHeader
          title={dialogCopy.title}
          subtitle={dialogCopy.desc}
          onOpenChange={() => setDialog(null)}
        />
        {dialogCopy.name ? (
          <VStack padding={4}>
            <Text type="body" color="secondary">
              确定要{dialog?.type === 'trash' ? '删除' : '删除'}「{dialogCopy.name}」吗？
            </Text>
          </VStack>
        ) : null}
        <HStack gap={2} justify="end" padding={4}>
          <Button label="取消" variant="ghost" onClick={() => setDialog(null)} />
          <Button
            label={dialogCopy.confirm}
            variant="destructive"
            isLoading={busy}
            onClick={confirmDialog}
          />
        </HStack>
      </Dialog>
    </>
  )
}
