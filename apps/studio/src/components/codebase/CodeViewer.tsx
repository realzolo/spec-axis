'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Compartment, EditorState } from '@codemirror/state';
import {
  EditorView,
  lineNumbers,
  highlightActiveLineGutter,
  drawSelection,
  highlightSpecialChars,
} from '@codemirror/view';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { resolveLanguageSupportForPath } from '@/lib/codeLanguage';

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

type CodeViewerProps = {
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

const codeHighlightStyle = HighlightStyle.define([
  { tag: tags.comment, color: 'hsl(var(--ds-text-2))', fontStyle: 'italic' },
  { tag: [tags.keyword, tags.modifier, tags.operatorKeyword], color: 'hsl(var(--ds-accent-8))' },
  { tag: [tags.typeName, tags.className], color: 'hsl(var(--ds-accent-9))' },
  { tag: [tags.string, tags.regexp], color: 'hsl(var(--ds-success-7))' },
  { tag: [tags.number, tags.bool, tags.null], color: 'hsl(var(--ds-warning-7))' },
  { tag: [tags.propertyName, tags.attributeName], color: 'hsl(var(--ds-accent-9))' },
  { tag: [tags.tagName], color: 'hsl(var(--ds-danger-7))' },
  { tag: [tags.variableName], color: 'hsl(var(--ds-text-1))' },
  { tag: [tags.operator, tags.punctuation], color: 'hsl(var(--ds-text-1))' },
]);

export default function CodeViewer({
  value,
  language,
  onSelection,
  onLineClick,
  onReady,
  className,
}: CodeViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const languageCompartment = useMemo(() => new Compartment(), []);
  const onSelectionRef = useRef(onSelection);
  const onLineClickRef = useRef(onLineClick);
  const onReadyRef = useRef(onReady);
  const initialValueRef = useRef(value);

  useEffect(() => {
    onSelectionRef.current = onSelection;
  }, [onSelection]);

  useEffect(() => {
    onLineClickRef.current = onLineClick;
  }, [onLineClick]);

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

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
      doc: initialValueRef.current,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightSpecialChars(),
        drawSelection(),
        EditorState.readOnly.of(true),
        EditorView.editable.of(false),
        syntaxHighlighting(codeHighlightStyle, { fallback: true }),
        languageCompartment.of([]),
        domHandlers,
        editorTheme,
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;
    onReadyRef.current?.(view);

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [languageCompartment]);

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

    let cancelled = false;

    const applyLanguage = async () => {
      const resolved = await resolveLanguageSupportForPath(language);
      if (cancelled) return;
      view.dispatch({
        effects: languageCompartment.reconfigure(resolved ? [resolved] : []),
      });
    };

    void applyLanguage();

    return () => {
      cancelled = true;
    };
  }, [language, languageCompartment]);

  return <div ref={containerRef} className={className} />;
}
