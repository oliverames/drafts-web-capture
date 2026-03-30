// CloudKit Integration for Drafts Web Capture
// This file handles authentication and draft creation using CloudKit JS

// CloudKit Configuration
const CLOUDKIT_CONFIG = {
    containerIdentifier: 'iCloud.com.agiletortoise.Drafts5',
    environment: 'production',
    apiTokenAuth: {
        apiToken: 'f65019e2c73a0d0307e69606ece3413cb5fbf40812def4ca4120b1ad11a22bbe',
        persist: true
    }
};

// Authentication state
let isAuthenticated = false;
let userIdentity = null;

// Initialize CloudKit
function initializeCloudKit() {
    try {
        CloudKit.configure(CLOUDKIT_CONFIG);
        console.log('CloudKit initialized');
        
        // Check existing authentication
        checkAuthentication();
        
        // Set up Sign in with Apple
        setupAppleSignIn();
        
    } catch (error) {
        console.error('CloudKit initialization error:', error);
        showAlert('CloudKit initialization failed. See console for details.', 'error');
    }
}

// Check if user is already authenticated
function checkAuthentication() {
    CloudKit.getDefaultContainer().whenReady().then(() => {
        return CloudKit.getDefaultContainer().getUserIdentity();
    }).then(identity => {
        if (identity) {
            userIdentity = identity;
            isAuthenticated = true;
            showAuthenticatedUI();
            console.log('User authenticated:', identity);
        } else {
            showUnauthenticatedUI();
            console.log('User not authenticated');
        }
    }).catch(error => {
        console.error('Authentication check error:', error);
        showUnauthenticatedUI();
    });
}

// Set up Sign in with Apple button
function setupAppleSignIn() {
    const signInButton = document.getElementById('apple-sign-in-button');
    if (signInButton) {
        signInButton.innerHTML = '
            <button id="sign-in-with-apple" class="apple-sign-in">
                <i class="fab fa-apple"></i> Sign in with Apple
            </button>
        ';
        
        document.getElementById('sign-in-with-apple').addEventListener('click', () => {
            authenticateWithApple();
        });
    }
}

// Authenticate with Apple
function authenticateWithApple() {
    showLoading();
    
    CloudKit.getDefaultContainer().whenReady().then(() => {
        // This will trigger the Apple ID sign-in dialog
        return CloudKit.getDefaultContainer().setUpAuth();
    }).then(() => {
        return CloudKit.getDefaultContainer().getUserIdentity();
    }).then(identity => {
        userIdentity = identity;
        isAuthenticated = true;
        showAuthenticatedUI();
        hideLoading();
        showAlert('Successfully signed in with Apple ID!', 'success');
        console.log('Authentication successful:', identity);
    }).catch(error => {
        hideLoading();
        console.error('Apple authentication error:', error);
        showAlert('Apple sign-in failed. Please try again.', 'error');
    });
}

// Show UI for authenticated users
function showAuthenticatedUI() {
    document.getElementById('sign-in-section').style.display = 'none';
    document.querySelector('.draft-queue-section').style.display = 'block';
    document.querySelector('.editor-container').style.display = 'block';
}

// Show UI for unauthenticated users
function showUnauthenticatedUI() {
    document.getElementById('sign-in-section').style.display = 'block';
    document.querySelector('.draft-queue-section').style.display = 'none';
    document.querySelector('.editor-container').style.display = 'none';
}

// Create a draft using CloudKit (matches official implementation)
function createDraftWithCloudKit(draftData) {
    if (!isAuthenticated) {
        showAlert('Please sign in with Apple ID first', 'error');
        return Promise.reject('Not authenticated');
    }

    showLoading();
    
    return CloudKit.getDefaultContainer().whenReady()
        .then(() => {
            const privateDB = CloudKit.getDefaultContainer().privateCloudDatabase;
            
            // Generate UUID for the draft
            const uuid = generateUUID();
            const now = Date.now();
            
            // Create the record
            const record = {
                recordType: 'draft',
                recordName: `draft|--|${uuid}`,
                fields: {
                    uuid: { value: uuid },
                    changed_at: { value: now },
                    created_at: { value: now },
                    created_device: { value: 'Web' },
                    created_longitude: { value: 0.0 },
                    created_latitude: { value: 0.0 },
                    modified_at: { value: now },
                    modified_device: { value: 'Web' },
                    modified_longitude: { value: 0.0 },
                    modified_latitude: { value: 0.0 },
                    accessed_at: { value: now },
                    flagged: { value: draftData.flagged ? 1 : 0 },
                    folder: { value: 0 },
                    hidden: { value: 0 },
                    content: { value: draftData.content },
                    language_grammar_name: { value: draftData.syntax || 'Plain Text' },
                    last_selection_length: { value: 0 },
                    last_selection_location: { value: 0 },
                    tags: { value: draftData.tags || '' },
                    title: { value: '' }
                }
            };

            // Save to CloudKit
            return privateDB.saveRecords([record], { zoneID: 'drafts' });
        })
        .then(response => {
            hideLoading();
            if (response.hasErrors) {
                console.error('CloudKit save error:', response.errors);
                showAlert('Failed to create draft. See console for details.', 'error');
                return Promise.reject(response.errors[0]);
            }
            
            const createdRecord = response.records[0];
            const draftUUID = createdRecord.fields.uuid.value;
            const draftsUrl = `drafts://open?uuid=${draftUUID}`;
            
            showAlert(`Draft created successfully! <a href="${draftsUrl}" target="_blank">Open in Drafts</a>`, 'success');
            
            return {
                success: true,
                draft: {
                    uuid: draftUUID,
                    draftsUrl: draftsUrl
                }
            };
        })
        .catch(error => {
            hideLoading();
            console.error('Draft creation error:', error);
            showAlert('Failed to create draft. See console for details.', 'error');
            return Promise.reject(error);
        });
}

// Generate UUID (matches Drafts format)
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    }).toUpperCase();
}

// Sign out
function signOut() {
    CloudKit.getDefaultContainer().whenReady().then(() => {
        // Note: CloudKit JS doesn't have a sign-out method
        // We'll just refresh to clear the session
        isAuthenticated = false;
        userIdentity = null;
        showUnauthenticatedUI();
        showAlert('Signed out successfully', 'success');
    }).catch(error => {
        console.error('Sign out error:', error);
        showAlert('Failed to sign out', 'error');
    });
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeCloudKit);

// Export functions for use in main app.js
window.cloudkit = {
    isAuthenticated: () => isAuthenticated,
    createDraft: createDraftWithCloudKit,
    signOut: signOut
};