const fs = require('fs');

let code = fs.readFileSync('public/js/app.js', 'utf8');

// 1. Restore Event Listeners at the top
code = code.replace(
`    document.getElementById('draft-content')?.addEventListener('input', () => {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => { saveCurrentTabContent(); renderTabs(); }, 400);
    });`,
`    document.getElementById('draft-content')?.addEventListener('input', () => {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => { saveCurrentTabContent(); renderTabs(); }, 400);
    });
    document.getElementById('draft-syntax')?.addEventListener('change', saveCurrentTabContent);
    document.getElementById('draft-flagged')?.addEventListener('change', saveCurrentTabContent);`
);

// 2. Restore makeTab attributes
code = code.replace(
`        return {
            id,
            content: data.content || '',
            tags:    data.tags    || '',
        };`,
`        return {
            id,
            content: data.content || '',
            tags:    data.tags    || '',
            syntax:  data.syntax  || localStorage.getItem('preferredSyntax') || 'Markdown',
            flagged: !!data.flagged,
        };`
);

// 3. Restore saveCurrentTabContent
code = code.replace(
`        tab.content = window.__editor ? window.__editor.getValue() : document.getElementById('draft-content').value;
        tab.tags    = document.getElementById('draft-tags').value;
        saveTabs();`,
`        tab.content = window.__editor ? window.__editor.getValue() : document.getElementById('draft-content').value;
        tab.tags    = document.getElementById('draft-tags').value;
        const sel = document.getElementById('draft-syntax');
        if (sel) tab.syntax = sel.value;
        const chk = document.getElementById('draft-flagged');
        if (chk) tab.flagged = chk.checked;
        saveTabs();`
);

// 4. Restore loadTabContent
code = code.replace(
`        setEditorContent(tab.content);
        setTagsFromString(tab.tags);
        showWriteMode();`,
`        setEditorContent(tab.content);
        setTagsFromString(tab.tags);
        const sel = document.getElementById('draft-syntax');
        if (sel && tab.syntax) sel.value = tab.syntax;
        const chk = document.getElementById('draft-flagged');
        if (chk) chk.checked = !!tab.flagged;
        showWriteMode();`
);

// 5. Restore clearForm
code = code.replace(
`        tagList = [];
        renderChips();
        showWriteMode();`,
`        tagList = [];
        renderChips();
        const chk = document.getElementById('draft-flagged');
        if (chk) chk.checked = false;
        showWriteMode();`
);

// 6. Restore handleFormSubmit
code = code.replace(
`        const content     = document.getElementById('draft-content').value;
        const tags        = document.getElementById('draft-tags').value;

        if (!content || !content.trim()) {`,
`        const content     = document.getElementById('draft-content').value;
        const tags        = document.getElementById('draft-tags').value;
        const sel         = document.getElementById('draft-syntax');
        const syntax      = sel ? sel.value : 'Markdown';
        const chk         = document.getElementById('draft-flagged');
        const flagged     = chk ? chk.checked : false;
        const locChk      = document.getElementById('draft-location');
        const useLocation = locChk ? locChk.checked : false;

        if (!content || !content.trim()) {`
);

// 7. Restore Location Fetch in handleFormSubmit
code = code.replace(
`        savePreferences();

        const draftData = { content: content.trim(), tags };`,
`        savePreferences();

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

        const draftData = { content: content.trim(), tags, syntax, flagged, latitude, longitude };`
);

// 8. Restore editDraft
code = code.replace(
`        setEditorContent(draft.content);
        setTagsFromString(draft.tags || '');
        draftQueue.splice(index, 1);`,
`        setEditorContent(draft.content);
        setTagsFromString(draft.tags || '');
        const sel = document.getElementById('draft-syntax');
        if (sel) sel.value = draft.syntax || 'Markdown';
        const chk = document.getElementById('draft-flagged');
        if (chk) chk.checked = !!draft.flagged;
        draftQueue.splice(index, 1);`
);

// 9. Restore Draft List Rendering
code = code.replace(
`            if (draft.tags) {
                const ts = document.createElement('span');
                ts.className = 'draft-item-tag'; ts.textContent = draft.tags;
                metaDiv.appendChild(ts);
            }
            el.append(header, contentDiv, metaDiv);`,
`            if (draft.tags) {
                const ts = document.createElement('span');
                ts.className = 'draft-item-tag'; ts.textContent = draft.tags;
                metaDiv.appendChild(ts);
            }
            if (draft.flagged) {
                const fs = document.createElement('span');
                fs.className = 'draft-item-flagged'; fs.textContent = 'Flagged';
                metaDiv.appendChild(fs);
            }
            el.append(header, contentDiv, metaDiv);`
);

// 10. Restore Preferences
code = code.replace(
`    function savePreferences() {}
    function loadPreferences() {}`,
`    function savePreferences() {
        const sel = document.getElementById('draft-syntax');
        if (sel) localStorage.setItem('preferredSyntax', sel.value);
        const loc = document.getElementById('draft-location');
        if (loc) localStorage.setItem('useLocation', loc.checked);
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
    }`
);

// 11. Restore handleUrlParameters
code = code.replace(
`        const tags = p.get('tags');
        if (tags) setTagsFromString(decodeURIComponent(tags));

        const redirect = p.get('redirect');`,
`        const tags = p.get('tags');
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

        const redirect = p.get('redirect');`
);

// 12. Restore submitAllDrafts draft format
code = code.replace(
`            .map(t => ({
                content: t.content.trim(),
                tags: t.tags
            }));`,
`            .map(t => ({
                content: t.content.trim(),
                tags:    t.tags,
                syntax:  t.syntax,
                flagged: t.flagged,
                latitude: 0, longitude: 0
            }));`
);

// 13. Restore closeTab auto-send format
code = code.replace(
`        if (tab.content.trim()) {
            const draftData = {
                content: tab.content.trim(),
                tags: tab.tags
            };`,
`        if (tab.content.trim()) {
            const draftData = {
                content: tab.content.trim(),
                tags:    tab.tags,
                syntax:  tab.syntax,
                flagged: tab.flagged,
                latitude: 0, longitude: 0
            };`
);

// 14. Restore clearAllTabs format
code = code.replace(
`                addToQueue({
                    content: t.content.trim(),
                    tags: t.tags
                });`,
`                addToQueue({
                    content: t.content.trim(),
                    tags: t.tags,
                    syntax: t.syntax,
                    flagged: t.flagged,
                    latitude: 0, longitude: 0
                });`
);

fs.writeFileSync('public/js/app.js', code);
