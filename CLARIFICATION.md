# Important Clarifications

## 📋 About This Implementation

This document clarifies key aspects of the Drafts Web Capture implementation to ensure proper understanding and set correct expectations.

## 🎯 What This Is

### Self-Hosted Alternative
- ✅ **Independent system** - Does not require Drafts app
- ✅ **Private storage** - Drafts stored in your SQLite database
- ✅ **No Apple ID** - Uses your own authentication
- ✅ **Full control** - You own all data

### Not a Direct Drafts Integration
- ❌ **Does not sync** with Drafts app automatically
- ❌ **Does not use** iCloud or CloudKit
- ❌ **Not affiliated** with Agile Tortoise
- ❌ **No automatic** Drafts app updates

## 🔄 Persistence Behavior

### Browser Queue (Before Submission)
```
✅ Persists across:
   - Page reloads
   - Tab closes (with warning)
   - Accidental navigation

❌ Cleared when:
   - Successfully submitted
   - Explicitly discarded
   - Browser cache cleared
```

### Server Database (After Submission)
```
✅ Stored permanently in:
   - SQLite database
   - Your server
   - Under your control

❌ Not synced with:
   - Drafts app
   - iCloud
   - Other devices
```

## 📱 Drafts App Integration Options

### Current: URL Scheme Support
```
Feature: Generate drafts:// URLs
Status: ✅ Implemented
Purpose: Open individual drafts in Drafts app IF installed
Limitations: 
   - Requires Drafts app on device
   - Only opens individual drafts
   - No automatic sync
```

### Future: Export/Import
```
Feature: Manual data transfer
Status: 🔮 Planned
Purpose: Move drafts between systems
Benefits:
   - Export as JSON/Markdown
   - Import into Drafts app
   - Backup and restore
```

### Not Planned: CloudKit Integration
```
Feature: Direct Drafts app sync
Status: ❌ Not recommended
Reasons:
   - Requires Apple Developer account
   - Complex iCloud setup
   - Not truly self-hosted
   - Against project goals
```

## 🎯 Recommended Usage

### Best For:
- ✅ **Research sessions** - Capture from multiple sources
- ✅ **Note taking** - Organize thoughts before submitting
- ✅ **Offline work** - Create drafts without internet
- ✅ **Batch processing** - Submit multiple drafts at once
- ✅ **Private capture** - Keep sensitive info self-hosted

### Not Ideal For:
- ❌ **Direct Drafts sync** - Use official capture for this
- ❌ **iCloud backup** - Not integrated with Apple services
- ❌ **Multi-device sync** - Requires manual export/import
- ❌ **Official Drafts features** - Use Drafts app directly

## 🚀 Migration Path

### From Official Drafts Capture
```
1. Continue using official capture for Drafts sync
2. Use this for private/offline capture
3. Manually move important drafts between systems
4. Enjoy best of both worlds
```

### To Full Self-Hosted
```
1. Use this as primary capture system
2. Export drafts periodically
3. Import into Drafts app as needed
4. Maintain full control of data
```

## 🛡️ Security & Privacy

### Your Data
- ✅ **Stored on your server** - Full control
- ✅ **Encrypted in transit** - TailScale provides HTTPS
- ✅ **Password protected** - Basic auth security
- ✅ **No third parties** - Self-hosted only

### Not Stored With
- ❌ Apple/iCloud
- ❌ Agile Tortoise
- ❌ Third-party services
- ❌ Cloud providers (unless you choose)

## 📋 Feature Comparison

| Feature | Official Capture | This Implementation |
|---------|------------------|---------------------|
| iCloud Sync | ✅ Yes | ❌ No |
| Apple ID Login | ✅ Yes | ❌ No |
| Self-Hosted | ❌ No | ✅ Yes |
| Password Protection | ❌ No | ✅ Yes |
| Offline Support | ❌ No | ✅ Yes |
| Batch Processing | ❌ No | ✅ Yes |
| Markdown Editor | ❌ No | ✅ Yes |
| Draft Queue | ❌ No | ✅ Yes |
| TailScale Support | ❌ No | ✅ Yes |
| Open Source | ❌ No | ✅ Yes |

## 🎯 Summary

### What You Get
- ✅ **Private, self-hosted** text capture system
- ✅ **Modern UI** with Markdown support
- ✅ **Draft queue** for batch processing
- ✅ **Offline capability** with auto-save
- ✅ **TailScale integration** for secure access
- ✅ **One-command deployment** and management

### What You Don't Get
- ❌ **Direct Drafts app integration**
- ❌ **iCloud synchronization**
- ❌ **Automatic multi-device sync**
- ❌ **Official Drafts features**

### Perfect For
- **Researchers** who want private capture
- **Developers** who prefer self-hosted tools
- **Privacy-conscious** users
- **Offline workers** who need reliability
- **Batch processors** who organize before submitting

### Consider Official Capture If
- You **need** direct Drafts app integration
- You **require** iCloud synchronization
- You **want** multi-device automatic sync
- You **prefer** official Agile Tortoise support

## 🔮 Future Possibilities

### Enhancements Within Scope
- ✅ **Export/Import** - Manual data transfer
- ✅ **Search/Filter** - Find drafts easily
- ✅ **Draft Templates** - Pre-defined formats
- ✅ **Web Interface** - View submitted drafts
- ✅ **API Extensions** - More integration options

### Out of Scope
- ❌ **CloudKit Integration** - Requires Apple setup
- ❌ **iCloud Sync** - Against self-hosted goals
- ❌ **Official Affiliation** - Independent project
- ❌ **Drafts App Replacement** - Complementary tool

## 🎉 Final Recommendation

**Use this implementation as:**
1. **Primary system** if you want self-hosted control
2. **Secondary system** if you need Drafts integration
3. **Offline backup** for reliable capture anywhere
4. **Research tool** for organizing before submitting

**Perfect for those who want privacy, control, and flexibility!** 🚀

---

*Have questions? Check the documentation or ask for clarification.*
*Need Drafts integration? Consider using both systems together.*
*Want enhancements? The code is open and extensible.*