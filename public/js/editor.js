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
        padding: '22px 22px 16px',
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
                if (update.selectionSet || update.docChanged) {
                    updateSelectionToolbar();
                }
            }),
            editorTheme,
        ],
    }),
    parent: container,
});

// ── Formatting helpers ──────────────────────────────────────

// Wrap selection (or insert placeholder) with before/after characters
function insertFormat(before, after, placeholder) {
    const { state } = view;
    const sel = state.selection.main;
    const selected = state.doc.sliceString(sel.from, sel.to);
    const insert = selected
        ? before + selected + after
        : before + (placeholder || '') + after;
    const anchorOffset = before.length;
    const headOffset   = before.length + (selected || placeholder || '').length;
    view.dispatch({
        changes: { from: sel.from, to: sel.to, insert },
        selection: { anchor: sel.from + anchorOffset, head: sel.from + headOffset },
    });
    view.focus();
}

// Toggle line-level prefix (e.g. '> ', '- ', '# ') on every selected line
function insertLineFormat(prefix) {
    const { state } = view;
    const sel = state.selection.main;
    const fromLine = state.doc.lineAt(sel.from);
    const toLine   = state.doc.lineAt(sel.to);
    const changes  = [];
    const alreadyAll = Array.from(
        { length: toLine.number - fromLine.number + 1 },
        (_, i) => state.doc.line(fromLine.number + i)
    ).every(l => l.text.startsWith(prefix));

    for (let n = fromLine.number; n <= toLine.number; n++) {
        const line = state.doc.line(n);
        if (alreadyAll) {
            // Remove prefix (toggle off)
            changes.push({ from: line.from, to: line.from + prefix.length, insert: '' });
        } else if (!line.text.startsWith(prefix)) {
            changes.push({ from: line.from, to: line.from, insert: prefix });
        }
    }
    if (changes.length) view.dispatch({ changes });
    view.focus();
}

// Cycle heading level on the current line (none → h1 → h2 → h3 → none)
function cycleHeading() {
    const { state } = view;
    const line = state.doc.lineAt(state.selection.main.from);
    const text = line.text;
    const m = text.match(/^(#{1,3}) /);
    let newPrefix;
    if (!m)         newPrefix = '# ';
    else if (m[1].length === 1) newPrefix = '## ';
    else if (m[1].length === 2) newPrefix = '### ';
    else            newPrefix = '';   // strip heading

    const stripped = m ? text.slice(m[0].length) : text;
    view.dispatch({ changes: { from: line.from, to: line.to, insert: newPrefix + stripped } });
    view.focus();
}

// Insert a markdown link — wrap selection or insert template
function insertLinkFormat() {
    const { state } = view;
    const sel = state.selection.main;
    const selected = state.doc.sliceString(sel.from, sel.to);
    const linkText = selected || 'link text';
    const insert   = '[' + linkText + '](url)';
    const urlStart = sel.from + linkText.length + 3;
    const urlEnd   = urlStart + 3;
    view.dispatch({
        changes: { from: sel.from, to: sel.to, insert },
        selection: { anchor: urlStart, head: urlEnd },
    });
    view.focus();
}

// ── Public API ──────────────────────────────────────────────
window.__editor = {
    getValue:          () => view.state.doc.toString(),
    setValue:          (text) => {
        const cur = view.state.doc.toString();
        if (cur === text) return;
        view.dispatch({ changes: { from: 0, to: cur.length, insert: text || '' } });
    },
    focus:             () => view.focus(),
    insertFormat,
    insertLineFormat,
    insertLinkFormat,
    cycleHeading,
    view,
};

// ── Selection toolbar ────────────────────────────────────────

function updateSelectionToolbar() {
    const toolbar = document.getElementById('selection-toolbar');
    if (!toolbar) return;

    const sel = view.state.selection.main;
    if (sel.from === sel.to) {
        toolbar.classList.remove('visible');
        return;
    }

    // Only show for markdown-family syntaxes
    const syntaxEl = document.getElementById('draft-syntax');
    const syntax = syntaxEl ? syntaxEl.value : 'Markdown';
    const isMarkdown = ['Markdown', 'MultiMarkdown', 'GitHub Markdown'].includes(syntax);
    if (!isMarkdown) { toolbar.classList.remove('visible'); return; }

    // Position above the selection midpoint
    const fromCoords = view.coordsAtPos(sel.from);
    const toCoords   = view.coordsAtPos(sel.to);
    if (!fromCoords) return;

    const selLeft  = fromCoords.left;
    const selRight = toCoords ? toCoords.right : fromCoords.right;
    const selTop   = Math.min(fromCoords.top, toCoords ? toCoords.top : fromCoords.top);
    const midX     = (selLeft + selRight) / 2;

    toolbar.classList.add('visible');

    const tbW = toolbar.offsetWidth || 220;
    const tbH = toolbar.offsetHeight || 38;
    const left = Math.max(8, Math.min(midX - tbW / 2, window.innerWidth - tbW - 8));
    const top  = Math.max(8, selTop - tbH - 10);

    toolbar.style.left = left + 'px';
    toolbar.style.top  = top + 'px';
}

// Wire up selection toolbar buttons (mousedown prevents focus loss)
document.addEventListener('DOMContentLoaded', () => {
    const toolbar = document.getElementById('selection-toolbar');
    if (!toolbar) return;

    toolbar.querySelectorAll('.sel-btn').forEach(btn => {
        btn.addEventListener('mousedown', e => {
            e.preventDefault(); // keep CM selection active
            const op     = btn.dataset.op;
            const before = btn.dataset.before || '';
            const after  = btn.dataset.after || '';
            const ph     = btn.dataset.ph || '';
            if (op === 'inline') {
                insertFormat(before, after, ph);
            } else if (op === 'link') {
                insertLinkFormat();
            }
        });
    });
});

// Hide toolbar when clicking outside the editor or toolbar
document.addEventListener('mousedown', e => {
    const toolbar = document.getElementById('selection-toolbar');
    if (!toolbar || !toolbar.classList.contains('visible')) return;
    const editorRoot = document.getElementById('cm-editor-root');
    if (editorRoot?.contains(e.target) || toolbar.contains(e.target)) return;
    toolbar.classList.remove('visible');
});
