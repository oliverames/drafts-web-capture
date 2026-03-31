// CloudKit Integration for Drafts Web Capture
// Mirrors the token configuration used by capture.getdrafts.com (js/init.js).
// Production token works from any https origin; dev token for file:// local testing.

(function () {
    const isDev  = window.location.href.startsWith('file:');
    // window.CLOUDKIT_API_TOKEN can override (set by GitHub Actions secret or Express server)
    const TOKEN  = window.CLOUDKIT_API_TOKEN ||
        (isDev
            ? '3ccf5242c03a83287a408796cbd0d15996c59d7015d246b9135b00c3419219c9'
            : 'f65019e2c73a0d0307e69606ece3413cb5fbf40812def4ca4120b1ad11a22bbe');
    const ENV    = isDev ? 'development' : 'production';

    let isAuthenticated = false;

    // ── Bootstrap ─────────────────────────────────────────────

    window.addEventListener('cloudkitloaded', function () {
        // Wait for the Service Worker proxy to control this page before
        // initialising CloudKit — ensures api.apple-cloudkit.com requests
        // are intercepted from the very first call.
        (window.__swReady || Promise.resolve()).then(function () { _initCloudKit(); });
    });

    function _initCloudKit() {
        try {
            CloudKit.configure({
                containers: [{
                    containerIdentifier: 'iCloud.com.agiletortoise.Drafts5',
                    apiTokenAuth: {
                        apiToken: TOKEN,
                        persist: true,
                        signInButton: { id: 'apple-sign-in-button', style: 'black' }
                    },
                    environment: ENV
                }]
            });
        } catch (err) {
            console.error('CloudKit configure failed:', err);
            showUnauthenticatedUI();
            return;
        }

        const container = CloudKit.getDefaultContainer();

        container.setUpAuth().then(function (userInfo) {
            if (userInfo) {
                isAuthenticated = true;
                showAuthenticatedUI();
                container.whenUserSignsOut().then(function () {
                    isAuthenticated = false;
                    showUnauthenticatedUI();
                });
            } else {
                showUnauthenticatedUI();
                container.whenUserSignsIn().then(function () {
                    isAuthenticated = true;
                    showAuthenticatedUI();
                }).catch(showUnauthenticatedUI);
            }
        }).catch(function (err) {
            console.error('CloudKit setUpAuth failed:', err);
            showUnauthenticatedUI();
        });
    }

    // ── UI state ──────────────────────────────────────────────

    function showAuthenticatedUI() {
        const signInSection  = document.getElementById('sign-in-section');
        const captureSection = document.getElementById('capture-section');
        if (signInSection)  signInSection.style.display  = 'none';
        if (captureSection) captureSection.style.display = '';
        const ta = document.getElementById('draft-content');
        if (ta) ta.focus();
    }

    function showUnauthenticatedUI() {
        // If the user chose local-queue mode, don't override their choice
        if (localStorage.getItem('skipCloudKit') === '1') return;

        const signInSection  = document.getElementById('sign-in-section');
        const captureSection = document.getElementById('capture-section');
        if (signInSection)  signInSection.style.display  = '';
        if (captureSection) captureSection.style.display = 'none';
    }

    // ── Draft creation ────────────────────────────────────────

    function createDraftWithCloudKit(draftData) {
        if (!isAuthenticated) {
            return Promise.reject(new Error('Not authenticated with CloudKit'));
        }

        const privateDB = CloudKit.getDefaultContainer().privateCloudDatabase;
        const uuid      = generateUUID();
        const now       = Date.now();
        const lon       = draftData.longitude || 0.0;
        const lat       = draftData.latitude  || 0.0;

        // Tags MUST be an array — this is the Drafts CloudKit schema.
        // The official site does: tags.split(',').map(t => t.toLowerCase().trim())
        const tags = draftData.tags
            ? draftData.tags.split(',').map(t => t.toLowerCase().trim()).filter(Boolean)
            : [];

        const record = {
            recordType: 'draft',
            recordName: `draft|--|${uuid}`,
            fields: {
                uuid:                    { value: uuid },
                changed_at:              { value: now },
                created_at:              { value: now },
                created_device:          { value: 'Web' },
                created_longitude:       { value: lon },
                created_latitude:        { value: lat },
                modified_at:             { value: now },
                modified_device:         { value: 'Web' },
                modified_longitude:      { value: lon },
                modified_latitude:       { value: lat },
                accessed_at:             { value: now },
                flagged:                 { value: draftData.flagged ? 1 : 0 },
                folder:                  { value: 0 },
                hidden:                  { value: 0 },
                content:                 { value: draftData.content },
                language_grammar_name:   { value: draftData.syntax || 'Markdown' },
                last_selection_length:   { value: 0 },
                last_selection_location: { value: 0 },
                tags:                    { value: tags },
                title:                   { value: '' }
            }
        };

        return privateDB.saveRecords([record], { zoneID: 'drafts' })
            .then(function (response) {
                if (response.hasErrors) {
                    return Promise.reject(response.errors[0]);
                }
                const savedUUID = response.records[0].fields.uuid.value;
                return {
                    success: true,
                    draft: {
                        uuid:      savedUUID,
                        draftsUrl: `drafts://open?uuid=${savedUUID}`
                    }
                };
            });
    }

    // ── Sign out ──────────────────────────────────────────────

    function signOut() {
        isAuthenticated = false;
        showUnauthenticatedUI();
        if (window.showAlert) window.showAlert('Signed out.', 'success');
    }

    // ── Helpers ───────────────────────────────────────────────

    function generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = Math.random() * 16 | 0;
            return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        }).toUpperCase();
    }

    // ── Public API ────────────────────────────────────────────

    window.cloudkit = {
        isAuthenticated: function () { return isAuthenticated; },
        createDraft:     createDraftWithCloudKit,
        signOut:         signOut
    };
})();
