const BASE = '/api/notes'

async function request(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}))
    throw new Error(detail.detail || `请求失败 (${res.status})`)
  }
  return res.json()
}

export function fetchNotes(query = '', extra = {}) {
  const params = new URLSearchParams()
  if (query) params.set('q', query)
  if (extra.deleted) params.set('deleted', '1')
  if (extra.folder) params.set('folder', extra.folder)
  const qs = params.toString()
  return request(`${BASE}${qs ? `?${qs}` : ''}`)
}

export function createNote(payload) {
  return request(BASE, { method: 'POST', body: JSON.stringify(payload) })
}

export function updateNote(id, payload) {
  return request(`${BASE}/${id}`, { method: 'PUT', body: JSON.stringify(payload) })
}

export function trashNote(id) {
  return request(`${BASE}/${id}/trash`, { method: 'POST' })
}

export function restoreNote(id) {
  return request(`${BASE}/${id}/restore`, { method: 'POST' })
}

export function deleteNoteForever(id) {
  return request(`${BASE}/${id}`, { method: 'DELETE' })
}

export function emptyTrash() {
  return request(`${BASE}`, { method: 'DELETE' })
}

export async function uploadImage(file) {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${BASE}/upload`, { method: 'POST', body: form })
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}))
    throw new Error(detail.detail || '上传失败')
  }
  return res.json()
}

export async function exportNotesToFile() {
  const res = await fetch(`${BASE}/export`)
  if (!res.ok) throw new Error('导出失败')
  const data = await res.json()
  downloadBlob(
    JSON.stringify(data, null, 2),
    `budainodes-export-${new Date().toISOString().slice(0, 10)}.json`,
    'application/json',
  )
  return data.count
}

export async function importNotesFromFile(file) {
  const text = await file.text()
  const data = JSON.parse(text)
  const result = await request(`${BASE}/import`, {
    method: 'POST',
    body: JSON.stringify({ notes: data.notes || (Array.isArray(data) ? data : []) }),
  })
  return result.imported
}

export async function downloadBackup() {
  const res = await fetch(`${BASE}/backup`)
  if (!res.ok) throw new Error('备份失败')
  const blob = await res.blob()
  const name = `budainodes-backup-${new Date().toISOString().slice(0, 10)}.db`
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

export function downloadNoteMarkdown(note) {
  const md = [`# ${note.title || '无标题'}`, '', note.content || ''].join('\n')
  downloadBlob(md, `${(note.title || '笔记').replace(/[\\/:*?"<>|]/g, '_')}.md`, 'text/markdown')
}

function downloadBlob(content, filename, type) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
