# Markdown Editor & Draft Management

## 🎯 Overview

The enhanced interface now includes a **full-featured Markdown editor** with real-time preview and **comprehensive draft management** capabilities. This transforms the service from a simple capture tool to a powerful note-taking and research assistant.

## 📝 Markdown Editor Features

### 1. Dual-Pane Interface

```
┌───────────────────────────────────────────────────────┐
│  ✏️ Edit  👁️ Preview                              │
├───────────────────────────────────────────────────────┤
│  [Edit Tab - Active]                                 │
│  # Heading                                         │
│  **Bold text**                                     │
│  `code example`                                    │
│  - List item                                       │
│                                                       │
│  [Preview Tab]                                      │
│  # Heading                                          │
│  **Bold text**                                      │
│  `code example`                                     │
│  • List item                                        │
└───────────────────────────────────────────────────────┘
```

### 2. Real-Time Preview

- **Instant rendering**: Preview updates as you type
- **Syntax highlighting**: Code blocks with proper highlighting
- **GitHub Flavored Markdown**: Full GFM support
- **Live updates**: Only when preview tab is active

### 3. Supported Markdown Syntax

#### Headings
```markdown
# Heading 1
## Heading 2
### Heading 3
```

#### Text Formatting
```markdown
**bold** or __bold__
*italic* or _italic_
~~strikethrough~~
`code`
```

#### Lists
```markdown
- Item 1
- Item 2
  - Nested item

1. First
2. Second
3. Third
```

#### Code Blocks
````markdown
```javascript
function hello() {
  return 'Hello World';
}
```
````

#### Links & Images
```markdown
[Link text](https://example.com)
![Image alt](image.png)
```

#### Tables
```markdown
| Header 1 | Header 2 |
|----------|----------|
| Cell 1   | Cell 2   |
```

#### Blockquotes
```markdown
> This is a blockquote
> with multiple lines
```

#### Horizontal Rules
```markdown
---
***
___
```

## 📋 Draft Management System

### Visual Draft Queue

```
┌───────────────────────────────────────────────────────┐
│ 📋 Your Drafts (3)                                  │
├───────────────────────────────────────────────────────┤
│ Draft 1                                           [📝][🗑️] │
│ First 100 characters of content...                 │
│ 🏷️ tag1, tag2  💻 Markdown                        │
│                                                       │
│ Draft 2                                           [📝][🗑️] │
│ Another draft content preview...                   │
│ 🏷️ research  💻 Plain Text                        │
│                                                       │
│ Draft 3                                           [📝][🗑️] │
│ Final draft in the queue...                        │
│ 💻 Markdown  🚩 Flagged                            │
└───────────────────────────────────────────────────────┘
```

### Draft Actions

#### Edit Drafts
1. Click **📝 Edit** button on any draft
2. Draft content loads into editor
3. Make changes
4. Click "Add to Queue" to update

#### Remove Drafts
1. Click **🗑️ Remove** button
2. Confirm deletion
3. Draft removed from queue

#### Submit All
1. Click **"Submit All (N)"**
2. All drafts sent to server
3. Progress shown for each draft
4. Queue cleared on success

#### Discard All
1. Click **"Discard All"**
2. Confirm discarding all drafts
3. Queue cleared without submitting

## 🔄 Workflow Examples

### Research Session
```
1. Open Drafts Web Capture
2. Visit research page 1 → Capture key points → Add to Queue
3. Visit research page 2 → Capture more points → Add to Queue
4. Visit research page 3 → Capture final points → Add to Queue
5. Review all 3 drafts in queue
6. Edit draft 2 to add more details
7. Click "Submit All (3)"
8. All research captured in Drafts app
```

### Note-Taking Workflow
```
1. Start with blank capture form
2. Take notes during meeting → Add to Queue
3. Continue taking notes → Add to Queue
4. Review and organize notes
5. Edit any drafts as needed
6. Submit all when meeting ends
```

### Offline Capture
```
1. Start capture session on laptop
2. Create drafts while offline
3. Drafts saved in browser
4. Go online later
5. Click "Submit All"
6. All drafts sync to server
```

