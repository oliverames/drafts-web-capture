# Persistence Behavior & Drafts Integration

## 📋 Persistence Behavior

### How Drafts Are Handled

```
┌───────────────────────────────────────────────────────┐
│                   Draft Lifecycle                    │
└───────────────────────────────────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────┐
│  1. Create Draft → Added to Browser Queue            │
│     (Stored in localStorage)                         │
└───────────────────────────────────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────┐
│  2. Submit Drafts → Sent to Server                   │
│     (Stored in SQLite database)                       │
└───────────────────────────────────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────┐
│  3. Success → Queue Cleared from Browser              │
│     (localStorage cleared)                            │
└───────────────────────────────────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────┐
│  4. Drafts Remain in Server Database                  │
│     (Available for viewing/export)                    │
└───────────────────────────────────────────────────────┘
```

### Persistence Rules

**Browser Queue (localStorage):**
- ✅ **Persists**: Across page reloads and tab closes
- ✅ **Cleared**: After successful submission
- ✅ **Warning**: Before closing with unsaved drafts
- ❌ **Not Persisted**: After submission or discard

**Server Database (SQLite):**
- ✅ **Persists**: All submitted drafts
- ✅ **Available**: For viewing and export
- ✅ **Searchable**: By content, tags, dates
- ❌ **Not Synced**: With Drafts app (see integration options)

### What Happens When...

| Action | Browser Queue | Server Database | Drafts App |
|--------|---------------|-----------------|------------|
| Create Draft | ✅ Added | ❌ Not yet | ❌ No |
| Add to Queue | ✅ Saved | ❌ Not yet | ❌ No |
| Submit All | ❌ Cleared | ✅ Stored | ❌ No |
| Discard All | ❌ Cleared | ❌ Not stored | ❌ No |
| Close Tab (unsaved) | ✅ Persists | ❌ Not yet | ❌ No |
| Page Refresh | ✅ Restored | ❌ Not yet | ❌ No |

## 🔄 Drafts App Integration Options

### Current Implementation: Self-Hosted Alternative

**How It Works:**
```
Your Browser → Our Server → SQLite Database
```

**Pros:**
- ✅ No Apple ID required
- ✅ Self-hosted and private
- ✅ Works without Drafts app
- ✅ Full control over data

**Cons:**
- ❌ Doesn't sync with Drafts app
- ❌ Separate from your Drafts library
- ❌ No iCloud synchronization

### Option 1: Drafts App URL Scheme (Partial Integration)

**What It Does:**
- Generates `drafts://` URLs for each draft
- Allows opening in Drafts app if installed
- Provides fallback web viewing

**Implementation:**
```javascript
// Generate Drafts app URL
const draftsUrl = `drafts://open?uuid=${draft.uuid}`;

// Generate web URL
const webUrl = `/drafts/${draft.uuid}`;
```

**Usage:**
1. Submit drafts to our server
2. Get Drafts app URL in response
3. Click URL to open in Drafts app (if installed)
4. Fallback to web view if Drafts app not available

**Limitations:**
- ⚠️ Requires Drafts app installed
- ⚠️ Only opens individual drafts
- ⚠️ No automatic sync

### Option 2: Full CloudKit Integration (Complex)

**What It Would Do:**
- Direct integration with Drafts iCloud storage
- Automatic sync with Drafts app
- Full feature parity with original

**Requirements:**
- ❌ Apple Developer account
- ❌ iCloud entitlements
- ❌ Complex setup
- ❌ Ongoing maintenance

**Challenges:**
- 🚫 Requires Apple approval
- 🚫 Needs iCloud container setup
- 🚫 Complex authentication
- 🚫 Not truly self-hosted

## 🎯 Recommended Approach

### Use Current Self-Hosted System With:

1. **Drafts URL Scheme for Convenience**
   - Generate URLs for opening in Drafts app
   - Provide fallback web viewing
   - Best of both worlds

2. **Export/Import Functionality**
   - Export drafts as JSON/Markdown
   - Import into Drafts app manually
   - Backup and restore capabilities

3. **Web Interface for Management**
   - View all submitted drafts
   - Search and filter
   - Edit and organize

### Workflow Example

```
┌───────────────────────────────────────────────────────┐
│  1. Capture drafts in our web interface              │
│     (Queue persists in browser)                      │
└───────────────────────────────────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────┐
│  2. Submit all drafts to our server                  │
│     (Queue cleared, drafts stored in SQLite)         │
└───────────────────────────────────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────┐
│  3. Get Drafts app URLs in response                  │
│     (Optional: open in Drafts app if installed)      │
└───────────────────────────────────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────┐
│  4. View/manage drafts in our web interface           │
│     (Full history, search, export)                  │
└───────────────────────────────────────────────────────┘
```

## 🔧 Technical Implementation

### Current Backend Response

```json
{
  "success": true,
  "message": "Draft created successfully",
  "draft": {
    "id": 123,
    "uuid": "ABC-123-DEF",
    "draftsUrl": "drafts://open?uuid=ABC-123-DEF",
    "webUrl": "/drafts/ABC-123-DEF"
  }
}
```

### Frontend Handling

```javascript
// On successful submission
if (data.success) {
    // Show Drafts app URL if Drafts app might be available
    if (isMobileDevice() || isMac()) {
        showAlert(`Draft submitted! 
        <a href="${data.draft.draftsUrl}">Open in Drafts</a> or 
        <a href="${data.draft.webUrl}">View on Web</a>`);
    } else {
        showAlert(`Draft submitted! 
        <a href="${data.draft.webUrl}">View Draft</a>`);
    }
}
```

### Device Detection

```javascript
function isMobileDevice() {
    return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

function isMac() {
    return /Macintosh|Mac Intel|MacPPC|Mac68K/i.test(navigator.userAgent);
}
```

## 📋 Comparison of Approaches

| Approach | Self-Hosted | Apple ID | Drafts Sync | Complexity | Recommended |
|----------|-------------|-----------|-------------|------------|-------------|
| **Self-Hosted** | ✅ Yes | ❌ No | ❌ No | ⚠️ Low | ✅ Yes |
| **URL Scheme** | ✅ Yes | ❌ No | ⚠️ Partial | ⚠️ Medium | ✅ Yes |
| **CloudKit** | ❌ No | ✅ Yes | ✅ Yes | ❌ High | ❌ No |

## 🎯 Summary

### Current Implementation
- ✅ **Self-hosted alternative** to Drafts Capture
- ✅ **Drafts persist in browser** until submitted
- ✅ **Drafts cleared from browser** after submission
- ✅ **Drafts stored in our database** permanently
- ✅ **Drafts app URLs generated** for convenience

### Integration Options
1. **Self-Hosted (Current)** - Private, no Apple ID, full control
2. **URL Scheme (Enhanced)** - Partial integration, best of both
3. **CloudKit (Not Recommended)** - Complex, requires Apple setup

### Best Path Forward
```
Use self-hosted system → Add URL scheme support → 
Provide export/import → Consider CloudKit only if essential
```

The current implementation provides **persistence until submission** as requested, with the understanding that this is a **self-hosted alternative** rather than a direct Drafts app integration. The Drafts app URL scheme provides a convenient way to open individual drafts in the Drafts app if it's installed, while maintaining the self-hosted nature of the service.

**Perfect for those who want a private, self-hosted capture system with optional Drafts app integration!** 🚀