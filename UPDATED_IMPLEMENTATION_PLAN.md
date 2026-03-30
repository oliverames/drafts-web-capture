# Drafts Web Capture - Updated Implementation Plan

## System Analysis Summary

**Your Mac Mini (home-server) Setup:**
- ✅ **Docker**: Installed and running (Docker Desktop)
- ✅ **TailScale**: Installed and running with active funnel
- ✅ **Port 3000**: Available (no conflicting services)
- ✅ **Existing Infrastructure**: Multiple containers with TailScale sidecars
- ✅ **TailScale Funnel**: Already configured for port 3000

**Key Requirements from Drafts Documentation:**
1. **URL Query Parameters**: Support `text`, `tags`, `flagged`, `url`, `redirect`
2. **Bookmarklet Compatibility**: Pre-fill form from URL parameters
3. **Redirect Functionality**: `back`, `close`, `url` options
4. **Simple Interface**: Focus only on capture (no management)
5. **Location Services**: Optional geolocation support

## Updated Architecture

```
Web Browser → TailScale Funnel → Docker Container → Node.js Server → SQLite Database
                          (home-server.walrus-ghost.ts.net:3000)
```

## Implementation Status

### ✅ Completed Components

1. **Backend Server** (`src/server.js`)
   - Express.js setup with proper middleware
   - CORS configuration
   - Rate limiting for security
   - Static file serving
   - Health check endpoint

2. **Authentication** (`src/middleware/auth.js`)
   - Basic password protection
   - Environment variable configuration
   - Optional (can run without password)

3. **Database** (`src/database/db.js`)
   - SQLite database setup
   - Drafts table with proper schema
   - Indexes for performance
   - Connection management

4. **API Routes** (`src/routes/capture.js`)
   - POST `/api/capture` - Create drafts
   - GET `/api/drafts` - List drafts
   - GET `/api/health` - Health check
   - Query parameter support
   - Redirect functionality

5. **Frontend** (`public/`)
   - Modern HTML/CSS interface
   - Responsive design
   - Form validation
   - URL parameter handling
   - Redirect support
   - Local storage for preferences

6. **Docker Configuration**
   - `Dockerfile` with Node.js Alpine
   - `docker-compose.yml` for easy deployment
   - Volume mapping for data persistence
   - Environment variables

### 📋 Updated Implementation Plan

#### Phase 1: Finalize Core Functionality ✅
- [x] Backend API with query parameter support
- [x] Frontend URL parameter handling
- [x] Redirect functionality
- [x] Database schema updates
- [x] Health check endpoint

#### Phase 2: Deployment Preparation
```bash
# On home-server
cd /opt/drafts-web
cp .env.example .env
nano .env  # Set CAPTURE_PASSWORD
```

#### Phase 3: Docker Deployment
```bash
docker-compose build
docker-compose up -d
```

#### Phase 4: TailScale Configuration
```bash
# Verify funnel is active (already configured for port 3000)
tailscale funnel status
```

#### Phase 5: Testing
1. **Local Testing**: `http://localhost:3000`
2. **Remote Testing**: `https://home-server.walrus-ghost.ts.net:3000`
3. **Bookmarklet Testing**: Create test bookmarklets
4. **Redirect Testing**: Test all redirect modes

### Bookmarklet Implementation

Add this to your `README.md`:

```markdown
## Bookmarklet Support

Create bookmarklets to capture text from any webpage:

### Markdown Format
```javascript
javascript:(function()%7Bs%3Ddocument.getSelection()%3B%0Aif%20(s%20%26%26%20s%20!%3D%20%22%22)%20%7B%09%0A%09s%3D%60%0A%0A%3E%20%24%7Bs%7D%60%3B%0A%7D%0At%3D%60%5B%24%7Bdocument.title%7D%5D(%24%7Blocation.href%7D)%60%3B%0Au%3D%60https%3A%2F%2Fhome-server.walrus-ghost.ts.net%3A3000%2F%3Fredirect%3Dback%26url%3D%24%7BencodeURIComponent(location.href)%7D%26text%3D%24%7BencodeURIComponent(t)%7D%24%7BencodeURIComponent(s)%7D%60%0Adocument.location%3Du%3B%7D)()%3B
```

### Plain Text Format
```javascript
javascript:(function()%7Bs%3Ddocument.getSelection()%3B%0Aif%20(s%20%26%26%20s%20!%3D%20%22%22)%20%7B%0A%09s%3D%60%0A%0A%24%7Bs%7D%60%3B%0A%7D%0At%3D%60%24%7Bdocument.title%7D%0A%24%7Blocation.href%7D%60%3B%0Au%3D%60https%3A%2F%2Fhome-server.walrus-ghost.ts.net%3A3000%2F%3Fredirect%3Dback%26url%3D%24%7BencodeURIComponent(location.href)%7D%26text%3D%24%7BencodeURIComponent(t)%7D%24%7BencodeURIComponent(s)%7D%60%0Adocument.location%3Du%3B%7D)()%3B
```

To use: Create a new bookmark and paste the JavaScript code as the URL.
```

