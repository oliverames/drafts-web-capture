# Pretext Integration Demo

This document shows how Pretext can be integrated into the Drafts Web Capture interface for advanced text rendering.

## Current Implementation (Simple)

```html
<textarea id="draft-content" rows="10"></textarea>
```

## Future Implementation with Pretext

### Text Preview Component

```javascript
import { prepare, layout } from '@chenglou/pretext';

class TextPreview extends React.Component {
  constructor(props) {
    super(props);
    this.canvasRef = React.createRef();
    this.state = {
      prepared: null,
      lines: []
    };
  }

  componentDidMount() {
    this.updatePreview();
  }

  componentDidUpdate(prevProps) {
    if (prevProps.content !== this.props.content) {
      this.updatePreview();
    }
  }

  updatePreview() {
    const { content, font, width, lineHeight } = this.props;
    
    if (!content) {
      this.setState({ prepared: null, lines: [] });
      return;
    }

    // Prepare text for measurement
    const prepared = prepare(content, font || '16px -apple-system');
    
    // Layout text
    const { lines } = layoutWithLines(prepared, width, lineHeight || 24);
    
    this.setState({ prepared, lines });
    this.drawPreview();
  }

  drawPreview() {
    const { lines } = this.state;
    const canvas = this.canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw each line
    lines.forEach((line, index) => {
      ctx.fillText(line.text, 0, index * 24);
    });
  }

  render() {
    const { width, height } = this.props;
    
    return (
      <div className="text-preview">
        <canvas
          ref={this.canvasRef}
          width={width}
          height={height}
          style={{ border: '1px solid #eee', background: 'white' }}
        />
        <div className="preview-stats">
          {this.state.lines.length} lines, {this.state.prepared?.graphemeCount} characters
        </div>
      </div>
    );
  }
}
```

### Performance Comparison

**Without Pretext (Current):**
- Uses browser's native textarea rendering
- DOM reflow on every keystroke
- Limited styling options
- Inconsistent across browsers

**With Pretext (Future):**
- Pure JavaScript text measurement
- No DOM reflow during typing
- Full control over rendering
- Consistent across all browsers
- Virtualization for large content
- Advanced typography features

### Example Use Cases

#### 1. Real-time Markdown Preview

```javascript
function MarkdownPreview({ content }) {
  const [preview, setPreview] = useState('');
  
  useEffect(() => {
    // Convert Markdown to HTML
    const html = marked(content);
    
    // Measure and layout with Pretext
    const prepared = prepare(html, '16px -apple-system');
    const { height } = layout(prepared, 800, 24);
    
    setPreview(html);
  }, [content]);

  return (
    <div className="markdown-preview" style={{ height: height + 'px' }}>
      <div dangerouslySetInnerHTML={{ __html: preview }} />
    </div>
  );
}
```

#### 2. Text Virtualization

```javascript
function VirtualizedText({ content, itemHeight }) {
  const [visibleItems, setVisibleItems] = useState([]);
  const containerRef = useRef();
  
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const scrollTop = container.scrollTop;
      const startIndex = Math.floor(scrollTop / itemHeight);
      const endIndex = startIndex + Math.ceil(container.clientHeight / itemHeight);
      
      // Only render visible items
      const visible = content.slice(startIndex, endIndex);
      setVisibleItems(visible);
    };

    container.addEventListener('scroll', handleScroll);
    handleScroll();
    
    return () => container.removeEventListener('scroll', handleScroll);
  }, [content, itemHeight]);

  return (
    <div ref={containerRef} style={{ height: '500px', overflow: 'auto' }}>
      <div style={{ height: content.length * itemHeight + 'px', position: 'relative' }}>
        {visibleItems.map((item, index) => (
          <div key={index} style={{ position: 'absolute', top: index * itemHeight + 'px' }}>
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}
```

#### 3. Text Measurement for UI

```javascript
function measureTextWidth(text, font) {
  const prepared = prepare(text, font);
  const { width } = layout(prepared, Infinity, 0); // No wrapping
  return width;
}

// Usage in component
const titleWidth = measureTextWidth('Drafts Web Capture', 'bold 24px -apple-system');
const subtitleWidth = measureTextWidth('Capture text to your Drafts app', '16px -apple-system');
```

## Integration Plan

### Phase 1: Basic Integration
1. Add Pretext to text input measurement
2. Implement real-time character/line counting
3. Add text statistics display
4. Basic performance monitoring

### Phase 2: Advanced Features
1. Markdown preview with proper formatting
2. Syntax highlighting for code blocks
3. Virtualized text rendering
4. Custom typography options

### Phase 3: Performance Optimization
1. Text virtualization for large content
2. Memory management for long documents
3. Caching and debouncing
4. Mobile optimization

## Benefits of Pretext Integration

1. **Performance**: No DOM reflow during text measurement
2. **Consistency**: Same rendering across all browsers
3. **Flexibility**: Full control over text layout
4. **International**: Full Unicode and bidi support
5. **Future-proof**: Ready for advanced text features

## When to Implement

Pretext integration should be considered when:
- Adding rich text preview features
- Experiencing performance issues with large text
- Needing consistent text measurement across browsers
- Implementing custom text layouts
- Building advanced typography features

For now, the simple textarea implementation is sufficient for the core capture functionality. Pretext is available for future enhancements when needed.