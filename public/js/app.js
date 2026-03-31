document.addEventListener('DOMContentLoaded', function () {

    // ── State ─────────────────────────────────────────────────
    let tabs        = [];
    let activeTabId = null;
    let tagList     = [];
    let draftQueue  = [];
    let saveTimer   = null;

    // ── DOM refs ──────────────────────────────────────────────
    const captureForm    = document.getElementById('capture-form');
    const alertContainer = document.getElementById('alert-container');

    // ── Editor helpers (CM6 or plain textarea) ────────────────
    function setEditorContent(text) {
        const el = document.getElementById('draft-content');
        if (el) el.value = text;
        if (window.__editor) window.__editor.setValue(text);
        else window.__resizeTextarea?.();
    }
    function focusEditor() {
        if (window.__editor) window.__editor.focus();
        else document.getElementById('draft-content')?.focus();
    }

    // ── Init ─────────────────────────────────────────────────

    // Restore local-only mode immediately (don't wait for CloudKit to load)
    if (localStorage.getItem('skipCloudKit') === '1') {
        document.getElementById('capture-section').style.display = '';
    }

    loadPreferences();
    loadTabs();             // must follow loadPreferences (new tabs inherit preferred syntax)
    handleUrlParameters();
    loadDraftQueue();
    setupBeforeUnloadHandler();
    setupEditorToggle();
    setupTagInput();

    if (captureForm) captureForm.addEventListener('submit', handleFormSubmit);
    document.getElementById('clear-btn')?.addEventListener('click', clearForm);
    document.getElementById('tab-new-btn')?.addEventListener('click', newTab);
    setupTabBarDragScroll();

    // Auto-save current tab + refresh tab title as user types
    document.getElementById('draft-content')?.addEventListener('input', () => {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => { saveCurrentTabContent(); renderTabs(); }, 400);
    });
    document.getElementById('draft-syntax')?.addEventListener('change', saveCurrentTabContent);
    document.getElementById('draft-flagged')?.addEventListener('change', saveCurrentTabContent);

    // ── Auth & Initialization ─────────────────────────────────
    const checkAuth = () => {
        if (localStorage.getItem('mailDropAddress') || localStorage.getItem('skipCloudKit') === '1') {
            document.getElementById('setup-section').style.display = 'none';
            document.getElementById('capture-section').style.display = '';
        } else {
            document.getElementById('setup-section').style.display = '';
            document.getElementById('capture-section').style.display = 'none';
        }
    };
    checkAuth();

    document.getElementById('save-maildrop-btn')?.addEventListener('click', () => {
        const input = document.getElementById('maildrop-input');
        if (input.value.includes('@drafts.io')) {
            localStorage.setItem('mailDropAddress', input.value.trim());
            localStorage.removeItem('skipCloudKit');
            checkAuth();
            if (window.submitAllDrafts && draftQueue.length > 0) {
                if (confirm('Submit queued drafts now?')) window.submitAllDrafts();
            }
        } else {
            showAlert('Please enter a valid @drafts.io address', 'error');
        }
    });

    document.getElementById('change-address-btn')?.addEventListener('click', () => {
        localStorage.removeItem('mailDropAddress');
        localStorage.removeItem('skipCloudKit');
        checkAuth();
    });

    document.getElementById('use-local-btn')?.addEventListener('click', () => {
        localStorage.setItem('skipCloudKit', '1');
        checkAuth();
    });

    // ── Tabs ─────────────────────────────────────────────────

    function tabTitle(tab) {
        if (!tab.content.trim()) return 'New Draft';
        const first = tab.content.trim().split('\n')[0]
            .replace(/^#+\s*/, '').trim();
        return first.length > 26 ? first.slice(0, 26) + '\u2026' : first;
    }

    function makeTab(data = {}) {
        const id = 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
        return {
            id,
            content: data.content || '',
            tags:    data.tags    || '',
            
            
        };
    }

    function loadTabs() {
        try {
            const raw = localStorage.getItem('draftTabs');
            const act = localStorage.getItem('activeTabId');
            tabs = raw ? JSON.parse(raw) : [];
            if (!tabs.length) tabs = [makeTab()];
            activeTabId = (act && tabs.some(t => t.id === act)) ? act : tabs[0].id;
        } catch {
            tabs = [makeTab()];
            activeTabId = tabs[0].id;
        }
        renderTabs();
        loadTabContent(activeTabId);
    }

    function saveTabs() {
        try {
            localStorage.setItem('draftTabs', JSON.stringify(tabs));
            localStorage.setItem('activeTabId', activeTabId);
        } catch { /* storage quota */ }
    }

    function saveCurrentTabContent() {
        const tab = tabs.find(t => t.id === activeTabId);
        if (!tab) return;
        tab.content = window.__editor ? window.__editor.getValue() : document.getElementById('draft-content').value;
        tab.tags    = document.getElementById('draft-tags').value;
        
        
        saveTabs();
    }

    function loadTabContent(id) {
        const tab = tabs.find(t => t.id === id);
        if (!tab) return;
        setEditorContent(tab.content);
        setTagsFromString(tab.tags);
        
        showWriteMode();
    }

    function renderTabs() {
        const bar           = document.getElementById('tab-bar');
        const newBtn        = document.getElementById('tab-new-btn');
        const sendAllBtn    = document.getElementById('send-all-btn');
        const clearAllBtn   = document.getElementById('clear-all-tabs-btn');
        if (!bar) return;
        bar.querySelectorAll('.tab-item').forEach(el => el.remove());
        // Show header "Send All" button only when multiple tabs have content
        if (sendAllBtn) {
            const contentfulTabs = tabs.filter(t => t.content.trim());
            sendAllBtn.style.display = contentfulTabs.length > 1 ? '' : 'none';
        }
        // Show "Clear All" when 2+ tabs exist
        if (clearAllBtn) {
            clearAllBtn.style.display = tabs.length > 1 ? '' : 'none';
        }

        tabs.forEach(tab => {
            const el = document.createElement('button');
            el.type = 'button';
            el.className = 'tab-item' + (tab.id === activeTabId ? ' active' : '');

            const lbl = document.createElement('span');
            lbl.className = 'tab-label';
            lbl.textContent = tabTitle(tab);
            el.appendChild(lbl);

            if (tabs.length > 1) {
                const x = document.createElement('button');
                x.type = 'button';
                x.className = 'tab-close';
                x.setAttribute('aria-label', 'Close draft');
                x.innerHTML = '&times;';
                x.addEventListener('click', e => { e.stopPropagation(); closeTab(tab.id); });
                el.appendChild(x);
            }

            el.addEventListener('click', () => switchTab(tab.id));
            if (newBtn) bar.insertBefore(el, newBtn);
            else        bar.appendChild(el);
        });
    }

    function switchTab(id) {
        if (id === activeTabId) return;
        saveCurrentTabContent();
        activeTabId = id;
        saveTabs();
        renderTabs();
        loadTabContent(id);
        focusEditor();
    }

    function newTab() {
        saveCurrentTabContent();
        const tab = makeTab();
        tabs.push(tab);
        activeTabId = tab.id;
        saveTabs();
        renderTabs();
        loadTabContent(tab.id);
        focusEditor();
    }

    function closeTab(id) {
        const tab = tabs.find(t => t.id === id);
        if (!tab) return;

        // Auto-send the draft if it has content and user is authenticated
        if (tab.content.trim()) {
            const draftData = {
                content: tab.content.trim(), tags: tab.tags
            };
            const email = localStorage.getItem('mailDropAddress');
        if (email) {
                fetch('https://drafts-ck-proxy.oliverames.workers.dev', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: localStorage.getItem('mailDropAddress'), content: draftData.content, tags: draftData.tags })
            }).then(r => r.json().then(d => r.ok ? { success: true, draft: {} } : Promise.reject(d.error || 'API Error')))
                    .then(() => showAlert('Closed tab sent to Drafts.', 'success'))
                    .catch(err => {
                        console.error('Auto-send on close failed:', err);
                        addToQueue(draftData);
                        showAlert('Tab queued for sync.', 'warning');
                    });
            } else {
                addToQueue(draftData);
                showAlert('Tab saved locally. Add a Mail Drop address to sync.', 'info');
            }
        }

        const idx = tabs.indexOf(tab);
        tabs.splice(idx, 1);
        if (!tabs.length) tabs = [makeTab()];
        if (activeTabId === id) {
            activeTabId = tabs[Math.min(idx, tabs.length - 1)].id;
        }
        saveTabs();
        renderTabs();
        loadTabContent(activeTabId);
    }

    // ── Tag chips ─────────────────────────────────────────────

    function setTagsFromString(str) {
        tagList = str
            ? str.split(',').map(t => t.trim().toLowerCase()).filter(Boolean)
            : [];
        renderChips();
    }

    function syncTagsHidden() {
        const hidden = document.getElementById('draft-tags');
        if (hidden) hidden.value = tagList.join(', ');
    }

    function renderChips() {
        const area  = document.getElementById('tags-area');
        const input = document.getElementById('tags-input');
        if (!area || !input) return;
        area.querySelectorAll('.tag-chip').forEach(el => el.remove());
        tagList.forEach((tag, i) => {
            const chip = document.createElement('span');
            chip.className = 'tag-chip';
            chip.appendChild(document.createTextNode(tag));
            const rm = document.createElement('button');
            rm.type = 'button';
            rm.className = 'tag-chip-remove';
            rm.setAttribute('aria-label', `Remove ${tag}`);
            rm.innerHTML = '&times;';
            rm.addEventListener('click', () => {
                tagList.splice(i, 1);
                syncTagsHidden();
                renderChips();
                saveCurrentTabContent();
            });
            chip.appendChild(rm);
            area.insertBefore(chip, input);
        });
        syncTagsHidden();
    }

    function addTag(text) {
        const clean = text.trim().toLowerCase();
        if (!clean || tagList.includes(clean)) return;
        tagList.push(clean);
        renderChips();
        saveCurrentTabContent();
    }

    function setupTagInput() {
        const input = document.getElementById('tags-input');
        if (!input) return;

        input.addEventListener('keydown', e => {
            if (e.key === ',' || e.key === 'Enter') {
                e.preventDefault();
                const v = input.value.replace(/,/g, '').trim();
                if (v) { addTag(v); input.value = ''; }
            } else if (e.key === 'Tab' && input.value.trim()) {
                e.preventDefault();
                addTag(input.value.replace(/,/g, '').trim());
                input.value = '';
            } else if (e.key === 'Backspace' && !input.value && tagList.length) {
                tagList.pop();
                syncTagsHidden();
                renderChips();
                saveCurrentTabContent();
            }
        });

        // Commit on blur
        input.addEventListener('blur', () => {
            const v = input.value.replace(/,/g, '').trim();
            if (v) { addTag(v); input.value = ''; }
        });

        // Handle paste with commas
        input.addEventListener('input', () => {
            if (input.value.includes(',')) {
                const parts = input.value.split(',');
                input.value = parts.pop()?.trim() || '';
                parts.forEach(p => addTag(p.trim()));
            }
        });
    }

    // ── Editor toggle (Write / Preview) ──────────────────────

    function showWriteMode() {
        const cm  = document.getElementById('cm-editor-root');
        const ta  = document.getElementById('draft-content');
        const pre = document.getElementById('preview-pane');
        const wb  = document.getElementById('view-write');
        const pb  = document.getElementById('view-preview');
        if (cm)       cm.style.display  = '';
        else if (ta)  ta.style.display  = '';
        if (pre) pre.style.display = 'none';
        wb?.classList.add('active');
        pb?.classList.remove('active');
    }

    function setupEditorToggle() {
        const writeBtn   = document.getElementById('view-write');
        const previewBtn = document.getElementById('view-preview');
        const ta         = document.getElementById('draft-content');
        const previewEl  = document.getElementById('preview-pane');
        if (!writeBtn || !previewBtn || !ta || !previewEl) return;

        writeBtn.addEventListener('click', showWriteMode);

        previewBtn.addEventListener('click', () => {
            previewBtn.classList.add('active');
            writeBtn.classList.remove('active');
            const cm = document.getElementById('cm-editor-root');
            if (cm)  cm.style.display = 'none';
            else     ta.style.display = 'none';
            previewEl.style.display = '';
            const md = window.__editor ? window.__editor.getValue() : (ta.value || '');
            if (window.marked) {
                previewEl.innerHTML = window.marked.parse(
                    md || '*Nothing to preview yet.*'
                );
            } else {
                previewEl.textContent = md || 'Nothing to preview yet.';
            }
        });
    }

    // ── Form ─────────────────────────────────────────────────

    function clearForm() {
        setEditorContent('');
        tagList = [];
        renderChips();
        
        showWriteMode();
        focusEditor();
        saveCurrentTabContent();
        renderTabs();
    }

    async function handleFormSubmit(e) {
        e.preventDefault();

        const content     = document.getElementById('draft-content').value;
        const tags        = document.getElementById('draft-tags').value;
        
        
        

        if (!content || !content.trim()) {
            showAlert('Content is required.', 'error');
            return;
        }

        savePreferences();

        

        const draftData = { content: content.trim(), tags };

        const email = localStorage.getItem('mailDropAddress');
        if (email) {
            showLoading();
            fetch('https://drafts-ck-proxy.oliverames.workers.dev', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: localStorage.getItem('mailDropAddress'), content: draftData.content, tags: draftData.tags })
            }).then(r => r.json().then(d => r.ok ? { success: true, draft: {} } : Promise.reject(d.error || 'API Error')))
                .then(result => {
                    hideLoading();
                    clearForm();
                    // Single tab: stay on blank canvas. Multiple tabs: keep others.
                    renderTabs();
                    showAlert(
                        `Draft created! Draft sent via Mail Drop!`,
                        'success'
                    );
                    handleBookmarkletRedirect();
                })
                .catch(err => {
                    hideLoading();
                    console.error('Mail Drop error:', err);
                    addToQueue(draftData);
                    showAlert('Sync failed \u2014 draft queued for retry.', 'warning');
                });
        } else {
            addToQueue(draftData);
            showAlert('Draft saved locally. Add a Mail Drop address to sync to Drafts.', 'info');
        }
    }

    // ── Bookmarklet redirect ──────────────────────────────────

    function handleBookmarkletRedirect() {
        const type = localStorage.getItem('captureRedirectType');
        const url  = localStorage.getItem('captureRedirectUrl');
        if (!type || !url) return;
        localStorage.removeItem('captureRedirectType');
        localStorage.removeItem('captureRedirectUrl');
        setTimeout(() => {
            if (type === 'back')       window.history.back();
            else if (type === 'close') window.close();
            else if (type === 'url')   window.location.href = url;
        }, 1200);
    }

    // ── Keyboard shortcuts ────────────────────────────────────

    document.addEventListener('keydown', e => {
        // Shift+Cmd+N (Mac) / Shift+Ctrl+N (Win) — new tab
        // (Cmd+N is reserved by browsers to open new windows; can't be prevented)
        if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'n') {
            e.preventDefault();
            newTab();
            return;
        }
        if (e.shiftKey && e.ctrlKey && (e.key === 'Enter' || e.key === 'Return')) {
            e.preventDefault();
            captureForm?.dispatchEvent(new Event('submit', { cancelable: true }));
        } else if (e.shiftKey && e.ctrlKey && e.key.toLowerCase() === 'b') {
            e.preventDefault();
            focusEditor();
        } else if (e.shiftKey && e.ctrlKey && e.key.toLowerCase() === 't') {
            e.preventDefault();
            document.getElementById('tags-input')?.focus();
        } else if (e.shiftKey && e.ctrlKey && e.key.toLowerCase() === 'l') {
            e.preventDefault();
            const f = document.getElementById('draft-flagged');
            if (f) f.checked = !f.checked;
        }
    });

    // ── UI helpers ────────────────────────────────────────────

    function showAlert(message, type) {
        const div = document.createElement('div');
        div.className = `alert ${type}`;
        div.innerHTML = message;
        alertContainer.prepend(div);
        if (type === 'success' || type === 'info') {
            const delay = type === 'success' ? 6000 : 4000;
            setTimeout(() => {
                div.style.transition = 'opacity 0.4s';
                div.style.opacity    = '0';
                setTimeout(() => div.remove(), 400);
            }, delay);
        }
    }

    function showLoading() {
        const btn = document.querySelector('.btn-create');
        if (!btn) return;
        btn.disabled = true;
        const lbl = btn.querySelector('.btn-create-label');
        const spn = btn.querySelector('.loading-spinner');
        if (lbl) lbl.style.display = 'none';
        if (spn) spn.style.display = '';
    }

    function hideLoading() {
        const btn = document.querySelector('.btn-create');
        if (!btn) return;
        btn.disabled = false;
        const lbl = btn.querySelector('.btn-create-label');
        const spn = btn.querySelector('.loading-spinner');
        if (lbl) lbl.style.display = '';
        if (spn) spn.style.display = 'none';
    }

    // ── Preferences ───────────────────────────────────────────

    function savePreferences() {}
    function loadPreferences() {}

    // ── URL parameters (bookmarklet) ──────────────────────────

    function handleUrlParameters() {
        const p = new URLSearchParams(window.location.search);

        const text = p.get('text');
        if (text) {
            setEditorContent(decodeURIComponent(text));
        } else {
            const url   = p.get('url');
            const title = p.get('title');
            const sel   = p.get('sel');
            if (url && title) {
                let s = `[${title}](${url})`;
                if (sel) s += `\n\n> ${sel}\n`;
                setEditorContent(s);
            }
        }

        const tags = p.get('tags');
        if (tags) setTagsFromString(decodeURIComponent(tags));

        const redirect = p.get('redirect');
        const urlParam = p.get('url');
        if (redirect && urlParam) {
            localStorage.setItem('captureRedirectType', redirect);
            localStorage.setItem('captureRedirectUrl',  urlParam);
        }
    }

    // ── Draft queue (offline / pre-auth buffer) ───────────────

    function loadDraftQueue() {
        try {
            const saved = localStorage.getItem('draftQueue');
            if (saved) {
                draftQueue = JSON.parse(saved);
                if (draftQueue.length > 0) {
                    updateQueueIndicator();
                    showAlert(`${draftQueue.length} draft(s) queued from a previous session.`, 'info');
                }
            }
        } catch { draftQueue = []; }
    }

    function saveDraftQueue() {
        localStorage.setItem('draftQueue', JSON.stringify(draftQueue));
        updateQueueIndicator();
    }

    function addToQueue(draftData) {
        draftQueue.push(draftData);
        saveDraftQueue();
        return draftQueue.length;
    }

    function updateQueueIndicator() {
        const section = document.getElementById('queue-section');
        const count   = document.getElementById('queue-count');
        if (count)   count.textContent  = draftQueue.length;
        if (section) {
            section.style.display = draftQueue.length > 0 ? 'block' : 'none';
            if (draftQueue.length > 0) renderDraftList();
        }
    }

    function renderDraftList() {
        const list = document.getElementById('draft-list');
        if (!list) return;
        list.innerHTML = '';
        draftQueue.forEach((draft, index) => {
            const el     = document.createElement('div');
            el.className = 'draft-item';

            const header = document.createElement('div');
            header.className = 'draft-item-header';

            const titleSpan = document.createElement('span');
            titleSpan.className = 'draft-item-title';
            titleSpan.textContent = `Draft ${index + 1}`;

            const actions   = document.createElement('div');
            actions.className = 'draft-item-actions';

            [[  'Submit', 'submit-draft-btn'],
             [  'Edit',   'edit-draft-btn'  ],
             ['\u00d7',   'remove-draft-btn']].forEach(([txt, cls]) => {
                const btn = document.createElement('button');
                btn.type = 'button'; btn.className = cls;
                btn.dataset.index = index; btn.textContent = txt;
                actions.appendChild(btn);
            });

            header.append(titleSpan, actions);

            const preview    = draft.content.length > 120
                ? draft.content.slice(0, 120) + '\u2026' : draft.content;
            const contentDiv = document.createElement('div');
            contentDiv.className   = 'draft-item-content';
            contentDiv.textContent = preview;

            const metaDiv = document.createElement('div');
            metaDiv.className = 'draft-item-meta';
            if (draft.tags) {
                const ts = document.createElement('span');
                ts.className = 'draft-item-tag'; ts.textContent = draft.tags;
                metaDiv.appendChild(ts);
            }
            if (draft.flagged) {
                const fs = document.createElement('span');
                fs.className = 'draft-item-flagged'; fs.textContent = 'Flagged';
                metaDiv.appendChild(fs);
            }

            el.append(header, contentDiv, metaDiv);
            list.appendChild(el);
        });

        list.querySelectorAll('.submit-draft-btn').forEach(btn =>
            btn.addEventListener('click', () => submitDraft(+btn.dataset.index))
        );
        list.querySelectorAll('.edit-draft-btn').forEach(btn =>
            btn.addEventListener('click', () => editDraft(+btn.dataset.index))
        );
        list.querySelectorAll('.remove-draft-btn').forEach(btn =>
            btn.addEventListener('click', () => removeDraft(+btn.dataset.index))
        );
    }

    function submitDraft(index) {
        if (index < 0 || index >= draftQueue.length) return;
        if (!localStorage.getItem('mailDropAddress')) {
            showAlert('Add a Mail Drop address to submit queued drafts.', 'error'); return;
        }
        fetch('https://drafts-ck-proxy.oliverames.workers.dev', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: localStorage.getItem('mailDropAddress'), content: draftQueue[index].content, tags: draftQueue[index].tags })
            }).then(r => r.json().then(d => r.ok ? { success: true, draft: {} } : Promise.reject(d.error || 'API Error')))
            .then(result => {
                if (result?.success) {
                    draftQueue.splice(index, 1);
                    saveDraftQueue();
                    showAlert('Draft submitted to Drafts.', 'success');
                }
            })
            .catch(err => {
                console.error('Submit error:', err);
                showAlert('Failed to submit. Check your connection and try again.', 'error');
            });
    }

    function editDraft(index) {
        if (index < 0 || index >= draftQueue.length) return;
        const draft = draftQueue[index];
        setEditorContent(draft.content);
        setTagsFromString(draft.tags || '');
        
        
        draftQueue.splice(index, 1);
        saveDraftQueue();
        focusEditor();
        saveCurrentTabContent();
        renderTabs();
    }

    function removeDraft(index) {
        if (index < 0 || index >= draftQueue.length) return;
        if (confirm(`Remove draft ${index + 1} from queue?`)) {
            draftQueue.splice(index, 1);
            saveDraftQueue();
        }
    }

    function setupBeforeUnloadHandler() {
        window.addEventListener('beforeunload', e => {
            saveCurrentTabContent(); // always persist before leaving
            if (draftQueue.length > 0) {
                const msg = `You have ${draftQueue.length} queued draft(s) waiting to sync. Leave anyway?`;
                e.preventDefault(); e.returnValue = msg; return msg;
            }
        });
    }

    function submitAllDrafts() {
        if (!localStorage.getItem('mailDropAddress')) {
            showAlert('Add a Mail Drop address to send drafts to Drafts.', 'error'); return;
        }
        // Collect: all tabs with content + any queued drafts
        saveCurrentTabContent();
        const tabDrafts = tabs
            .filter(t => t.content.trim())
            .map(t => ({
                content: t.content.trim(), tags: t.tags
            }));
        const allDrafts = [...tabDrafts, ...draftQueue];
        if (!allDrafts.length) { showAlert('No drafts to send.', 'info'); return; }
        showLoading();
        const next = (i = 0) => {
            if (i >= allDrafts.length) {
                // Clear all submitted tabs and queue
                tabs.forEach(t => { t.content = ''; t.tags = ''; t.flagged = false; });
                saveTabs();
                draftQueue = []; saveDraftQueue();
                hideLoading();
                renderTabs();
                loadTabContent(activeTabId);
                showAlert(`${allDrafts.length} draft(s) sent to Drafts.`, 'success');
                handleBookmarkletRedirect(); return;
            }
            fetch('https://drafts-ck-proxy.oliverames.workers.dev', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: localStorage.getItem('mailDropAddress'), content: allDrafts[i].content, tags: allDrafts[i].tags })
            }).then(r => r.json().then(d => r.ok ? { success: true, draft: {} } : Promise.reject(d.error || 'API Error')))
                .then(() => next(i + 1))
                .catch(err => { hideLoading(); showAlert(`Error on draft ${i + 1}: ${err.message || err}`, 'error'); });
        };
        next();
    }

    function discardAllDrafts() {
        if (!draftQueue.length) return;
        if (confirm(`Discard all ${draftQueue.length} queued draft(s)?`)) {
            draftQueue = []; saveDraftQueue();
        }
    }

    // ── Tab bar drag-to-scroll ────────────────────────────────

    function setupTabBarDragScroll() {
        const bar = document.getElementById('tab-bar');
        if (!bar) return;
        let dragging = false, startX = 0, scrollStart = 0, moved = false;

        bar.addEventListener('mousedown', e => {
            if (e.button !== 0) return;
            dragging   = true;
            moved      = false;
            startX     = e.pageX;
            scrollStart = bar.scrollLeft;
            bar.style.userSelect = 'none';
        });

        document.addEventListener('mousemove', e => {
            if (!dragging) return;
            const dx = e.pageX - startX;
            if (Math.abs(dx) > 4) moved = true;
            if (moved) bar.scrollLeft = scrollStart - dx;
        });

        document.addEventListener('mouseup', () => {
            dragging = false;
            bar.style.userSelect = '';
        });

        // Suppress click-on-tab after a drag
        bar.addEventListener('click', e => {
            if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; }
        }, true);
    }

    // ── Clear all tabs ────────────────────────────────────────

    function clearAllTabs() {
        if (tabs.length <= 1) return;
        if (!confirm(`Close all ${tabs.length} tabs? Tabs with content will be queued.`)) return;
        // Queue any tabs that have content
        tabs.forEach(t => {
            if (t.content.trim()) {
                addToQueue({
                    content: t.content.trim(), tags: t.tags
                });
            }
        });
        tabs = [makeTab()];
        activeTabId = tabs[0].id;
        saveTabs();
        renderTabs();
        loadTabContent(activeTabId);
        focusEditor();
        if (draftQueue.length) showAlert('Tabs closed — drafts queued for sync.', 'info');
    }

    // ── Global exports ────────────────────────────────────────
    window.submitAllDrafts  = submitAllDrafts;
    window.discardAllDrafts = discardAllDrafts;
    window.clearAllTabs     = clearAllTabs;
    window.showLoading      = showLoading;
    window.hideLoading      = hideLoading;
    window.showAlert        = showAlert;
    window.newTab           = newTab;
});
