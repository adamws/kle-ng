import { ref, onMounted, onUnmounted, watch, type Ref, shallowRef } from 'vue'
import { EditorState, type Extension } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'

export interface CodeMirrorOptions {
  extensions?: Extension[]
  onUpdate?: (content: string) => void
  onFocus?: () => void
  onBlur?: () => void
}

export function useCodeMirror(
  containerRef: Ref<HTMLElement | null>,
  content: Ref<string>,
  options: CodeMirrorOptions = {},
) {
  const view = shallowRef<EditorView | null>(null)
  const isFocused = ref(false)

  // Flag to prevent update loops
  let isUpdatingFromExternal = false

  const createState = (doc: string): EditorState => {
    return EditorState.create({
      doc,
      extensions: [
        // Basic keybindings
        keymap.of([...defaultKeymap, ...historyKeymap]),
        // History (undo/redo)
        history(),
        // Update listener
        EditorView.updateListener.of((update) => {
          if (update.docChanged && !isUpdatingFromExternal) {
            const newContent = update.state.doc.toString()
            options.onUpdate?.(newContent)
          }
        }),
        // Focus/blur handlers
        EditorView.domEventHandlers({
          focus: () => {
            isFocused.value = true
            options.onFocus?.()
          },
          blur: () => {
            isFocused.value = false
            options.onBlur?.()
          },
        }),
        // Additional user extensions
        ...(options.extensions || []),
      ],
    })
  }

  const initEditor = () => {
    if (!containerRef.value) return

    // Destroy existing view if any
    if (view.value) {
      view.value.destroy()
    }

    view.value = new EditorView({
      state: createState(content.value),
      parent: containerRef.value,
    })
  }

  // Watch for external content changes (e.g., from store)
  watch(content, (newContent) => {
    if (!view.value) return

    const currentContent = view.value.state.doc.toString()
    if (currentContent !== newContent) {
      isUpdatingFromExternal = true
      view.value.dispatch({
        changes: {
          from: 0,
          to: view.value.state.doc.length,
          insert: newContent,
        },
      })
      isUpdatingFromExternal = false
    }
  })

  onMounted(() => {
    initEditor()
  })

  onUnmounted(() => {
    if (view.value) {
      view.value.destroy()
      view.value = null
    }
  })

  // Method to get current content
  const getContent = (): string => {
    return view.value?.state.doc.toString() ?? ''
  }

  // Method to set content programmatically
  const setContent = (newContent: string) => {
    if (!view.value) return

    isUpdatingFromExternal = true
    view.value.dispatch({
      changes: {
        from: 0,
        to: view.value.state.doc.length,
        insert: newContent,
      },
    })
    isUpdatingFromExternal = false
  }

  // Method to focus the editor
  const focus = () => {
    view.value?.focus()
  }

  return {
    view,
    isFocused,
    getContent,
    setContent,
    focus,
  }
}
