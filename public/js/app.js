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

    // ── Init ─────────────────────────────────────────────────
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

    // Auto-save current tab + refresh tab title as user types
    document.getElementById('draft-content')?.addEventListener('input', () => {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => { saveCurrentTabContent(); renderTabs(); }, 400);
    });
    document.getElementById('draft-syntax')?.addEventListener('change', saveCurrentTabContent);
    document.getElementById('draft-flagged')?.addEventListener('change', saveCurrentTabContent);

    // "Continue without signing in"
    document.getElementById('use-local-btn')?.addEventListener('click', () => {
        document.getElementById('sign-in-section').style.display = 'none';
        document.getElementById('capture-section').style.display = '';
        localStorage.setItem('skipCloudKit', '1');
    });

    // Sign out
    document.getElementById('sign-out-btn')?.addEventListener('click', () => {
        localStorage.removeItem('skipCloudKit');
        window.cloudkit?.signOut?.();
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
            syntax:  data.syntax  || localStorage.getItem('preferredSyntax') || 'Markdown',
            flagged: !!data.flagged,
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
        tab.content = document.getElementById('draft-content').value;
        tab.tags    = document.getElementById('draft-tags').value;
        tab.syntax  = document.getElementById('draft-syntax').value;
        tab.flagged = document.getElementById('draft-flagged').checked;
        saveTabs();
    }

    function loadTabContent(id) {
        const tab = tabs.find(t => t.id === id);
        if (!tab) return;
        document.getElementById('draft-content').value   = tab.content;
        setTagsFromString(tab.tags);
        const sel = document.getElementById('draft-syntax');
        if (sel) sel.value = tab.syntax;
        document.getElementById('draft-flagged').checked = tab.flagged;
        window.__resizeTextarea?.();
        showWriteMode();
    }

    function renderTabs() {
        const bar       = document.getElementById('tab-bar');
        const newBtn    = document.getElementById('tab-new-btn');
        const sendAllBtn = document.getElementById('send-all-btn');
        if (!bar) return;
        bar.querySelectorAll('.tab-item').forEach(el => el.remove());
        // Show header "Send All" button only when multiple tabs have content
        if (sendAllBtn) {
            const contentfulTabs = tabs.filter(t => t.content.trim());
            sendAllBtn.style.display = contentfulTabs.length > 1 ? '' : 'none';
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
        document.getElementById('draft-content')?.focus();
    }

    function newTab() {
        saveCurrentTabContent();
        const tab = makeTab();
        tabs.push(tab);
        activeTabId = tab.id;
        saveTabs();
        renderTabs();
        loadTabContent(tab.id);
        document.getElementById('draft-content')?.focus();
    }

    function closeTab(id) {
        const tab = tabs.find(t => t.id === id);
        if (!tab) return;
        if (tab.content.trim() && !confirm('Discard this draft?')) return;
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
        const ta  = document.getElementById('draft-content');
        const pre = document.getElementById('preview-pane');
        const wb  = document.getElementById('view-write');
        const pb  = document.getElementById('view-preview');
        if (ta)  ta.style.display  = '';
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
            ta.style.display      = 'none';
            previewEl.style.display = '';
            const md = ta.value || '';
            if (window.marked) {
                previewEl.innerHTML = window.marked.parse(
                    md || '*Nothing to preview yet.*'
                );
            } else {
                // Fallback: basic escaping
                previewEl.textContent = md || 'Nothing to preview yet.';
            }
        });
    }

    // ── Form ─────────────────────────────────────────────────

    function clearForm() {
        document.getElementById('draft-content').value = '';
        tagList = [];
        renderChips();
        document.getElementById('draft-flagged').checked = false;
        showWriteMode();
        document.getElementById('draft-content').focus();
        window.__resizeTextarea?.();
        saveCurrentTabContent();
        renderTabs();
    }

    async function handleFormSubmit(e) {
        e.preventDefault();

        const content     = document.getElementById('draft-content').value;
        const tags        = document.getElementById('draft-tags').value;
        const syntax      = document.getElementById('draft-syntax').value;
        const flagged     = document.getElementById('draft-flagged').checked;
        const useLocation = document.getElementById('draft-location').checked;

        if (!content || !content.trim()) {
            showAlert('Content is required.', 'error');
            return;
        }

        savePreferences();

        let latitude = 0.0, longitude = 0.0;
        if (useLocation && navigator.geolocation) {
            try {
                const pos = await new Promise((resolve, reject) =>
                    navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
                );
                latitude  = pos.coords.latitude;
                longitude = pos.coords.longitude;
            } catch { /* proceed without location */ }
        }

        const draftData = { content: content.trim(), tags, syntax, flagged, latitude, longitude };

        if (window.cloudkit && window.cloudkit.isAuthenticated()) {
            showLoading();
            window.cloudkit.createDraft(draftData)
                .then(result => {
                    hideLoading();
                    clearForm();
                    showAlert(
                        `Draft created! <a href="${result.draft.draftsUrl}" target="_blank" rel="noopener">Open in Drafts &rarr;</a>`,
                        'success'
                    );
                    handleBookmarkletRedirect();
                })
                .catch(err => {
                    hideLoading();
                    console.error('CloudKit error:', err);
                    addToQueue(draftData);
                    showAlert('Sync failed \u2014 draft queued for retry.', 'warning');
                });
        } else {
            addToQueue(draftData);
            showAlert('Draft saved locally. Sign in to sync to Drafts.', 'info');
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
        if (e.shiftKey && e.ctrlKey && (e.key === 'Enter' || e.key === 'Return')) {
            e.preventDefault();
            captureForm?.dispatchEvent(new Event('submit', { cancelable: true }));
        } else if (e.shiftKey && e.ctrlKey && e.key.toLowerCase() === 'b') {
            e.preventDefault();
            document.getElementById('draft-content')?.focus();
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
        if (type === 'success') {
            setTimeout(() => {
                div.style.transition = 'opacity 0.4s';
                div.style.opacity    = '0';
                setTimeout(() => div.remove(), 400);
            }, 6000);
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

    function savePreferences() {
        localStorage.setItem('preferredSyntax', document.getElementById('draft-syntax').value);
        localStorage.setItem('useLocation',     document.getElementById('draft-location').checked);
    }

    function loadPreferences() {
        const syntax = localStorage.getItem('preferredSyntax');
        if (syntax) {
            const sel = document.getElementById('draft-syntax');
            if (sel) sel.value = syntax;
        }
        if (localStorage.getItem('useLocation') === 'true') {
            const loc = document.getElementById('draft-location');
            if (loc) loc.checked = true;
        }
    }

    // ── URL parameters (bookmarklet) ──────────────────────────

    function handleUrlParameters() {
        const p = new URLSearchParams(window.location.search);

        const text = p.get('text');
        if (text) {
            document.getElementById('draft-content').value = decodeURIComponent(text);
            window.__resizeTextarea?.();
        } else {
            const url   = p.get('url');
            const title = p.get('title');
            const sel   = p.get('sel');
            if (url && title) {
                let s = `[${title}](${url})`;
                if (sel) s += `\n\n> ${sel}\n`;
                document.getElementById('draft-content').value = s;
                window.__resizeTextarea?.();
            }
        }

        const tags = p.get('tags');
        if (tags) setTagsFromString(decodeURIComponent(tags));

        if (p.get('flagged') === '1') {
            const f = document.getElementById('draft-flagged');
            if (f) f.checked = true;
        }

        const syntax = p.get('syntax');
        if (syntax) {
            const sel = document.getElementById('draft-syntax');
            if (sel) {
                for (let i = 0; i < sel.options.length; i++) {
                    if (sel.options[i].value.toLowerCase() === syntax.toLowerCase()) {
                        sel.selectedIndex = i; break;
                    }
                }
            }
        }

        const redirect = p.get('redirect');
        const url      = p.get('url');
        if (redirect && url) {
            localStorage.setItem('captureRedirectType', redirect);
            localStorage.setItem('captureRedirectUrl',  url);
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
        if (!window.cloudkit?.isAuthenticated()) {
            showAlert('Sign in to submit queued drafts.', 'error'); return;
        }
        window.cloudkit.createDraft(draftQueue[index])
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
        document.getElementById('draft-content').value   = draft.content;
        setTagsFromString(draft.tags || '');
        document.getElementById('draft-syntax').value    = draft.syntax || 'Markdown';
        document.getElementById('draft-flagged').checked = !!draft.flagged;
        draftQueue.splice(index, 1);
        saveDraftQueue();
        document.getElementById('draft-content').focus();
        window.__resizeTextarea?.();
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
        if (!window.cloudkit?.isAuthenticated()) {
            showAlert('Sign in to send drafts to Drafts.', 'error'); return;
        }
        // Collect: all tabs with content + any queued drafts
        saveCurrentTabContent();
        const tabDrafts = tabs
            .filter(t => t.content.trim())
            .map(t => ({
                content: t.content.trim(),
                tags:    t.tags,
                syntax:  t.syntax,
                flagged: t.flagged,
                latitude: 0, longitude: 0
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
            window.cloudkit.createDraft(allDrafts[i])
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

    // ── Global exports ────────────────────────────────────────
    window.submitAllDrafts  = submitAllDrafts;
    window.discardAllDrafts = discardAllDrafts;
    window.showLoading      = showLoading;
    window.hideLoading      = hideLoading;
    window.showAlert        = showAlert;
    window.newTab           = newTab;
});
