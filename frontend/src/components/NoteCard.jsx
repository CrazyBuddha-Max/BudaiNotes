import { Pin, Trash2, PinOff, StickyNote, Undo2, Download } from 'lucide-react'
import { Badge } from '@astryxdesign/core/Badge'
import { Card } from '@astryxdesign/core/Card'
import { HStack } from '@astryxdesign/core/HStack'
import { VStack } from '@astryxdesign/core/VStack'
import { Heading } from '@astryxdesign/core/Heading'
import { Text } from '@astryxdesign/core/Text'
import { IconButton } from '@astryxdesign/core/IconButton'
import { Timestamp } from '@astryxdesign/core/Timestamp'
import { MoreMenu } from '@astryxdesign/core/MoreMenu'

const TAG_COLORS = [
  'blue',
  'purple',
  'pink',
  'teal',
  'orange',
  'green',
  'cyan',
  'yellow',
]

function hashColor(tag) {
  let h = 0
  for (let i = 0; i < tag.length; i += 1) {
    h = (h * 31 + tag.charCodeAt(i)) % 997
  }
  return TAG_COLORS[h % TAG_COLORS.length]
}

function highlightParts(text, query) {
  if (!query) return [text]
  const lower = text.toLowerCase()
  const q = query.toLowerCase()
  const parts = []
  let i = 0
  while (i < text.length) {
    const idx = lower.indexOf(q, i)
    if (idx === -1) {
      parts.push(text.slice(i))
      break
    }
    if (idx > i) parts.push(text.slice(i, idx))
    parts.push(<mark key={`${idx}-${parts.length}`}>{text.slice(idx, idx + q.length)}</mark>)
    i = idx + q.length
  }
  return parts.length ? parts : [text]
}

export default function NoteCard({
  note,
  index,
  onOpen,
  onTrash,
  onRestore,
  onDeleteForever,
  onTogglePin,
  onExportMd,
  highlight = '',
  inTrash = false,
}) {
  const tags = (note.tags || '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)

  const content = note.content || '（无内容）'
  const hasHighlight = Boolean(highlight.trim())

  const handleOpen = (e) => {
    e.stopPropagation()
    onOpen(note)
  }

  const stop = (fn) => (e) => {
    e.stopPropagation()
    fn(note)
  }

  const menuItems = inTrash
    ? [
        {
          label: '还原',
          icon: <Undo2 size={15} />,
          onClick: stop(onRestore),
        },
        { type: 'divider' },
        {
          label: '彻底删除',
          icon: <Trash2 size={15} />,
          variant: 'danger',
          onClick: stop(onDeleteForever),
        },
      ]
    : [
        {
          label: note.pinned ? '取消置顶' : '置顶',
          icon: note.pinned ? <PinOff size={15} /> : <Pin size={15} />,
          onClick: stop(onTogglePin),
        },
        {
          label: '导出 Markdown',
          icon: <Download size={15} />,
          onClick: stop(onExportMd),
        },
        { type: 'divider' },
        {
          label: '删除',
          icon: <Trash2 size={15} />,
          onClick: stop(onTrash),
        },
      ]

  return (
    <div
      className="buda-note-card"
      style={{ animationDelay: `${Math.min(index * 0.05, 0.4)}s` }}
      onClick={handleOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen(note)
        }
      }}
    >
      {note.pinned ? <div className="buda-accent-line" /> : null}
      <Card padding={4} elevation="none" variant={note.pinned ? 'muted' : 'default'}>
        <VStack gap={3}>
          <HStack gap={2} justify="between" vAlign="center">
            <HStack gap={2} vAlign="center">
              {inTrash ? <Trash2 size={14} aria-hidden="true" /> : note.pinned ? <Pin size={14} aria-hidden="true" /> : <StickyNote size={14} aria-hidden="true" />}
              <Badge
                variant={inTrash ? 'danger' : note.pinned ? 'warning' : 'neutral'}
                label={inTrash ? '回收站' : note.pinned ? '置顶' : '笔记'}
              />
              {note.folder ? <Badge variant="secondary" label={note.folder} /> : null}
            </HStack>
            <MoreMenu label="笔记操作" items={menuItems} />
          </HStack>

          <Heading level={3} maxLines={1}>
            {hasHighlight ? highlightParts(note.title || '无标题', highlight) : note.title || '无标题'}
          </Heading>

          <Text type="body" color="secondary">
            <span className="buda-preview">
              {hasHighlight ? highlightParts(content, highlight) : content}
            </span>
          </Text>

          {tags.length > 0 ? (
            <HStack gap={1} wrap="wrap">
              {tags.map((tag) => (
                <Badge key={tag} variant={hashColor(tag)} label={tag} />
              ))}
            </HStack>
          ) : null}

          <HStack gap={2} justify="between" vAlign="center">
            <Timestamp value={note.updated_at} format="auto" isLive type="label" />
            {inTrash ? (
              <HStack gap={1}>
                <IconButton
                  label="还原"
                  variant="ghost"
                  size="sm"
                  icon={<Undo2 size={16} />}
                  onClick={stop(onRestore)}
                  tooltip="还原"
                />
                <IconButton
                  label="彻底删除"
                  variant="ghost"
                  size="sm"
                  icon={<Trash2 size={16} />}
                  onClick={stop(onDeleteForever)}
                  tooltip="彻底删除"
                />
              </HStack>
            ) : (
              <IconButton
                label={note.pinned ? '取消置顶' : '置顶'}
                variant="ghost"
                size="sm"
                icon={note.pinned ? <PinOff size={16} /> : <Pin size={16} />}
                onClick={stop(onTogglePin)}
                tooltip={note.pinned ? '取消置顶' : '置顶'}
              />
            )}
          </HStack>
        </VStack>
      </Card>
    </div>
  )
}
