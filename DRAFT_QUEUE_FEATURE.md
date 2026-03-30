# Draft Queue Feature

## 🎯 Overview

The Draft Queue feature allows you to create multiple drafts during a single session and submit them all at once. This is particularly useful when:

- You're researching and want to capture multiple pieces of information
- You're in an area with unreliable internet connectivity
- You want to review all your drafts before submitting
- You prefer to batch your submissions

## 🆕 How It Works

### Old Behavior (Before)
1. Create draft → Immediately submitted to server
2. Each draft requires separate API call
3. No way to review before submitting
4. Lost drafts if submission fails

### New Behavior (After)
1. Create draft → Added to local queue
2. Multiple drafts accumulate in browser
3. Submit all drafts at once when ready
4. Drafts persist even if tab is closed/reopened
5. Automatic submission on tab close (with confirmation)

## 📋 User Flow

```
┌───────────────────────────────────────────────────────┐
│                   Draft Creation                     │
└───────────────────────────────────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────┐
│                 Add to Local Queue                    │
│               (Stored in browser localStorage)       │
└───────────────────────────────────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────┐
│               Queue Controls Appear                   │
│  [Submit All (N)]  [Discard All]                      │
└───────────────────────────────────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────┐
│            Click "Submit All" or Close Tab            │
└───────────────────────────────────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────┐
│              All Drafts Submitted to Server            │
│              (With progress indication)                │
└───────────────────────────────────────────────────────┘
```

## 🎨 UI Changes

### Before
```
[ Create Draft ]
```

### After
```
[ Add to Queue ]

[Submit All (0)] [Discard All]  (hidden when queue empty)
[Submit All (1)] [Discard All]  (shown when queue has drafts)
```

## 🔧 Technical Implementation

### Data Storage
- **LocalStorage**: Drafts stored as JSON array
- **Key**: `draftQueue`
- **Format**: Array of draft objects with content, tags, syntax, etc.

### Draft Object Structure
```javascript
{
    content: "Your text content",
    tags: "tag1, tag2, tag3",
    syntax: "Markdown",
    flagged: true/false,
    useLocation: true/false
}
```

### Key Functions

1. **`loadDraftQueue()`**: Load queue from localStorage on page load
2. **`saveDraftQueue()`**: Save queue to localStorage
3. **`addToQueue(draftData)`**: Add new draft to queue
4. **`updateQueueIndicator()`**: Update UI to show queue size
5. **`submitAllDrafts()`**: Submit all queued drafts to server
6. **`discardAllDrafts()`**: Clear queue without submitting
7. **`setupBeforeUnloadHandler()`**: Warn before closing with unsaved drafts

## 💾 Persistence

### What's Persisted
- ✅ Draft content, tags, syntax, flags
- ✅ User preferences (syntax, location setting)
- ✅ Queue state across page reloads

### What's NOT Persisted
- ❌ Form state (cleared after adding to queue)
- ❌ Temporary UI states

### Persistence Lifecycle
```
Page Load → Load from localStorage → User adds drafts → Save to localStorage
Tab Close → Confirmation dialog → Submit all → Clear localStorage
Page Refresh → Load from localStorage → Queue restored
```

## 🚀 Benefits

### For Users
1. **Batch Processing**: Create multiple drafts efficiently
2. **Offline Support**: Drafts saved locally until submitted
3. **Review Before Submit**: See all drafts before sending
4. **Recovery**: Drafts persist across accidental refreshes
5. **Flexibility**: Submit when convenient

### For Developers
1. **Reduced API Calls**: Fewer individual submissions
2. **Better Error Handling**: Handle batch failures gracefully
3. **Improved UX**: More natural workflow
4. **Progressive Enhancement**: Works without JavaScript (falls back to immediate submit)

## 🎯 Use Cases

### 1. Research Session
```
User visits multiple web pages → Captures key information from each → 
Reviews all captures → Submits everything at once
```

### 2. Unreliable Connection
```
User on spotty WiFi → Creates drafts offline → Submits when connection stable
```

### 3. Batch Organization
```
User collects ideas throughout day → Organizes and tags them → Submits organized batch
```

### 4. Bookmarklet Workflow
```
User creates multiple bookmarklets → Each adds to queue → Reviews and submits all
```

## 🔮 Future Enhancements

### Planned Features
1. **Draft Preview**: Show list of queued drafts
2. **Individual Edit**: Edit drafts before submitting
3. **Selective Submit**: Choose which drafts to submit
4. **Draft Export**: Save queue to file
5. **Draft Import**: Load queue from file
6. **Auto-Save Interval**: Periodic background saves
7. **Conflict Resolution**: Handle submission conflicts

### Technical Improvements
1. **Queue Size Limit**: Prevent excessive localStorage usage
2. **Expiration**: Auto-clear old drafts
3. **Sync Across Devices**: Cloud sync for draft queues
4. **Offline Detection**: Auto-submit when online

## 📊 Performance Considerations

### LocalStorage Limits
- **Size**: ~5MB per domain (plenty for text drafts)
- **Speed**: Very fast for queue operations
- **Persistence**: Cleared only by user or code

### Memory Usage
- **Low Impact**: Drafts stored as JSON strings
- **Efficient**: Minimal memory overhead

### Network Efficiency
- **Batch Submissions**: Fewer HTTP requests
- **Reduced Overhead**: Single transaction for multiple drafts

## 🛡️ Security Considerations

### Data Safety
- **Local Only**: Drafts never leave browser until submitted
- **No Server Storage**: Unsubmitted drafts not on server
- **Clear on Submit**: Queue cleared after successful submission

### Privacy
- **Browser-Only**: No drafts sent to third parties
- **User Control**: Explicit submit action required
- **Clear Indication**: Visual queue counter

## 🐛 Error Handling

### Submission Failures
- **Partial Success**: Some drafts may succeed, others fail
- **Retry Mechanism**: User can retry failed submissions
- **Error Reporting**: Clear error messages for each draft

### Browser Issues
- **LocalStorage Full**: Graceful degradation
- **Quota Exceeded**: Warning to user
- **Corrupted Data**: Reset queue with confirmation

## 🔄 Migration Path

### From Immediate Submit to Queue
1. **Backward Compatible**: Existing users unaffected
2. **Opt-In**: Queue enabled by default
3. **Fallback**: Immediate submit if JavaScript disabled
4. **Clear Benefits**: Users see value immediately

## 📚 User Documentation

### How to Use the Draft Queue

1. **Add Drafts**: Fill form and click "Add to Queue"
2. **Continue Adding**: Form clears for next draft
3. **Review Queue**: Queue counter shows number of drafts
4. **Submit All**: Click "Submit All" when ready
5. **Or Discard**: Click "Discard All" to clear queue

### Tips
- **Queue Persists**: Drafts saved even if you close/refresh page
- **Confirmation**: Warned before closing with unsaved drafts
- **Bookmarklets**: Multiple bookmarklet uses add to same queue
- **No Limits**: Add as many drafts as you want

## 🎉 Summary

The Draft Queue feature transforms Drafts Web Capture from a simple form to a powerful batch processing tool. It provides:

- **Flexibility**: Work at your own pace
- **Reliability**: Drafts persist until submitted
- **Efficiency**: Batch processing reduces overhead
- **User Control**: Full control over submission timing

This enhancement makes the service much more useful for research, note-taking, and information gathering workflows while maintaining the simplicity that makes Drafts so effective.