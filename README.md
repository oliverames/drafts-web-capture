# 🚀 Drafts Web Capture - Self-Hosted Edition

**A self-hosted Drafts Capture service with CloudKit integration for direct iCloud synchronization**

![Drafts Web Capture Screenshot](https://via.placeholder.com/800x400/2c3e50/ffffff?text=Drafts+Web+Capture)

## 🎯 Overview

This is a **self-hosted version** of Drafts Web Capture that integrates with the **official Drafts app ecosystem** using **CloudKit** for direct iCloud synchronization. It includes a **TailScale sidecar** for secure remote access and maintains a **local queue system** as fallback.

## ✨ Features

### 🔑 Core Integration
- **CloudKit JS** - Direct iCloud synchronization with Drafts app
- **Sign in with Apple** - Secure authentication
- **Drafts App URLs** - Generate proper `drafts://` URLs
- **TailScale Sidecar** - Secure remote access via your existing infrastructure

### 📝 Draft Management
- **Markdown Editor** - Real-time preview with syntax highlighting
- **Draft Queue System** - Create multiple drafts, submit all at once
- **Local Storage** - Drafts persist across sessions
- **Batch Processing** - Submit all drafts with one click
- **Individual Editing** - Edit any draft before submitting

### 📎 Attachment Support
- **File Uploads** - Support for .txt, .md, .pdf, .jpg, .png
- **Mail Drop Fallback** - Automatic handling for attachments
- **Size Limit** - Up to 5MB per attachment

### 🔒 Security
- **Password Protection** - Basic Auth with environment configuration
- **Rate Limiting** - 100 requests per 15 minutes
- **HTTPS via TailScale** - Secure remote connections

### 🎨 User Experience
- **Modern UI** - Professional gradient design
- **Real-time Preview** - Instant Markdown rendering
- **Keyboard Shortcuts** - Ctrl/Cmd+Enter to submit
- **Responsive Design** - Works on mobile and desktop
- **Visual Queue** - See all drafts with previews

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/drafts-web-capture.git
cd drafts-web-capture
```

### 2. Configure Environment

Copy the example environment file and set your password:

```bash
cp .env.example .env
nano .env
```

Set at minimum:
```
CAPTURE_PASSWORD=your_secure_password_here
TAILSCALE_AUTHKEY=your_tailscale_auth_key
```

### 3. Deploy with Docker

```bash
# Build and start the containers
docker-compose up -d
```

### 4. Access the Service

- **Local**: `http://localhost:3000`
- **Remote** (via TailScale): `https://your-tailscale-url:3000`

## 📋 Usage

### Basic Workflow

1. **Sign in with Apple** - Authenticate with your Apple ID
2. **Create Drafts** - Write content in the Markdown editor
3. **Add to Queue** - Drafts are stored locally
4. **Submit All** - Send all drafts to CloudKit → iCloud → Drafts App
5. **Open in Drafts** - Click the generated `drafts://` URL

### Advanced Features

- **URL Parameters**: Use query parameters for bookmarklets:
  ```
  http://localhost:3000/?text=Hello&tags=web,important&flagged=1
  ```

- **Redirect Options**: Control what happens after capture:
  ```
  ?redirect=back    # Go back to previous page
  ?redirect=close   # Close the window
  ?redirect=url&url=https://example.com  # Redirect to URL
  ```

- **Keyboard Shortcuts**:
  - `Ctrl+Enter` or `Cmd+Enter` - Submit draft
  - `Tab` - Switch between edit/preview modes

## 🛠️ Configuration

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `CAPTURE_PASSWORD` | Password for web interface | ✅ Yes | - |
| `TAILSCALE_AUTHKEY` | TailScale authentication key | ✅ Yes | - |
| `PORT` | Server port | ❌ No | 3000 |
| `DATABASE_PATH` | SQLite database path | ❌ No | `./data/drafts.db` |
| `DEBUG` | Enable verbose logging | ❌ No | false |

### Docker Configuration

The `docker-compose.yml` includes:
- Main Drafts Web Capture service
- TailScale sidecar container for secure remote access
- Persistent volume for database storage

## 🔧 Development

### Install Dependencies

```bash
npm install
```

### Run in Development Mode

```bash
npm run dev
```

### Build for Production

```bash
npm install --production
```

## 📚 Technical Details

### Architecture

```
Client → CloudKit JS → iCloud → Drafts App
         ↓
     Local Queue (Fallback)
         ↓
     SQLite Database
```

### Technology Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Backend**: Node.js, Express
- **Database**: SQLite (fallback), CloudKit (primary)
- **Authentication**: Sign in with Apple, Basic Auth
- **Deployment**: Docker, Alpine Node.js
- **Networking**: TailScale sidecar

### API Endpoints

- `GET /` - Web interface
- `POST /api/capture` - Create new draft
- `GET /api/drafts` - List all drafts
- `GET /api/health` - Health check

## 🎨 Screenshots

![Main Interface](https://via.placeholder.com/600x400/2c3e50/ffffff?text=Main+Interface)
![Draft Queue](https://via.placeholder.com/600x400/2c3e50/ffffff?text=Draft+Queue)
![Markdown Preview](https://via.placeholder.com/600x400/2c3e50/ffffff?text=Markdown+Preview)

## 📖 Documentation

- [COMPLETE_IMPLEMENTATION.md](COMPLETE_IMPLEMENTATION.md) - Full feature list
- [TAILSCALE_SIDECAR.md](TAILSCALE_SIDECAR.md) - TailScale configuration
- [DRAFT_QUEUE_FEATURE.md](DRAFT_QUEUE_FEATURE.md) - Queue system details
- [MARKDOWN_EDITOR.md](MARKDOWN_EDITOR.md) - Editor features
- [ATTACHMENT_FEATURE.md](ATTACHMENT_FEATURE.md) - Attachment handling

## 🤝 Contributing

Contributions are welcome! Please open issues and pull requests.

## 📜 License

MIT License - See [LICENSE](LICENSE) file for details.

## 🙏 Credits

- **Drafts App**: [https://getdrafts.com](https://getdrafts.com)
- **CloudKit JS**: Apple Inc.
- **TailScale**: [https://tailscale.com](https://tailscale.com)

---

**Built with ❤️ for Drafts power users** 🚀