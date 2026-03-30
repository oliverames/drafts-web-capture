# Drafts Web Capture - Self-Hosted Implementation Plan

## Overview
Create a self-hosted version of Drafts Capture that runs on a Mac server with TailScale funnel access and simple password protection.

## Architecture
```
Web Browser → TailScale Funnel → Docker Container → Node.js Server → SQLite Database
```

## Technology Stack
- **Backend**: Node.js with Express
- **Frontend**: HTML/CSS/JavaScript (similar to original)
- **Database**: SQLite (file-based, no server required)
- **Container**: Docker with Node.js Alpine image
- **Network**: TailScale for secure remote access
- **Auth**: Basic password protection

## Implementation Phases

### Phase 1: Setup Project Structure
```bash
projects/drafts-web/
├── src/
│   ├── server.js          # Main Node.js server
│   ├── routes/            # Express routes
│   ├── public/            # Frontend assets
│   ├── database/          # SQLite setup
│   └── middleware/        # Auth middleware
├── Dockerfile             # Container configuration
├── docker-compose.yml     # Docker compose setup
├── package.json           # Node.js dependencies
└── README.md              # Project documentation
```

### Phase 2: Backend Implementation

#### server.js
- Express server setup
- Basic routes: `/`, `/api/capture`
- Error handling middleware
- CORS configuration

#### routes/capture.js
- POST endpoint for draft creation
- Input validation
- Database interaction
- Response formatting

#### middleware/auth.js
- Basic password authentication
- Session management (optional)
- Rate limiting

#### database/db.js
- SQLite connection setup
- Schema creation
- Query functions

### Phase 3: Frontend Implementation

#### public/index.html
- HTML structure matching original
- Form with content, tags, syntax fields
- Responsive design

#### public/css/styles.css
- Clean, modern styling
- Mobile-friendly layout
- Dark/light mode support

#### public/js/app.js
- Form submission handling
- Client-side validation
- Success/error feedback
- Local storage for preferences

### Phase 4: Docker Configuration

#### Dockerfile
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["node", "src/server.js"]
```

#### docker-compose.yml
```yaml
version: '3.8'
services:
  drafts-web:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
    restart: unless-stopped
```

### Phase 5: TailScale Integration

1. Install TailScale on Mac server
2. Configure TailScale funnel:
   ```bash
   tailscale funnel 3000 on
   ```
3. Set up password protection in Express middleware
4. Test remote access via TailScale

### Phase 6: Security Considerations

- **Password Protection**: Basic auth middleware
- **Rate Limiting**: Prevent brute force attacks
- **Input Sanitization**: Prevent XSS/SQL injection
- **HTTPS**: TailScale provides encryption
- **CORS**: Restrict to your domains

### Phase 7: Deployment

1. Build Docker image:
   ```bash
   docker-compose build
   ```
2. Start container:
   ```bash
   docker-compose up -d
   ```
3. Configure TailScale funnel
4. Test locally and remotely
5. Set up monitoring (optional)

## Development Timeline

1. **Day 1**: Project setup, basic server, Docker config
2. **Day 2**: Database integration, auth middleware
3. **Day 3**: Frontend implementation
4. **Day 4**: TailScale integration, testing
5. **Day 5**: Security hardening, documentation

## Next Steps

1. Initialize Node.js project:
   ```bash
   npm init -y
   npm install express sqlite3 body-parser cors
   ```
2. Create basic server structure
3. Implement database schema
4. Build authentication middleware
5. Create frontend templates

## Requirements

- Node.js 18+
- Docker Desktop
- TailScale installed on Mac
- Basic password for authentication

## Success Criteria

- ✅ Local development server runs
- ✅ Docker container builds and runs
- ✅ Can create drafts via web interface
- ✅ Drafts persist in SQLite database
- ✅ TailScale funnel provides remote access
- ✅ Password protection works
- ✅ Mobile-friendly interface

Let's begin implementation!