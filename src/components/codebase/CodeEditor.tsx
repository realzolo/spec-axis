'use client';

import { useEffect, useMemo, useRef } from 'react';
import type { Extension } from '@codemirror/state';
import { Compartment, EditorState } from '@codemirror/state';
import {
  EditorView,
  lineNumbers,
  highlightActiveLineGutter,
  drawSelection,
  highlightSpecialChars,
} from '@codemirror/view';
import { defaultHighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';

export type CodeSelectionPayload = {
  lineStart: number;
  lineEnd: number;
  text: string;
  clientX: number;
  clientY: number;
};

export type CodeLineClickPayload = {
  line: number;
  shiftKey: boolean;
  clientX: number;
  clientY: number;
};

type CodeEditorProps = {
  value: string;
  language: string;
  onSelection?: (payload: CodeSelectionPayload) => void;
  onLineClick?: (payload: CodeLineClickPayload) => void;
  onReady?: (view: EditorView) => void;
  className?: string;
};

const editorTheme = EditorView.theme({
  '&': {
    height: '100%',
    backgroundColor: 'transparent',
    fontSize: '12px',
  },
  '.cm-scroller': {
    fontFamily: 'var(--font-mono)',
  },
  '.cm-content': {
    padding: '10px 0',
  },
  '.cm-line': {
    padding: '0 16px',
  },
  '.cm-gutters': {
    backgroundColor: 'transparent',
    borderRight: '1px solid hsl(var(--border))',
    color: 'hsl(var(--muted-foreground))',
    paddingLeft: '8px',
    paddingRight: '8px',
  },
  '.cm-lineNumbers .cm-gutterElement': {
    minWidth: '40px',
    textAlign: 'right',
    cursor: 'pointer',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'hsl(var(--muted) / 0.45)',
  },
  '.cm-selectionBackground': {
    backgroundColor: 'hsl(var(--accent) / 0.25)',
  },
});

export default function CodeEditor({
  value,
  language,
  onSelection,
  onLineClick,
  onReady,
  className,
}: CodeEditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const languageCompartment = useRef(new Compartment()).current;
  const onSelectionRef = useRef(onSelection);
  const onLineClickRef = useRef(onLineClick);
  const initialLanguageRef = useRef<Extension | null>(null);

  useEffect(() => {
    onSelectionRef.current = onSelection;
  }, [onSelection]);

  useEffect(() => {
    onLineClickRef.current = onLineClick;
  }, [onLineClick]);

  const languageExtension = useMemo(() => languageForPath(language), [language]);
  if (initialLanguageRef.current === null) {
    initialLanguageRef.current = languageExtension;
  }

  useEffect(() => {
    if (!containerRef.current) return;
    if (viewRef.current) return;

    const domHandlers = EditorView.domEventHandlers({
      mouseup: (event, view) => {
        if (event.button !== 0) return false;
        const handler = onSelectionRef.current;
        if (!handler) return false;
        const selection = view.state.selection.main;
        if (selection.empty) return false;
        const text = view.state.doc.sliceString(selection.from, selection.to);
        if (!text.trim()) return false;
        const fromLine = view.state.doc.lineAt(selection.from).number;
        let toLine = view.state.doc.lineAt(selection.to).number;
        const toLineStart = view.state.doc.line(toLine).from;
        if (selection.to === toLineStart && selection.to > selection.from) {
          toLine = Math.max(fromLine, toLine - 1);
        }
        const coords = view.coordsAtPos(selection.to) ?? view.coordsAtPos(selection.from);
        if (!coords) return false;
        handler({
          lineStart: Math.min(fromLine, toLine),
          lineEnd: Math.max(fromLine, toLine),
          text,
          clientX: coords.left,
          clientY: coords.bottom,
        });
        return false;
      },
      click: (event, view) => {
        if (event.button !== 0) return false;
        const handler = onLineClickRef.current;
        if (!handler) return false;
        const target = event.target as HTMLElement | null;
        if (!target || !target.closest('.cm-gutters')) return false;
        const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
        if (pos == null) return false;
        const line = view.state.doc.lineAt(pos).number;
        const linePos = view.state.doc.line(line).from;
        const coords = view.coordsAtPos(linePos);
        handler({
          line,
          shiftKey: event.shiftKey,
          clientX: coords?.left ?? event.clientX,
          clientY: coords?.bottom ?? event.clientY,
        });
        return false;
      },
    });

    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightSpecialChars(),
        drawSelection(),
        EditorState.readOnly.of(true),
        EditorView.editable.of(false),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        languageCompartment.of(initialLanguageRef.current ? [initialLanguageRef.current] : []),
        domHandlers,
        editorTheme,
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;
    onReady?.(view);

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [languageCompartment, onReady]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current === value) return;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: value },
    });
  }, [value]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: languageCompartment.reconfigure(languageExtension ? [languageExtension] : []),
    });
  }, [languageCompartment, languageExtension]);

  return <div ref={containerRef} className={className} />;
}

function languageForPath(filePath: string) {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  switch (ext) {
    case 'ts':
    case 'tsx':
    case 'js':
    case 'jsx':
    case 'mjs':
    case 'cjs':
      return javascript({ typescript: ext.startsWith('t') });
    case 'json':
      return json();
    case 'md':
    case 'markdown':
      return markdown();
    case 'html':
    case 'htm':
      return html();
    case 'css':
    case 'scss':
    case 'less':
      return css();
    default:
      return null;
  }
}