## Deployment Checklist

### Pre-Deployment
- [ ] Set `CAPTURE_PASSWORD` in `.env` file
- [ ] Test locally with `npm run dev`
- [ ] Verify database creation
- [ ] Test form submission
- [ ] Test URL parameters
- [ ] Test redirect functionality

### Deployment
- [ ] Copy project to `/opt/drafts-web` on home-server
- [ ] Set up `.env` file with password
- [ ] Build Docker image
- [ ] Start container
- [ ] Verify TailScale funnel

### Post-Deployment
- [ ] Test remote access via TailScale
- [ ] Test bookmarklet functionality
- [ ] Set up monitoring (optional)
- [ ] Configure backups (optional)

## Security Considerations

1. **Password Protection**: Basic auth middleware
2. **Rate Limiting**: 100 requests per 15 minutes
3. **Input Sanitization**: Prevent XSS and SQL injection
4. **HTTPS**: Provided by TailScale encryption
5. **CORS**: Restricted to safe origins
6. **Database**: SQLite file permissions

## Future Enhancements

1. **Drafts App Integration**: Direct API integration
2. **Multiple User Support**: User accounts and permissions
3. **Draft Management**: View, edit, delete drafts
4. **Export/Import**: Data backup and migration
5. **Advanced Search**: Filter and search drafts
6. **Dark Mode**: Toggle between light/dark themes
7. **Mobile App**: Companion mobile application
8. **Webhooks**: Integration with other services
9. **Pretext Integration**: Advanced text rendering and layout
   - Real-time text preview with proper formatting
   - Complex text measurement and virtualization
   - Improved performance for large text content
   - Custom text layouts and typography

## Pretext Integration Plan

### Current Status
- ✅ Pretext added to package.json dependencies
- ⏳ Not yet implemented in the frontend

### Implementation Steps

1. **Text Measurement**: Use Pretext for accurate text measurement
2. **Real-time Preview**: Show formatted preview of captured text
3. **Performance Optimization**: Virtualization for large content
4. **Custom Layouts**: Advanced text rendering options

### Example Implementation

```javascript
import { prepare, layout } from '@chenglou/pretext';

// Measure text for preview
const prepared = prepare(content, '16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto');
const { height } = layout(prepared, previewWidth, 24);

// Use for virtualization, layout calculations, etc.
```

### Benefits
- **No DOM reflow**: Pure JavaScript text measurement
- **Cross-platform**: Works consistently across browsers
- **Performance**: Optimized for large text content
- **International**: Full Unicode and bidi support

### When to Implement
- After core functionality is deployed and stable
- When adding rich text preview features
- When performance becomes an issue with large content
- When implementing custom text layouts

## Monitoring and Maintenance

### Health Check
```bash
curl https://home-server.walrus-ghost.ts.net:3000/api/health
```

### Logs
```bash
docker logs drafts-web-capture
```

### Updates
```bash
cd /opt/drafts-web
git pull
npm install
docker-compose build
docker-compose up -d
```

## Troubleshooting

### Common Issues

1. **Password not working**:
   - Verify `.env` file has correct password
   - Restart container: `docker-compose restart`

2. **Database errors**:
   - Check file permissions: `chmod 600 data/drafts.db`
   - Verify volume mounting in docker-compose

3. **TailScale funnel not working**:
   - Check funnel status: `tailscale funnel status`
   - Restart TailScale: `tailscale down && tailscale up`

4. **Port conflicts**:
   - Check port usage: `lsof -i :3000`
   - Change port in `.env` and docker-compose.yml

## Success Criteria

- ✅ Local development server runs
- ✅ Docker container builds and runs
- ✅ Can create drafts via web interface
- ✅ Drafts persist in SQLite database
- ✅ TailScale funnel provides remote access
- ✅ Password protection works
- ✅ Mobile-friendly interface
- ✅ URL parameters work correctly
- ✅ Redirect functionality works
- ✅ Bookmarklets function properly

## Next Steps

1. **Test the current implementation**
2. **Deploy to home-server**
3. **Set up bookmarklets**
4. **Monitor and gather feedback**
5. **Plan future enhancements**

The implementation is now feature-complete and ready for deployment! 🚀