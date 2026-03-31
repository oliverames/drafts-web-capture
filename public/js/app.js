document.addEventListener('DOMContentLoaded', function () {
    const captureForm    = document.getElementById('capture-form');
    const alertContainer = document.getElementById('alert-container');
    const clearBtn       = document.getElementById('clear-btn');

    // ── Init ─────────────────────────────────────────────────
    loadPreferences();
    handleUrlParameters();
    loadDraftQueue();
    setupBeforeUnloadHandler();

    if (captureForm) captureForm.addEventListener('submit', handleFormSubmit);
    if (clearBtn)    clearBtn.addEventListener('click', clearForm);

    // "Save locally" — show capture form without CloudKit auth;
    // drafts queue to localStorage until the user signs in.
    const useLocalBtn = document.getElementById('use-local-btn');
    if (useLocalBtn) {
        useLocalBtn.addEventListener('click', () => {
            const signInSection  = document.getElementById('sign-in-section');
            const captureSection = document.getElementById('capture-section');
            if (signInSection)  signInSection.style.display  = 'none';
            if (captureSection) captureSection.style.display = '';
            localStorage.setItem('skipCloudKit', '1');
        });
    }

    // Sign out
    const signOutBtn = document.getElementById('sign-out-btn');
    if (signOutBtn) {
        signOutBtn.addEventListener('click', () => {
            localStorage.removeItem('skipCloudKit');
            if (window.cloudkit && window.cloudkit.signOut) window.cloudkit.signOut();
        });
    }

    // ── Form ─────────────────────────────────────────────────

    function clearForm() {
        document.getElementById('draft-content').value = '';
        document.getElementById('draft-tags').value    = '';
        document.getElementById('draft-flagged').checked = false;
        document.getElementById('draft-content').focus();
        window.__resizeTextarea?.();
    }

    async function handleFormSubmit(e) {
        e.preventDefault();

        const content     = document.getElementById('draft-content').value;
        const tags        = document.getElementById('draft-tags').value;
        const syntax      = document.getElementById('draft-syntax').value;
        const flagged     = document.getElementById('draft-flagged').checked;
        const useLocation = document.getElementById('draft-location').checked;

        if (!content || content.trim() === '') {
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
                        `Draft created! <a href="${result.draft.draftsUrl}" target="_blank" rel="noopener">Open in Drafts</a>`,
                        'success'
                    );
                    handleBookmarkletRedirect();
                })
                .catch(err => {
                    hideLoading();
                    console.error('CloudKit error:', err);
                    addToQueue(draftData);
                    showAlert('Sync failed — draft queued for retry.', 'warning');
                });
        } else {
            // Not authenticated: queue locally
            addToQueue(draftData);
            showAlert('Draft saved locally. Sign in with Apple ID to sync to Drafts.', 'info');
        }
    }

    // ── Bookmarklet redirect ──────────────────────────────────

    function handleBookmarkletRedirect() {
        const redirectType = localStorage.getItem('captureRedirectType');
        const redirectUrl  = localStorage.getItem('captureRedirectUrl');
        if (!redirectType || !redirectUrl) return;
        localStorage.removeItem('captureRedirectType');
        localStorage.removeItem('captureRedirectUrl');
        setTimeout(() => {
            if (redirectType === 'back')       window.history.back();
            else if (redirectType === 'close') window.close();
            else if (redirectType === 'url')   window.location.href = redirectUrl;
        }, 1200);
    }

    // ── Keyboard shortcuts ────────────────────────────────────

    document.addEventListener('keydown', function (e) {
        if (e.shiftKey && e.ctrlKey && (e.key === 'Enter' || e.key === 'Return')) {
            e.preventDefault();
            if (captureForm) captureForm.dispatchEvent(new Event('submit', { cancelable: true }));
        } else if (e.shiftKey && e.ctrlKey && e.key.toLowerCase() === 'b') {
            e.preventDefault();
            const ta = document.getElementById('draft-content');
            if (ta) ta.focus();
        } else if (e.shiftKey && e.ctrlKey && e.key.toLowerCase() === 't') {
            e.preventDefault();
            const tags = document.getElementById('draft-tags');
            if (tags) tags.focus();
        } else if (e.shiftKey && e.ctrlKey && e.key.toLowerCase() === 'l') {
            e.preventDefault();
            const flagged = document.getElementById('draft-flagged');
            if (flagged) flagged.checked = !flagged.checked;
        }
    });

    // ── UI helpers ────────────────────────────────────────────

    function showAlert(message, type) {
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert ${type}`;
        alertDiv.innerHTML = message; // our own controlled strings; user content is not interpolated here
        alertContainer.prepend(alertDiv);
        if (type === 'success') {
            setTimeout(() => {
                alertDiv.style.transition = 'opacity 0.4s';
                alertDiv.style.opacity    = '0';
                setTimeout(() => alertDiv.remove(), 400);
            }, 6000);
        }
    }

    function showLoading() {
        const btn = document.querySelector('.btn-create');
        if (btn) {
            btn.disabled = true;
            const label   = btn.querySelector('.btn-create-label');
            const spinner = btn.querySelector('.loading-spinner');
            if (label)   label.style.display   = 'none';
            if (spinner) spinner.style.display  = '';
        }
    }

    function hideLoading() {
        const btn = document.querySelector('.btn-create');
        if (btn) {
            btn.disabled = false;
            const label   = btn.querySelector('.btn-create-label');
            const spinner = btn.querySelector('.loading-spinner');
            if (label)   label.style.display   = '';
            if (spinner) spinner.style.display  = 'none';
        }
    }

    // ── Preferences ───────────────────────────────────────────

    function savePreferences() {
        localStorage.setItem('preferredSyntax', document.getElementById('draft-syntax').value);
        localStorage.setItem('useLocation',     document.getElementById('draft-location').checked);
    }

    function loadPreferences() {
        const syntax = localStorage.getItem('preferredSyntax');
        if (syntax) { const sel = document.getElementById('draft-syntax'); if (sel) sel.value = syntax; }
        if (localStorage.getItem('useLocation') === 'true') {
            const loc = document.getElementById('draft-location');
            if (loc) loc.checked = true;
        }
    }

    // ── URL parameters (bookmarklet support) ──────────────────

    function handleUrlParameters() {
        const p = new URLSearchParams(window.location.search);

        const text = p.get('text');
        if (text) {
            document.getElementById('draft-content').value = decodeURIComponent(text);
            window.__resizeTextarea?.();
        } else {
            // title+url+sel bookmarklet format (matches official site)
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
        if (tags) document.getElementById('draft-tags').value = decodeURIComponent(tags);

        if (p.get('flagged') === '1') document.getElementById('draft-flagged').checked = true;

        const syntax = p.get('syntax');
        if (syntax) {
            const sel = document.getElementById('draft-syntax');
            for (let i = 0; i < sel.options.length; i++) {
                if (sel.options[i].value.toLowerCase() === syntax.toLowerCase()) {
                    sel.selectedIndex = i; break;
                }
            }
        }

        // Store redirect info for post-submit handling
        const redirect = p.get('redirect');
        const url      = p.get('url');
        if (redirect && url) {
            localStorage.setItem('captureRedirectType', redirect);
            localStorage.setItem('captureRedirectUrl',  url);
        }
    }

    // ── Draft queue (offline / pre-auth buffer) ───────────────

    let draftQueue = [];

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
        const queueSection = document.getElementById('queue-section');
        const queueCount   = document.getElementById('queue-count');
        if (queueCount)   queueCount.textContent = draftQueue.length;
        if (queueSection) {
            queueSection.style.display = draftQueue.length > 0 ? 'block' : 'none';
            if (draftQueue.length > 0) renderDraftList();
        }
    }

    function renderDraftList() {
        const draftList = document.getElementById('draft-list');
        if (!draftList) return;
        draftList.innerHTML = '';

        draftQueue.forEach((draft, index) => {
            const el = document.createElement('div');
            el.className = 'draft-item';

            const header = document.createElement('div');
            header.className = 'draft-item-header';

            const titleSpan = document.createElement('span');
            titleSpan.className = 'draft-item-title';
            titleSpan.textContent = `Draft ${index + 1}`;

            const actions = document.createElement('div');
            actions.className = 'draft-item-actions';

            const submitBtn = document.createElement('button');
            submitBtn.type = 'button'; submitBtn.className = 'submit-draft-btn';
            submitBtn.dataset.index = index; submitBtn.textContent = 'Submit';

            const editBtn = document.createElement('button');
            editBtn.type = 'button'; editBtn.className = 'edit-draft-btn';
            editBtn.dataset.index = index; editBtn.textContent = 'Edit';

            const removeBtn = document.createElement('button');
            removeBtn.type = 'button'; removeBtn.className = 'remove-draft-btn';
            removeBtn.dataset.index = index; removeBtn.textContent = '\u00d7';

            actions.append(submitBtn, editBtn, removeBtn);
            header.append(titleSpan, actions);

            const preview = draft.content.length > 120
                ? draft.content.substring(0, 120) + '\u2026' : draft.content;

            const contentDiv = document.createElement('div');
            contentDiv.className = 'draft-item-content';
            contentDiv.textContent = preview;

            const metaDiv = document.createElement('div');
            metaDiv.className = 'draft-item-meta';

            if (draft.tags) {
                const tagSpan = document.createElement('span');
                tagSpan.className = 'draft-item-tag';
                tagSpan.textContent = draft.tags;
                metaDiv.appendChild(tagSpan);
            }
            if (draft.flagged) {
                const flagSpan = document.createElement('span');
                flagSpan.className = 'draft-item-flagged';
                flagSpan.textContent = 'Flagged';
                metaDiv.appendChild(flagSpan);
            }

            el.append(header, contentDiv, metaDiv);
            draftList.appendChild(el);
        });

        draftList.querySelectorAll('.submit-draft-btn').forEach(btn =>
            btn.addEventListener('click', () => submitDraft(parseInt(btn.dataset.index)))
        );
        draftList.querySelectorAll('.edit-draft-btn').forEach(btn =>
            btn.addEventListener('click', () => editDraft(parseInt(btn.dataset.index)))
        );
        draftList.querySelectorAll('.remove-draft-btn').forEach(btn =>
            btn.addEventListener('click', () => removeDraft(parseInt(btn.dataset.index)))
        );
    }

    function submitDraft(index) {
        if (index < 0 || index >= draftQueue.length) return;
        if (!window.cloudkit || !window.cloudkit.isAuthenticated()) {
            showAlert('Sign in with Apple ID to submit queued drafts.', 'error');
            return;
        }
        window.cloudkit.createDraft(draftQueue[index])
            .then(result => {
                if (result && result.success) {
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
        document.getElementById('draft-content').value    = draft.content;
        document.getElementById('draft-tags').value       = draft.tags || '';
        document.getElementById('draft-syntax').value     = draft.syntax || 'Markdown';
        document.getElementById('draft-flagged').checked  = !!draft.flagged;
        draftQueue.splice(index, 1);
        saveDraftQueue();
        document.getElementById('draft-content').focus();
        window.__resizeTextarea?.();
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
            if (draftQueue.length > 0) {
                const msg = `You have ${draftQueue.length} queued draft(s). Leave without submitting?`;
                e.preventDefault(); e.returnValue = msg; return msg;
            }
        });
    }

    function submitAllDrafts() {
        if (draftQueue.length === 0) { showAlert('No drafts queued.', 'info'); return; }
        if (!window.cloudkit || !window.cloudkit.isAuthenticated()) {
            showAlert('Sign in with Apple ID to submit queued drafts.', 'error');
            return;
        }

        showLoading();

        const submitNext = (index = 0) => {
            if (index >= draftQueue.length) {
                draftQueue = [];
                saveDraftQueue();
                hideLoading();
                showAlert('All queued drafts submitted to Drafts.', 'success');
                handleBookmarkletRedirect();
                return;
            }
            window.cloudkit.createDraft(draftQueue[index])
                .then(() => submitNext(index + 1))
                .catch(err => {
                    hideLoading();
                    showAlert(`Error on draft ${index + 1}: ${err.message || err}`, 'error');
                });
        };

        submitNext();
    }

    function discardAllDrafts() {
        if (draftQueue.length === 0) return;
        if (confirm(`Discard all ${draftQueue.length} queued draft(s)?`)) {
            draftQueue = [];
            saveDraftQueue();
        }
    }

    // Expose to global scope for onclick attrs and cloudkit.js
    window.submitAllDrafts  = submitAllDrafts;
    window.discardAllDrafts = discardAllDrafts;
    window.showLoading      = showLoading;
    window.hideLoading      = hideLoading;
    window.showAlert        = showAlert;
});
