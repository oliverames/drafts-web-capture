document.addEventListener('DOMContentLoaded', function () {

    // ── State ─────────────────────────────────────────────────
    let tabs        = [];
    let activeTabId = null;
    let tagList     = [];
    let draftQueue  = [];
    let saveTimer   = null;
    let attachedFiles = [];
    let clearAllConfirmTimer = null;

    // ── DOM refs ──────────────────────────────────────────────
    const captureForm    = document.getElementById('capture-form');
    const alertContainer = document.getElementById('alert-container');

    // ── Init ─────────────────────────────────────────────────
    loadPreferences();
    loadTabs();             // must follow loadPreferences (new tabs inherit preferred syntax)
    checkAuth();            // show setup screen if no mail drop address configured
    handleUrlParameters();
    loadDraftQueue();
    setupBeforeUnloadHandler();
    setupEditorToggle();
    setupTagInput();
    setupTabDragScroll();
    setupAttachments();

    if (captureForm) captureForm.addEventListener('submit', handleFormSubmit);
    document.getElementById('clear-btn')?.addEventListener('click', clearForm);
    document.getElementById('tab-new-btn')?.addEventListener('click', newTab);

    // Auto-save current tab + refresh tab title as user types
    document.getElementById('draft-content')?.addEventListener('input', () => {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
            saveCurrentTabContent();
            // Update only the active tab's label — no need to rebuild all tabs
            const hasEmail  = !!localStorage.getItem('mailDropAddress');
            const activeEl  = document.querySelector('#tab-scroll .tab-item.active');
            const activeTab = tabs.find(t => t.id === activeTabId);
            if (activeEl && activeTab) {
                const lbl = activeEl.querySelector('.tab-label');
                if (lbl) lbl.textContent = tabTitle(activeTab);
                activeEl.classList.toggle('local-only', !!(activeTab.content.trim() && !hasEmail));
            }
            const sendAllBtn = document.getElementById('send-all-btn');
            if (sendAllBtn) {
                sendAllBtn.disabled = !(tabs.filter(t => t.content.trim()).length > 1 && hasEmail);
            }
        }, 400);
    });
    document.getElementById('draft-syntax')?.addEventListener('change', saveCurrentTabContent);
    document.getElementById('draft-flagged')?.addEventListener('change', saveCurrentTabContent);

    // Request location immediately on checkbox check (triggers permission dialog, caches result)
    document.getElementById('draft-location')?.addEventListener('change', function () {
        if (this.checked && navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                pos => {
                    window.__cachedLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                },
                err => {
                    if (err.code === err.PERMISSION_DENIED) {
                        this.checked = false;
                        window.__cachedLocation = null;
                        showAlert('Location access denied.', 'warning');
                    } else {
                        // POSITION_UNAVAILABLE or TIMEOUT — granted but no fix (common on desktop/localhost)
                        showAlert('Location permission granted but a fix couldn\u2019t be obtained. Will retry on send.', 'info');
                    }
                },
                { timeout: 10000, maximumAge: 300000 }
            );
        } else {
            window.__cachedLocation = null;
        }
        saveCurrentTabContent();
    });

    document.getElementById('save-maildrop-btn')?.addEventListener('click', () => {
        const input = document.getElementById('maildrop-input');
        if (input.value.includes('@drafts.io') || input.value.includes('@maildrop.getdrafts.com')) {
            localStorage.setItem('mailDropAddress', input.value.trim());
            localStorage.removeItem('skipCloudKit');
            checkAuth();
            if (window.submitAllDrafts && draftQueue.length > 0) {
                if (confirm('Submit queued drafts now?')) window.submitAllDrafts();
            }
        } else {
            showAlert('Please enter a valid @drafts.io or @maildrop.getdrafts.com address', 'error');
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

    // ── Auth ──────────────────────────────────────────────────

    function checkAuth() {
        const email          = localStorage.getItem('mailDropAddress');
        const skip           = localStorage.getItem('skipCloudKit');
        const setupSection   = document.getElementById('setup-section');
        const captureSection = document.getElementById('capture-section');
        const headerActions  = document.querySelector('.header-actions');
        const hasAuth        = !!(email || skip);
        if (setupSection)   setupSection.style.display   = hasAuth ? 'none' : '';
        if (captureSection) captureSection.style.display = hasAuth ? '' : 'none';
        if (headerActions)  headerActions.style.visibility = hasAuth ? '' : 'hidden';
        document.body.classList.toggle('setup-mode', !hasAuth);
    }

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
        tab.content = window.__editor ? window.__editor.getValue() : document.getElementById('draft-content').value;
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
        if (window.__editor) window.__editor.setValue(tab.content);
        showWriteMode();
    }

    function renderTabs() {
        const scrollEl   = document.getElementById('tab-scroll');
        const sendAllBtn = document.getElementById('send-all-btn');
        const clearAllBtn = document.getElementById('clear-all-tabs-btn');
        if (!scrollEl) return;

        scrollEl.querySelectorAll('.tab-item').forEach(el => el.remove());

        const contentfulTabs = tabs.filter(t => t.content.trim());
        const hasEmail = !!localStorage.getItem('mailDropAddress');

        if (sendAllBtn) {
            sendAllBtn.disabled = !(contentfulTabs.length > 1 && hasEmail);
        }
        if (clearAllBtn) {
            clearAllBtn.disabled = tabs.length <= 1;
        }

        tabs.forEach(tab => {
            const el = document.createElement('button');
            el.type = 'button';
            el.className = 'tab-item' + (tab.id === activeTabId ? ' active' : '');

            // Fade indicator: content exists but no email set
            if (tab.content.trim() && !hasEmail) {
                el.classList.add('local-only');
            }

            const lbl = document.createElement('span');
            lbl.className = 'tab-label';
            lbl.textContent = tabTitle(tab);
            el.appendChild(lbl);

            if (tabs.length > 1) {
                const x = document.createElement('button');
                x.type = 'button';
                x.className = 'tab-close';
                x.setAttribute('aria-label', 'Close draft');
                x.textContent = '\u00d7';
                x.addEventListener('click', evt => { evt.stopPropagation(); closeTab(tab.id); });
                el.appendChild(x);
            }

            el.addEventListener('click', () => switchTab(tab.id));
            scrollEl.appendChild(el);
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
        const scrollEl = document.getElementById('tab-scroll');
        if (scrollEl) scrollEl.scrollLeft = scrollEl.scrollWidth;
    }

    function closeTab(id) {
        const tab = tabs.find(t => t.id === id);
        if (!tab) return;

        // Auto-send or queue content before closing
        if (tab.content.trim()) {
            const email = localStorage.getItem('mailDropAddress');
            const payload = {
                content: tab.content.trim(),
                tags:    tab.tags,
                syntax:  tab.syntax,
                flagged: tab.flagged,
                latitude: 0, longitude: 0,
                attachments: []
            };
            if (email) {
                sendDraftData(payload, email).catch(() => {
                    addToQueue(payload);
                    showAlert('Draft queued (send failed).', 'warning');
                });
            } else {
                addToQueue(payload);
                showAlert('Draft queued. Add a Mail Drop address to sync.', 'info');
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

    // ── Tab drag-to-scroll ────────────────────────────────────

    function setupTabDragScroll() {
        const scrollEl = document.getElementById('tab-scroll');
        if (!scrollEl) return;
        let startX, scrollLeft;

        function onMouseUp() {
            scrollEl.classList.remove('dragging');
            document.removeEventListener('mouseup', onMouseUp);
            document.removeEventListener('mousemove', onMouseMove);
        }
        function onMouseMove(e) {
            e.preventDefault();
            const x    = e.pageX - scrollEl.getBoundingClientRect().left;
            const walk = (x - startX) * 1.5;
            scrollEl.scrollLeft = scrollLeft - walk;
        }
        scrollEl.addEventListener('mousedown', e => {
            if (e.target.closest('.tab-close')) return;
            scrollEl.classList.add('dragging');
            startX = e.pageX - scrollEl.getBoundingClientRect().left;
            scrollLeft = scrollEl.scrollLeft;
            document.addEventListener('mouseup', onMouseUp);
            document.addEventListener('mousemove', onMouseMove);
        });
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
        // Fade-right affordance when chips present
        area.closest('.tags-field')?.classList.toggle('has-tags', tagList.length > 0);
        tagList.forEach((tag, i) => {
            const chip = document.createElement('span');
            chip.className = 'tag-chip';
            chip.appendChild(document.createTextNode(tag));
            const rm = document.createElement('button');
            rm.type = 'button';
            rm.className = 'tag-chip-remove';
            rm.setAttribute('aria-label', 'Remove ' + tag);
            rm.textContent = '\u00d7';
            rm.addEventListener('click', () => {
                tagList.splice(i, 1);
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

        input.addEventListener('blur', () => {
            const v = input.value.replace(/,/g, '').trim();
            if (v) { addTag(v); input.value = ''; }
        });

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
        const ta     = document.getElementById('draft-content');
        const pre    = document.getElementById('preview-pane');
        const cmRoot = document.getElementById('cm-editor-root');
        const wb     = document.getElementById('view-write');
        const pb     = document.getElementById('view-preview');
        if (cmRoot) cmRoot.style.display = '';
        else if (ta) ta.style.display = '';
        if (pre) { pre.style.display = 'none'; pre.style.minHeight = ''; }
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
            const cmRoot = document.getElementById('cm-editor-root');
            // Lock preview to current editor height so switching doesn't resize the card
            const editorEl = cmRoot || ta;
            previewEl.style.minHeight = editorEl.offsetHeight + 'px';
            if (cmRoot) cmRoot.style.display = 'none';
            else ta.style.display = 'none';
            previewEl.style.display = '';
            const content = window.__editor ? window.__editor.getValue() : (ta.value || '');
            const syntax  = document.getElementById('draft-syntax')?.value || 'Markdown';
            const isMarkdown = ['Markdown', 'MultiMarkdown', 'GitHub Markdown'].includes(syntax);
            previewEl.textContent = '';
            if (!content.trim()) {
                const em = document.createElement('em');
                em.className = 'preview-empty';
                em.textContent = 'Nothing to preview yet.';
                previewEl.appendChild(em);
            } else if (isMarkdown && window.marked) {
                const fragment = document.createRange().createContextualFragment(
                    window.marked.parse(content)
                );
                fragment.querySelectorAll('a').forEach(a => {
                    a.target = '_blank';
                    a.rel = 'noopener noreferrer';
                });
                previewEl.appendChild(fragment);
            } else {
                const pre = document.createElement('pre');
                pre.className = 'preview-plain';
                pre.textContent = content;
                previewEl.appendChild(pre);
            }
        });
    }

    // ── Attachments ───────────────────────────────────────────

    function setupAttachments() {
        const fileInput   = document.getElementById('draft-attachments');
        const attachLabel = document.querySelector('.attach-field');
        const labelText   = document.getElementById('attach-label');
        if (!fileInput || !attachLabel) return;

        attachLabel.addEventListener('click', e => {
            e.preventDefault();
            fileInput.click();
        });

        fileInput.addEventListener('change', () => {
            attachedFiles = Array.from(fileInput.files || []);
            if (attachedFiles.length > 0) {
                labelText.textContent = attachedFiles.length + ' file' + (attachedFiles.length > 1 ? 's' : '');
                attachLabel.classList.add('has-files');
            } else {
                labelText.textContent = 'Attach';
                attachLabel.classList.remove('has-files');
            }
        });
    }

    async function readFilesAsBase64(files) {
        return Promise.all(files.map(file => new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload  = () => resolve({ filename: file.name, content: reader.result.split(',')[1] });
            reader.onerror = reject;
            reader.readAsDataURL(file);
        })));
    }

    // ── Focus helper ─────────────────────────────────────────

    function focusEditor() {
        if (window.__editor) window.__editor.focus();
        else document.getElementById('draft-content')?.focus();
    }

    // ── Form ─────────────────────────────────────────────────

    function clearForm() {
        document.getElementById('draft-content').value = '';
        if (window.__editor) window.__editor.setValue('');
        tagList = [];
        renderChips();
        document.getElementById('draft-flagged').checked = false;
        attachedFiles = [];
        const fi = document.getElementById('draft-attachments');
        if (fi) fi.value = '';
        const lbl = document.getElementById('attach-label');
        if (lbl) lbl.textContent = 'Attach';
        document.querySelector('.attach-field')?.classList.remove('has-files');
        showWriteMode();
        focusEditor();
        window.__resizeTextarea?.();
        saveCurrentTabContent();
        renderTabs();
    }

    async function handleFormSubmit(e) {
        e.preventDefault();

        const content     = window.__editor ? window.__editor.getValue() : document.getElementById('draft-content').value;
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
        if (useLocation) {
            if (window.__cachedLocation) {
                latitude  = window.__cachedLocation.lat;
                longitude = window.__cachedLocation.lng;
            } else if (navigator.geolocation) {
                try {
                    const pos = await new Promise((resolve, reject) =>
                        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
                    );
                    latitude  = pos.coords.latitude;
                    longitude = pos.coords.longitude;
                } catch { /* proceed without location */ }
            }
        }

        let attachments = [];
        if (attachedFiles.length > 0) {
            try { attachments = await readFilesAsBase64(attachedFiles); }
            catch { showAlert('Could not read attachments — sending without them.', 'warning'); }
        }

        const draftData = { content: content.trim(), tags, syntax, flagged, latitude, longitude, attachments };
        const email = localStorage.getItem('mailDropAddress');

        if (email) {
            showLoading();
            sendDraftData(draftData, email)
                .then(() => {
                    hideLoading();
                    const tab = tabs.find(t => t.id === activeTabId);
                    if (tab) { tab.content = ''; tab.tags = ''; tab.flagged = false; }
                    saveTabs();
                    clearForm();
                    showAlert('Draft sent via Mail Drop!', 'success');
                    handleBookmarkletRedirect();
                })
                .catch(err => {
                    hideLoading();
                    console.error('Mail Drop error:', err);
                    addToQueue(draftData);
                    showAlert('Sync failed — draft queued for retry.', 'warning');
                });
        } else {
            addToQueue(draftData);
            showAlert('Draft saved locally. Add a Mail Drop address to sync to Drafts.', 'info');
        }
    }

    function sendDraftData(draftData, email) {
        return fetch('https://drafts-ck-proxy.oliverames.workers.dev', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, ...draftData })
        }).then(r => r.json().then(d => {
            if (!r.ok) return Promise.reject(d.error || 'API Error');
            return { success: true };
        }));
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
        if (e.shiftKey && e.ctrlKey && e.key.toLowerCase() === 'n') {
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
        div.className = 'alert ' + type;
        div.textContent = message;
        alertContainer.prepend(div);
        const delay = type === 'error' ? 8000 : type === 'warning' ? 6000 : 4000;
        setTimeout(() => {
            div.style.transition = 'opacity 0.4s';
            div.style.opacity    = '0';
            setTimeout(() => div.remove(), 400);
        }, delay);
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
            const val = decodeURIComponent(text);
            document.getElementById('draft-content').value = val;
            if (window.__editor) window.__editor.setValue(val);
            window.__resizeTextarea?.();
        } else {
            const url   = p.get('url');
            const title = p.get('title');
            const sel   = p.get('sel');
            if (url && title) {
                let s = '[' + title + '](' + url + ')';
                if (sel) s += '\n\n> ' + sel + '\n';
                document.getElementById('draft-content').value = s;
                if (window.__editor) window.__editor.setValue(s);
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
                    showAlert(draftQueue.length + ' draft(s) queued from a previous session.', 'info');
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
        list.textContent = '';
        draftQueue.forEach((draft, index) => {
            const el     = document.createElement('div');
            el.className = 'draft-item';

            const header = document.createElement('div');
            header.className = 'draft-item-header';

            const titleSpan = document.createElement('span');
            titleSpan.className = 'draft-item-title';
            titleSpan.textContent = 'Draft ' + (index + 1);

            const actions   = document.createElement('div');
            actions.className = 'draft-item-actions';

            [['Submit', 'submit-draft-btn'],
             ['Edit',   'edit-draft-btn'  ],
             ['\u00d7', 'remove-draft-btn']].forEach(([txt, cls]) => {
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
        const email = localStorage.getItem('mailDropAddress');
        if (!email) {
            showAlert('Add a Mail Drop address to submit queued drafts.', 'error'); return;
        }
        sendDraftData(draftQueue[index], email)
            .then(() => {
                draftQueue.splice(index, 1);
                saveDraftQueue();
                showAlert('Draft submitted to Drafts.', 'success');
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
        if (window.__editor) window.__editor.setValue(draft.content);
        setTagsFromString(draft.tags || '');
        document.getElementById('draft-syntax').value    = draft.syntax || 'Markdown';
        document.getElementById('draft-flagged').checked = !!draft.flagged;
        draftQueue.splice(index, 1);
        saveDraftQueue();
        focusEditor();
        window.__resizeTextarea?.();
        saveCurrentTabContent();
        renderTabs();
    }

    function removeDraft(index) {
        if (index < 0 || index >= draftQueue.length) return;
        if (confirm('Remove draft ' + (index + 1) + ' from queue?')) {
            draftQueue.splice(index, 1);
            saveDraftQueue();
        }
    }

    function setupBeforeUnloadHandler() {
        window.addEventListener('beforeunload', e => {
            saveCurrentTabContent();
            if (draftQueue.length > 0) {
                const msg = 'You have ' + draftQueue.length + ' queued draft(s) waiting to sync. Leave anyway?';
                e.preventDefault(); e.returnValue = msg; return msg;
            }
        });
    }

    function submitAllDrafts() {
        const email = localStorage.getItem('mailDropAddress');
        if (!email) {
            showAlert('Add a Mail Drop address to send drafts to Drafts.', 'error'); return;
        }
        saveCurrentTabContent();
        const tabDrafts = tabs
            .filter(t => t.content.trim())
            .map(t => ({
                content: t.content.trim(),
                tags:    t.tags,
                syntax:  t.syntax,
                flagged: t.flagged,
                latitude: 0, longitude: 0,
                attachments: []
            }));
        const allDrafts = [...tabDrafts, ...draftQueue];
        if (!allDrafts.length) { showAlert('No drafts to send.', 'info'); return; }
        showLoading();
        const next = (i = 0) => {
            if (i >= allDrafts.length) {
                tabs.forEach(t => { t.content = ''; t.tags = ''; t.flagged = false; });
                saveTabs();
                draftQueue = []; saveDraftQueue();
                hideLoading();
                renderTabs();
                loadTabContent(activeTabId);
                showAlert(allDrafts.length + ' draft(s) sent to Drafts.', 'success');
                handleBookmarkletRedirect(); return;
            }
            sendDraftData(allDrafts[i], email)
                .then(() => next(i + 1))
                .catch(err => { hideLoading(); showAlert('Error on draft ' + (i + 1) + ': ' + (err.message || err), 'error'); });
        };
        next();
    }

    function clearAllTabs() {
        const btn = document.getElementById('clear-all-tabs-btn');
        if (!btn) return;
        if (clearAllConfirmTimer !== null) {
            clearTimeout(clearAllConfirmTimer);
            clearAllConfirmTimer = null;
            btn.classList.remove('btn-confirm-danger');
            btn.textContent = 'Clear All';
            tabs = [makeTab()];
            activeTabId = tabs[0].id;
            saveTabs();
            renderTabs();
            loadTabContent(activeTabId);
        } else {
            btn.classList.add('btn-confirm-danger');
            btn.textContent = 'Confirm?';
            clearAllConfirmTimer = setTimeout(() => {
                clearAllConfirmTimer = null;
                btn.classList.remove('btn-confirm-danger');
                btn.textContent = 'Clear All';
            }, 3000);
        }
    }

    function discardAllDrafts() {
        if (!draftQueue.length) return;
        if (confirm('Discard all ' + draftQueue.length + ' queued draft(s)?')) {
            draftQueue = []; saveDraftQueue();
        }
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
