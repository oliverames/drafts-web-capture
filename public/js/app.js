document.addEventListener('DOMContentLoaded', function() {
    const captureForm = document.getElementById('capture-form');
    const alertContainer = document.getElementById('alert-container');

    // Load saved preferences
    loadPreferences();
    
    // Handle URL query parameters
    handleUrlParameters();
    
    // Load draft queue from localStorage
    loadDraftQueue();
    
    // Set up beforeunload handler for auto-save
    setupBeforeUnloadHandler();
    
    // Set up editor tabs
    setupEditorTabs();
    
    // Set up real-time preview
    setupRealTimePreview();
    
    // Set up attachment handling
    setupAttachmentHandling();

    if (captureForm) {
        captureForm.addEventListener('submit', handleFormSubmit);
    }

    // Add sign out button event listener
    const signOutBtn = document.getElementById('sign-out-btn');
    if (signOutBtn) {
        signOutBtn.addEventListener('click', () => {
            if (window.cloudkit && window.cloudkit.signOut) {
                window.cloudkit.signOut();
            }
        });
    }

    function handleFormSubmit(e) {
        e.preventDefault();

        // Get form data
        const content = document.getElementById('draft-content').value;
        const tags = document.getElementById('draft-tags').value;
        const syntax = document.getElementById('draft-syntax').value;
        const flagged = document.getElementById('draft-flagged').checked;
        const useLocation = document.getElementById('draft-location').checked;

        // Validate content
        if (!content || content.trim() === '') {
            showAlert('Content is required', 'error');
            return;
        }

        // Save preferences
        savePreferences();

        // Create draft object
        const draftData = {
            content: content.trim(),
            tags: tags,
            syntax: syntax,
            flagged: flagged,
            useLocation: useLocation
        };

        // Check if we should use CloudKit (official integration) or queue (self-hosted)
        if (window.cloudkit && window.cloudkit.isAuthenticated()) {
            // Use CloudKit for direct Drafts integration
            showLoading();
            
            // Check if there's an attachment
            if (currentAttachment) {
                // CloudKit doesn't support file attachments directly
                // Use Mail Drop as fallback for attachments
                useMailDropWithAttachment(draftData, currentAttachment).then(result => {
                    hideLoading();
                    if (result.success) {
                        // Clear form
                        document.getElementById('draft-content').value = '';
                        document.getElementById('draft-tags').value = '';
                        document.getElementById('draft-flagged').checked = false;
                        removeAttachment();
                        
                        showAlert(`Draft with attachment created! <a href="${result.draftsUrl}" target="_blank">Open in Drafts</a>`, 'success');
                    }
                }).catch(error => {
                    hideLoading();
                    console.error('Mail Drop error:', error);
                    showAlert('Failed to create draft with attachment. Falling back to queue without attachment.', 'error');
                    // Fall back to CloudKit without attachment
                    window.cloudkit.createDraft(draftData).then(result => {
                        if (result.success) {
                            showAlert(`Draft created without attachment! <a href="${result.draft.draftsUrl}" target="_blank">Open in Drafts</a>`, 'warning');
                        }
                    }).catch(cloudKitError => {
                        console.error('CloudKit error:', cloudKitError);
                        // Final fallback to queue
                        const queueSize = addToQueue(draftData);
                        showAlert(`Draft added to local queue (${queueSize} total) as fallback.`, 'warning');
                    });
                });
            } else {
                // No attachment, use CloudKit directly
                window.cloudkit.createDraft(draftData).then(result => {
                    hideLoading();
                    if (result.success) {
                        // Clear form
                        document.getElementById('draft-content').value = '';
                        document.getElementById('draft-tags').value = '';
                        document.getElementById('draft-flagged').checked = false;
                        
                        showAlert(`Draft created! <a href="${result.draft.draftsUrl}" target="_blank">Open in Drafts</a>`, 'success');
                    }
                }).catch(error => {
                    hideLoading();
                    console.error('CloudKit error:', error);
                    showAlert('Failed to create draft via CloudKit. Falling back to queue.', 'error');
                    // Fall back to queue
                    const queueSize = addToQueue(draftData);
                    showAlert(`Draft added to local queue (${queueSize} total) as fallback.`, 'warning');
                });
            }
        } else {
            // Use queue for self-hosted mode
            const queueSize = addToQueue(draftData);
            
            // Clear form for next draft
            document.getElementById('draft-content').value = '';
            document.getElementById('draft-tags').value = '';
            document.getElementById('draft-flagged').checked = false;

            showAlert(`Draft added to queue (${queueSize} total). It will be submitted when you close the tab or click "Submit All".`, 'success');
        }
        
        // Check for stored redirect from URL parameters
        const redirectType = localStorage.getItem('captureRedirectType');
        const redirectUrl = localStorage.getItem('captureRedirectUrl');
        
        if (redirectType && redirectUrl) {
            // If there's a redirect, submit all drafts now
            submitAllDrafts();
        }
    }

    function showAlert(message, type) {
        // Clear previous alerts
        alertContainer.innerHTML = '';

        const alertDiv = document.createElement('div');
        alertDiv.className = `alert ${type}`;
        alertDiv.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
            ${message}
        `;

        alertContainer.appendChild(alertDiv);

        // Auto-hide success alerts after 5 seconds
        if (type === 'success') {
            setTimeout(() => {
                alertDiv.style.opacity = '0';
                setTimeout(() => alertDiv.remove(), 500);
            }, 5000);
        }
    }

    function showLoading() {
        const submitBtn = captureForm.querySelector('.submit-btn');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="loading-spinner"></span> Creating Draft...';
        }
    }

    function hideLoading() {
        const submitBtn = captureForm.querySelector('.submit-btn');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-save"></i> Create Draft';
        }
    }

    function savePreferences() {
        const syntax = document.getElementById('draft-syntax').value;
        const useLocation = document.getElementById('draft-location').checked;

        localStorage.setItem('preferredSyntax', syntax);
        localStorage.setItem('useLocation', useLocation);
    }

    function loadPreferences() {
        const savedSyntax = localStorage.getItem('preferredSyntax');
        const savedLocation = localStorage.getItem('useLocation');

        if (savedSyntax) {
            document.getElementById('draft-syntax').value = savedSyntax;
        }

        if (savedLocation === 'true') {
            document.getElementById('draft-location').checked = true;
        }
    }

    function handleUrlParameters() {
        const urlParams = new URLSearchParams(window.location.search);

        // Handle text parameter
        const text = urlParams.get('text');
        if (text) {
            document.getElementById('draft-content').value = decodeURIComponent(text);
        }

        // Handle tags parameter
        const tags = urlParams.get('tags');
        if (tags) {
            document.getElementById('draft-tags').value = decodeURIComponent(tags);
        }

        // Handle flagged parameter
        const flagged = urlParams.get('flagged');
        if (flagged === '1') {
            document.getElementById('draft-flagged').checked = true;
        }

        // Handle syntax parameter
        const syntax = urlParams.get('syntax');
        if (syntax) {
            const syntaxSelect = document.getElementById('draft-syntax');
            for (let i = 0; i < syntaxSelect.options.length; i++) {
                if (syntaxSelect.options[i].value.toLowerCase() === syntax.toLowerCase()) {
                    syntaxSelect.selectedIndex = i;
                    break;
                }
            }
        }

        // Store URL for potential redirect
        const url = urlParams.get('url');
        const redirect = urlParams.get('redirect');
        if (url && redirect) {
            localStorage.setItem('captureRedirectUrl', url);
            localStorage.setItem('captureRedirectType', redirect);
        }
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        // Ctrl+Enter or Cmd+Enter to submit
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            if (captureForm) {
                captureForm.dispatchEvent(new Event('submit'));
            }
        }
    });

    // Redirect handling function
    function handleRedirect(redirectType, redirectUrl) {
        switch (redirectType) {
            case 'back':
                window.history.back();
                break;
            case 'close':
                window.close();
                break;
            case 'url':
                if (redirectUrl) {
                    window.location.href = redirectUrl;
                }
                break;
            default:
                console.log('Unknown redirect type:', redirectType);
        }
    }

    // Attachment handling functions
    function setupAttachmentHandling() {
        const fileInput = document.getElementById('draft-attachment');
        const previewContainer = document.createElement('div');
        previewContainer.id = 'attachment-preview';
        previewContainer.className = 'attachment-preview';
        
        if (fileInput) {
            fileInput.addEventListener('change', handleFileSelect);
        }
        
        // Insert preview container after file input
        if (fileInput && fileInput.parentNode) {
            fileInput.parentNode.appendChild(previewContainer);
        }
    }

    function handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        // Validate file size (5MB max)
        if (file.size > 5 * 1024 * 1024) {
            showAlert('File too large. Maximum size is 5MB.', 'error');
            event.target.value = '';
            return;
        }
        
        // Store file reference
        currentAttachment = file;
        
        // Show preview
        const preview = document.getElementById('attachment-preview');
        if (preview) {
            preview.innerHTML = `
                <div class="attachment-info">
                    <span class="attachment-name">${file.name}</span>
                    <span class="attachment-size">${formatFileSize(file.size)}</span>
                    <i class="fas fa-times attachment-remove" onclick="removeAttachment()"></i>
                </div>
                <p>Ready to attach with draft</p>
            `;
            preview.classList.add('show');
        }
        
        showAlert(`Attachment added: ${file.name}`, 'success');
    }

    function removeAttachment() {
        currentAttachment = null;
        const preview = document.getElementById('attachment-preview');
        if (preview) {
            preview.classList.remove('show');
        }
        const fileInput = document.getElementById('draft-attachment');
        if (fileInput) {
            fileInput.value = '';
        }
        showAlert('Attachment removed', 'info');
    }

    function formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' bytes';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    }

    // Mail Drop implementation for attachments
    async function useMailDropWithAttachment(draftData, file) {
        // In a real implementation, you would:
        // 1. Get the user's Mail Drop email address from Drafts settings
        // 2. Send an email to that address with the attachment
        // 3. The draft would appear in Drafts with the attachment
        
        // For this demo, we'll simulate the process and show appropriate messages
        
        return new Promise((resolve, reject) => {
            // Simulate sending to Mail Drop
            setTimeout(() => {
                // In reality, you would use a backend service or email API
                // to actually send the email with attachment
                
                console.log('Sending to Mail Drop:', {
                    subject: draftData.content.substring(0, 50) + '...',
                    content: draftData.content,
                    tags: draftData.tags,
                    file: file.name
                });
                
                // Generate a mock Drafts URL
                const mockUuid = 'MAILDROP-' + Math.random().toString(36).substring(2, 11).toUpperCase();
                
                resolve({
                    success: true,
                    draftsUrl: `drafts://open?uuid=${mockUuid}`
                });
            }, 1500);
        });
    }

    // Editor Tab Functions
    function setupEditorTabs() {
        const tabButtons = document.querySelectorAll('.tab-button');
        
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                // Remove active class from all buttons and tabs
                tabButtons.forEach(btn => btn.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(tab => {
                    tab.classList.remove('active');
                });
                
                // Add active class to clicked button and corresponding tab
                button.classList.add('active');
                const tabId = button.getAttribute('data-tab');
                document.getElementById(tabId + '-tab').classList.add('active');
                
                // Update preview if switching to preview tab
                if (tabId === 'preview') {
                    updatePreview();
                }
            });
        });
    }

    function setupRealTimePreview() {
        const textarea = document.getElementById('draft-content');
        if (textarea) {
            textarea.addEventListener('input', function() {
                // Only update preview if preview tab is active
                const previewTab = document.getElementById('preview-tab');
                if (previewTab && previewTab.classList.contains('active')) {
                    updatePreview();
                }
            });
        }
    }

    function updatePreview() {
        const content = document.getElementById('draft-content').value;
        const previewContent = document.getElementById('preview-content');
        
        if (previewContent && typeof marked !== 'undefined') {
            try {
                previewContent.innerHTML = marked.parse(content);
            } catch (e) {
                console.error('Error parsing Markdown:', e);
                previewContent.innerHTML = '<p>Preview unavailable</p>';
            }
        }
    }

    // Draft Queue Functions
    let draftQueue = [];
    let currentAttachment = null;

    function loadDraftQueue() {
        const savedQueue = localStorage.getItem('draftQueue');
        if (savedQueue) {
            try {
                draftQueue = JSON.parse(savedQueue);
                updateQueueIndicator();
                showAlert(`Loaded ${draftQueue.length} pending draft(s)`, 'success');
            } catch (e) {
                console.error('Error loading draft queue:', e);
                draftQueue = [];
            }
        }
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
        const queueCountElements = document.querySelectorAll('#queue-count');
        const queueControls = document.querySelector('.queue-controls');
        const draftQueueSection = document.querySelector('.draft-queue-section');
        
        queueCountElements.forEach(el => {
            if (el) el.textContent = draftQueue.length;
        });
        
        if (queueControls) {
            queueControls.style.display = draftQueue.length > 0 ? 'flex' : 'none';
        }
        
        if (draftQueueSection) {
            draftQueueSection.style.display = draftQueue.length > 0 ? 'block' : 'none';
            if (draftQueue.length > 0) {
                renderDraftList();
            }
        }
    }

    function renderDraftList() {
        const draftList = document.getElementById('draft-list');
        if (!draftList) return;
        
        draftList.innerHTML = '';
        
        draftQueue.forEach((draft, index) => {
            const draftElement = document.createElement('div');
            draftElement.className = 'draft-item';
            draftElement.setAttribute('data-index', index);
            
            // Create preview content
            const previewContent = draft.content.length > 100 ?
                draft.content.substring(0, 100) + '…' : draft.content;
            
            draftElement.innerHTML = `
                <div class="draft-item-header">
                    <span class="draft-item-title">Draft ${index + 1}</span>
                    <div class="draft-item-actions">
                        <button type="button" class="edit-draft-btn" data-index="${index}" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button type="button" class="remove-draft-btn" data-index="${index}" title="Remove">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="draft-item-content">${previewContent}</div>
                <div class="draft-item-meta">
                    ${draft.tags ? `<span class="draft-item-tag"><i class="fas fa-tag"></i> ${draft.tags}</span>` : ''}
                    ${draft.syntax ? `<span class="draft-item-syntax"><i class="fas fa-code"></i> ${draft.syntax}</span>` : ''}
                    ${draft.flagged ? `<span><i class="fas fa-flag" style="color: #ffc107;"></i> Flagged</span>` : ''}
                </div>
            `;
            
            draftList.appendChild(draftElement);
        });
        
        // Add event listeners to edit and remove buttons
        document.querySelectorAll('.edit-draft-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.closest('button').getAttribute('data-index'));
                editDraft(index);
            });
        });
        
        document.querySelectorAll('.remove-draft-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.closest('button').getAttribute('data-index'));
                removeDraft(index);
            });
        });
    }

    function editDraft(index) {
        if (index < 0 || index >= draftQueue.length) return;
        
        const draft = draftQueue[index];
        
        // Fill form with draft data
        document.getElementById('draft-content').value = draft.content;
        document.getElementById('draft-tags').value = draft.tags || '';
        document.getElementById('draft-syntax').value = draft.syntax || 'Plain Text';
        document.getElementById('draft-flagged').checked = draft.flagged || false;
        
        // Remove this draft from queue
        removeDraft(index);
        
        showAlert(`Editing draft ${index + 1}. Make changes and add to queue again.`, 'info');
    }

    function removeDraft(index) {
        if (index < 0 || index >= draftQueue.length) return;
        
        if (confirm(`Remove draft ${index + 1} from queue?`)) {
            draftQueue.splice(index, 1);
            saveDraftQueue();
            updateQueueIndicator();
            showAlert('Draft removed from queue', 'success');
        }
    }

    function setupBeforeUnloadHandler() {
        window.addEventListener('beforeunload', function(e) {
            if (draftQueue.length > 0) {
                const confirmationMessage = `You have ${draftQueue.length} unsaved draft(s). Are you sure you want to leave?`;
                e.preventDefault();
                e.returnValue = confirmationMessage;
                return confirmationMessage;
            }
        });
    }

    function submitAllDrafts() {
        if (draftQueue.length === 0) {
            showAlert('No drafts in queue to submit', 'info');
            return;
        }

        showLoading();
        
        // Submit drafts one by one
        const submitNext = (index = 0) => {
            if (index >= draftQueue.length) {
                // All drafts submitted
                draftQueue = [];
                saveDraftQueue();
                hideLoading();
                showAlert('All drafts submitted successfully! They are no longer in your queue.', 'success');
                
                // Handle any stored redirect
                const redirectType = localStorage.getItem('captureRedirectType');
                const redirectUrl = localStorage.getItem('captureRedirectUrl');
                
                if (redirectType && redirectUrl) {
                    setTimeout(() => {
                        handleRedirect(redirectType, redirectUrl);
                    }, 1500);
                    
                    // Clear stored redirect
                    localStorage.removeItem('captureRedirectType');
                    localStorage.removeItem('captureRedirectUrl');
                }
                
                return;
            }

            const draftData = draftQueue[index];
            
            fetch('/api/capture', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(draftData)
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    console.log(`Draft ${index + 1}/${draftQueue.length} submitted`);
                    submitNext(index + 1);
                } else {
                    hideLoading();
                    showAlert(`Error submitting draft ${index + 1}: ${data.error}`, 'error');
                }
            })
            .catch(error => {
                hideLoading();
                console.error('Error submitting draft:', error);
                showAlert(`Error submitting draft ${index + 1}`, 'error');
            });
        };

        submitNext();
    }

    function discardAllDrafts() {
        if (draftQueue.length === 0) {
            showAlert('No drafts to discard', 'info');
            return;
        }

        if (confirm(`Are you sure you want to discard ${draftQueue.length} draft(s)?`)) {
            draftQueue = [];
            saveDraftQueue();
            showAlert('All drafts discarded', 'success');
        }
    }
});