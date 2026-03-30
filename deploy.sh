#!/bin/bash

# Drafts Web Capture Deployment Script
# Deploys the application to home-server via SSH

set -e

echo "🚀 Starting Drafts Web Capture deployment..."

# Configuration
REMOTE_USER="oliverames"
REMOTE_HOST="home-server"
REMOTE_PATH="/opt/drafts-web"
LOCAL_PATH="/Users/oliverames/Library/Mobile Documents/com~apple~CloudDocs/Developer/projects/drafts-web"

# Check if SSH key is available
if [ ! -f "$HOME/.ssh/id_rsa" ]; then
    echo "⚠️  SSH key not found. You may need to enter your password."
fi

echo "📦 Copying project files to home-server..."
rsync -avz --progress --exclude='node_modules' --exclude='data' --exclude='.git' \
    "$LOCAL_PATH/" \
    "$REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH/"

echo "📝 Setting up environment file..."
ssh "$REMOTE_USER@$REMOTE_HOST" "
    cd $REMOTE_PATH
    if [ ! -f .env ]; then
        cp .env.example .env
        echo "CAPTURE_PASSWORD=$(openssl rand -hex 16)" >> .env
        echo "TAILSCALE_AUTHKEY=your-tailscale-auth-key" >> .env
        echo "🔑 Generated random password. Add your TailScale auth key to .env file!"
    fi
    cat .env
"

echo "🛠️ Installing dependencies..."
ssh "$REMOTE_USER@$REMOTE_HOST" "
    cd $REMOTE_PATH
    if [ ! -d node_modules ]; then
        npm install --production
    else
        npm install --production
    fi
"

echo "🐳 Building Docker image..."
ssh "$REMOTE_USER@$REMOTE_HOST" "
    cd $REMOTE_PATH
    docker-compose build
"

echo "🚀 Starting container..."
ssh "$REMOTE_USER@$REMOTE_HOST" "
    cd $REMOTE_PATH
    docker-compose down || true
    docker-compose up -d
"

echo "🔍 Checking container status..."
ssh "$REMOTE_USER@$REMOTE_HOST" "
    cd $REMOTE_PATH
    docker-compose ps
"

echo "🌐 Testing remote access..."
REMOTE_URL="https://home-server.walrus-ghost.ts.net:3000"
if curl -s --head --request GET "$REMOTE_URL" | grep "200 OK"; then
    echo "✅ Deployment successful! Access your Drafts Capture at:"
    echo "   Local: http://localhost:3000"
    echo "   Remote: $REMOTE_URL"
    echo "   Password: $(ssh "$REMOTE_USER@$REMOTE_HOST" "cd $REMOTE_PATH && grep CAPTURE_PASSWORD .env | cut -d'=' -f2")"
else
    echo "⚠️  Remote access not working. Check TailScale funnel:"
    ssh "$REMOTE_USER@$REMOTE_HOST" "tailscale funnel status"
fi

echo "🎉 Deployment complete!"