## 🎨 Editor Design

### Monospace Font
- **Font Family**: SF Mono, Menlo, Consolas
- **Benefits**: Better code readability
- **Fallback**: System monospace fonts

### Syntax Highlighting
- **Library**: highlight.js
- **Languages**: 190+ languages supported
- **Themes**: GitHub-style highlighting

### Tab Size
- **Size**: 4 spaces
- **Consistent**: Matches most code editors

### Line Height
- **Spacing**: 1.6em
- **Readability**: Optimal for code and text

## 🔧 Technical Implementation

### Markdown Processing
```javascript
// Configure marked.js
marked.setOptions({
    breaks: true,        // Convert newline to <br>
    gfm: true,           // GitHub Flavored Markdown
    highlight: function(code, lang) {
        // Syntax highlighting with highlight.js
        if (lang && hljs.getLanguage(lang)) {
            return hljs.highlight(code, { language: lang }).value;
        }
        return hljs.highlightAuto(code).value;
    }
});
```

### Real-Time Preview
```javascript
function setupRealTimePreview() {
    textarea.addEventListener('input', function() {
        if (previewTabActive) {
            updatePreview();
        }
    });
}

function updatePreview() {
    const content = textarea.value;
    previewContent.innerHTML = marked.parse(content);
}
```

### Draft Storage
```javascript
// Each draft stored as:
{
    content: "Markdown content",
    tags: "tag1, tag2",
    syntax: "Markdown",
    flagged: true/false,
    useLocation: true/false
}

// Queue stored in localStorage as JSON
localStorage.setItem('draftQueue', JSON.stringify(draftQueue));
```

## 🚀 Benefits

### For Users
1. **Rich Text Editing**: Full Markdown support
2. **Visual Feedback**: Real-time preview
3. **Code-Friendly**: Syntax highlighting
4. **Draft Management**: Edit, organize, review
5. **Offline Capable**: Work without internet

### For Developers
1. **Standard Compliance**: Uses common Markdown libraries
2. **Extensible**: Easy to add new features
3. **Performance**: Client-side processing
4. **Maintainable**: Clean separation of concerns

## 🔮 Future Enhancements

### Editor Improvements
1. **Toolbar**: Format buttons for common Markdown
2. **Auto-complete**: Suggestions for Markdown syntax
3. **Spell Check**: Built-in spelling correction
4. **Word Count**: Character and word statistics

### Draft Management
1. **Draft Reordering**: Drag-and-drop organization
2. **Bulk Actions**: Select multiple drafts
3. **Draft Export**: Save queue to file
4. **Draft Import**: Load queue from file

### Advanced Features
1. **Templates**: Pre-defined draft templates
2. **Categories**: Organize drafts by type
3. **Search**: Find drafts in queue
4. **Version History**: Track draft changes

## 📚 Markdown Resources

### Cheat Sheets
- [Markdown Guide](https://www.markdownguide.org/cheat-sheet/)
- [GitHub Markdown](https://guides.github.com/features/mastering-markdown/)
- [CommonMark Spec](https://commonmark.org/help/)

### Tutorials
- [Markdown in 60 Seconds](https://commonmark.org/help/tutorial/)
- [Interactive Tutorial](https://www.markdowntutorial.com/)

### Tools
- [Markdown Live Preview](https://markdownlivepreview.com/)
- [StackEdit](https://stackedit.io/)

## 🎯 Summary

The enhanced Markdown editor and draft management system provides:

✅ **Professional Editing**: Full Markdown support with syntax highlighting
✅ **Real-Time Preview**: Instant visual feedback
✅ **Draft Organization**: View, edit, and manage multiple drafts
✅ **Offline Capability**: Work without internet connection
✅ **Batch Processing**: Submit multiple drafts at once
✅ **Modern UI**: Clean, professional interface

This transformation makes Drafts Web Capture a **powerful research and note-taking tool** while maintaining the simplicity that makes it easy to use. The Markdown support is particularly valuable for developers, writers, and anyone who works with structured text.

**Perfect for research, note-taking, and information organization!** 🚀