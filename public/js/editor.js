// CodeMirror 6 — markdown syntax highlighting for Drafts Web Capture
// Replaces the plain textarea with a CM editor; keeps textarea hidden for form compat.

import { EditorView, keymap, placeholder } from 'https://esm.sh/@codemirror/view@6';
import { EditorState } from 'https://esm.sh/@codemirror/state@6';
import { defaultKeymap, history, historyKeymap } from 'https://esm.sh/@codemirror/commands@6';
import { syntaxHighlighting, HighlightStyle } from 'https://esm.sh/@codemirror/language@6';
import { markdown } from 'https://esm.sh/@codemirror/lang-markdown@6';
import { tags } from 'https://esm.sh/@lezer/highlight@1';

const ta = document.getElementById('draft-content');
if (!ta) throw new Error('editor: #draft-content not found');

// ── Highlight style (light, Things-inspired) ────────────────
const highlightStyle = HighlightStyle.define([
    { tag: tags.heading1, fontWeight: '700', fontSize: '1.3em', color: '#1c1c1e' },
    { tag: tags.heading2, fontWeight: '600', fontSize: '1.12em', color: '#1c1c1e' },
    { tag: [tags.heading3, tags.heading4, tags.heading5, tags.heading6], fontWeight: '600', color: '#3a3a3c' },
    { tag: tags.strong,   fontWeight: '700' },
    { tag: tags.emphasis,  fontStyle: 'italic' },
    { tag: tags.strikethrough, textDecoration: 'line-through', color: '#8e8e93' },
    { tag: tags.monospace, fontFamily: '"SF Mono", Menlo, Consolas, monospace', fontSize: '0.87em' },
    { tag: tags.link,      color: '#4A90D9' },
    { tag: tags.url,       color: '#4A90D9' },
    { tag: tags.quote,     color: '#636366', fontStyle: 'italic' },
    { tag: tags.processingInstruction, color: '#c7c7cc' },
    { tag: tags.meta,      color: '#aeaeb2' },
    { tag: tags.comment,   color: '#aeaeb2' },
]);

// ── Editor theme ────────────────────────────────────────────
const editorTheme = EditorView.theme({
    '&': {
        background: 'transparent',
        fontSize: '0.96rem',
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial, sans-serif',
    },
    '.cm-scroller': {
        overflow: 'visible',
        lineHeight: '1.65',
        fontFamily: 'inherit',
    },
    '.cm-content': {
        padding: '12px 22px 16px',
        minHeight: '220px',
        caretColor: '#1c1c1e',
    },
    '&.cm-focused': { outline: 'none' },
    '&.cm-focused .cm-cursor': { borderLeftColor: '#1c1c1e', borderLeftWidth: '1.5px' },
    '.cm-cursor, .cm-dropCursor': { borderLeftColor: '#3a3a3c', borderLeftWidth: '1.5px' },
    '&.cm-focused .cm-selectionBackground': { background: 'rgba(74,144,217,.2)' },
    '.cm-selectionBackground': { background: 'rgba(74,144,217,.08)' },
    '.cm-line': { padding: '0' },
    '.cm-placeholder': { color: '#c7c7cc', fontStyle: 'normal' },
    '.cm-gutters': { display: 'none' },
    '.cm-activeLine': { background: 'transparent' },
    '.cm-activeLineGutter': { display: 'none' },
}, { dark: false });

// ── Mount ───────────────────────────────────────────────────
const container = document.createElement('div');
container.id = 'cm-editor-root';
ta.parentNode.insertBefore(container, ta);
ta.style.display = 'none';

const view = new EditorView({
    state: EditorState.create({
        doc: ta.value,
        extensions: [
            history(),
            EditorView.lineWrapping,
            keymap.of([...defaultKeymap, ...historyKeymap]),
            markdown(),
            syntaxHighlighting(highlightStyle),
            placeholder("What's on your mind?"),
            EditorView.contentAttributes.of({ spellcheck: 'true', autocorrect: 'on' }),
            EditorView.updateListener.of(update => {
                if (update.docChanged) {
                    ta.value = update.state.doc.toString();
                    ta.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }),
            editorTheme,
        ],
    }),
    parent: container,
});

// ── Public API ──────────────────────────────────────────────
window.__editor = {
    getValue:  () => view.state.doc.toString(),
    setValue:  (text) => {
        const cur = view.state.doc.toString();
        if (cur === text) return;
        view.dispatch({ changes: { from: 0, to: cur.length, insert: text || '' } });
    },
    focus: () => view.focus(),
    view,
};
