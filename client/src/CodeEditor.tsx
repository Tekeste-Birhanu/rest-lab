import { useEffect, useRef } from 'react'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { javascript } from '@codemirror/lang-javascript'
import { bracketMatching, indentUnit } from '@codemirror/language'
import { EditorState } from '@codemirror/state'
import { oneDark } from '@codemirror/theme-one-dark'
import {
  drawSelection,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from '@codemirror/view'

interface CodeEditorProps {
  value: string
  onChange: (source: string) => void
}

function CodeEditor({ value, onChange }: CodeEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const initialValueRef = useRef(value)
  const onChangeRef = useRef(onChange)

  useEffect(() => { onChangeRef.current = onChange }, [onChange])

  useEffect(() => {
    const parent = hostRef.current
    if (!parent) return

    const state = EditorState.create({
      doc: initialValueRef.current,
      extensions: [
        oneDark,
        lineNumbers(),
        highlightActiveLineGutter(),
        history(),
        drawSelection(),
        bracketMatching(),
        indentUnit.of('  '),
        javascript(),
        highlightActiveLine(),
        keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap]),
        EditorView.contentAttributes.of({
          'aria-label': 'JavaScript editor',
          'aria-multiline': 'true',
          spellcheck: 'false',
        }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) onChangeRef.current(update.state.doc.toString())
        }),
        EditorView.theme({
          '&': { height: '100%', color: '#d7e0eb', backgroundColor: '#20252d', fontSize: '12px' },
          '&.cm-focused': { outline: 'none' },
          '.cm-scroller': { overflow: 'auto', fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace' },
          '.cm-content': { minHeight: '100%', padding: '14px 0', caretColor: '#85b7ff' },
          '.cm-line': { padding: '0 14px' },
          '.cm-gutters': { border: 'none', borderRight: '1px solid #303843', backgroundColor: '#20252d', color: '#718198' },
          '.cm-activeLine': { backgroundColor: '#252c35' },
          '.cm-activeLineGutter': { backgroundColor: '#252c35', color: '#b8c6d8' },
          '.cm-cursor, .cm-dropCursor': { borderLeftColor: '#85b7ff' },
          '& ::selection': { backgroundColor: '#365273' },
        }),
      ],
    })

    const view = new EditorView({ state, parent })
    viewRef.current = view
    return () => {
      view.destroy()
      viewRef.current = null
    }
  }, [])

  useEffect(() => {
    const view = viewRef.current
    if (!view || view.state.doc.toString() === value) return
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } })
  }, [value])

  return <div ref={hostRef} className="code-editor-host" />
}

export default CodeEditor
