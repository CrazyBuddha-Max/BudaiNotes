import { useEffect, useRef } from 'react'
import { EditorState } from '@codemirror/state'
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
  drawSelection,
  dropCursor,
  placeholder,
  rectangularSelection,
  crosshairCursor,
} from '@codemirror/view'
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import {
  syntaxHighlighting,
  defaultHighlightStyle,
  bracketMatching,
  indentOnInput,
  foldGutter,
  foldKeymap,
} from '@codemirror/language'
import {
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
} from '@codemirror/autocomplete'
import {
  highlightSelectionMatches,
  searchKeymap,
} from '@codemirror/search'
import { oneDark } from '@codemirror/theme-one-dark'

export default function MarkdownEditor({ value = '', onChange, viewRef, dark = false, placeholderText }) {
  const hostRef = useRef(null)
  const applying = useRef(false)

  const buildExtensions = (isDark) => [
    lineNumbers(),
    highlightActiveLineGutter(),
    highlightActiveLine(),
    history(),
    foldGutter(),
    drawSelection(),
    dropCursor(),
    indentOnInput(),
    bracketMatching(),
    closeBrackets(),
    rectangularSelection(),
    crosshairCursor(),
    highlightSelectionMatches(),
    markdown(),
    syntaxHighlighting(defaultHighlightStyle),
    isDark ? oneDark : [],
    placeholder(placeholderText || ''),
    keymap.of([
      ...defaultKeymap,
      ...historyKeymap,
      ...foldKeymap,
      ...closeBracketsKeymap,
      ...completionKeymap,
      ...searchKeymap,
      indentWithTab,
    ]),
    EditorView.lineWrapping,
    EditorView.updateListener.of((update) => {
      if (applying.current) return
      if (update.docChanged) {
        onChange(update.state.doc.toString())
      }
    }),
  ]

  useEffect(() => {
    if (!hostRef.current) return undefined
    const view = new EditorView({
      state: EditorState.create({
        doc: value,
        extensions: buildExtensions(dark),
      }),
      parent: hostRef.current,
    })
    if (viewRef) viewRef.current = view
    return () => {
      if (viewRef) viewRef.current = null
      view.destroy()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const view = viewRef?.current
    if (!view) return
    const current = view.state.doc.toString()
    if (current === value) return
    applying.current = true
    view.dispatch({
      changes: { from: 0, to: current.length, insert: value },
      selection: { anchor: 0 },
      scrollIntoView: false,
    })
    requestAnimationFrame(() => {
      applying.current = false
    })
  }, [value, viewRef])

  useEffect(() => {
    const view = viewRef?.current
    if (!view) return
    view.setState(
      EditorState.create({
        doc: view.state.doc,
        selection: view.state.selection,
        extensions: buildExtensions(dark),
      }),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dark])

  return <div ref={hostRef} className="buda-md-cm" />
}
