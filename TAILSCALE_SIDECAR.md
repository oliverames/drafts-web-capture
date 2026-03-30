# TailScale Sidecar Configuration

## 🎯 Overview

This guide explains how the TailScale sidecar container works and how to configure it for your Drafts Web Capture service.

## 🐳 Architecture

```
┌───────────────────────────────────────────────────────┐
│                   Home Server (Mac Mini)                │
├───────────────────────────────────────────────────────┤
│                                                       │
│  ┌─────────────────┐        ┌─────────────────┐       │
│  │  Drafts Web    │        │  TailScale     │       │
│  │  Container     │◄──────►│  Sidecar        │       │
│  │  (Node.js)     │        │  Container      │       │
│  └─────────────────┘        └─────────────────┘       │
│           ▲                        ▲                 │
└───────────┼────────────────────────┼─────────────────┘
            │                        │
            │                        │
            ▼                        ▼
┌───────────────────────────────────────────────────────┐
│                   TailScale Network                    │
└───────────────────────────────────────────────────────┘
```

## ✅ Benefits of Sidecar Approach

1. **Automatic Networking**: No manual funnel configuration needed
2. **Secure by Default**: All traffic encrypted through TailScale
3. **Consistent Setup**: Matches your existing container patterns
4. **Easy Management**: Containerized networking configuration
5. **Portable**: Works on any host with Docker

## 🔧 Configuration

### 1. Get Your TailScale Auth Key

```bash
# On your Mac (or any machine already on your TailScale network)
tailscale up --auth-key
```

This will output your auth key. Copy it for the next step.

### 2. Configure Environment Variables

Edit your `.env` file:

```env
# Required for TailScale sidecar
TAILSCALE_AUTHKEY=tskey-auth-your-key-here

# Optional: Customize TailScale hostname
TS_HOSTNAME=drafts-web

# Optional: Advertise additional routes
TS_EXTRA_ARGS=--advertise-routes=10.0.0.0/24
```

### 3. Start the Services

```bash
cd /opt/drafts-web
docker-compose up -d
```

## 📋 TailScale Sidecar Configuration Details

### Container Specifications

```yaml
services:
  ts-drafts-web:
    image: tailscale/tailscale:latest
    container_name: ts-drafts-web
    volumes:
      - /var/lib/tailscale:/var/lib/tailscale  # Persistent state
      - /dev/net/tun:/dev/net/tun              # Network tunnel device
    cap_add:
      - NET_ADMIN                              # Network administration
      - NET_RAW                                # Raw network access
    environment:
      - TS_STATE_DIR=/var/lib/tailscale      # State directory
      - TS_AUTHKEY=${TAILSCALE_AUTHKEY}       # Your auth key
      - TS_HOSTNAME=drafts-web                # Hostname in TailScale
      - TS_EXTRA_ARGS=--advertise-routes=10.0.0.0/24
```

### Environment Variables

| Variable | Purpose | Required | Default |
|----------|---------|----------|---------|
| `TS_AUTHKEY` | TailScale authentication key | ✅ Yes | None |
| `TS_HOSTNAME` | Hostname in TailScale network | ❌ No | Container name |
| `TS_STATE_DIR` | Directory for persistent state | ❌ No | `/var/lib/tailscale` |
| `TS_EXTRA_ARGS` | Additional TailScale arguments | ❌ No | None |

## 🔍 Verification

### Check Container Status

```bash
docker-compose ps
```

You should see both containers running:
- `drafts-web-capture` (your application)
- `ts-drafts-web` (TailScale sidecar)

### Check TailScale Status

```bash
# Exec into the sidecar container
docker exec -it ts-drafts-web tailscale status
```

### Test Remote Access

```bash
# From another machine on your TailScale network
curl https://drafts-web.your-tailnet.ts.net:3000/api/health
```

## 🛠️ Troubleshooting

### Common Issues

#### 1. Sidecar won't start
- **Check**: Auth key is correct
- **Fix**: Verify `TAILSCALE_AUTHKEY` in `.env`

#### 2. No network connectivity
- **Check**: Required capabilities (`NET_ADMIN`, `NET_RAW`)
- **Fix**: Ensure Docker is running with proper permissions

#### 3. Can't access service remotely
- **Check**: TailScale status in sidecar
- **Fix**: `docker exec -it ts-drafts-web tailscale up`

#### 4. Port conflicts
- **Check**: No other service using port 3000
- **Fix**: Change port in `docker-compose.yml`

### Debugging Commands

```bash
# View TailScale logs
docker logs ts-drafts-web

# Restart TailScale in sidecar
docker exec -it ts-drafts-web tailscale down && \
    docker exec -it ts-drafts-web tailscale up

# Check TailScale version
docker exec -it ts-drafts-web tailscale version
```

## 🔄 Updates and Maintenance

### Updating TailScale

```bash
# Pull latest TailScale image
docker-compose pull ts-drafts-web

# Recreate container
docker-compose up -d --force-recreate
```

### Rotating Auth Keys

1. Generate new auth key
2. Update `.env` file
3. Restart containers:

```bash
cd /opt/drafts-web
docker-compose down
docker-compose up -d
```

## 🔒 Security Considerations

1. **Auth Key Protection**: Keep your `TAILSCALE_AUTHKEY` secure
2. **Network Isolation**: Sidecar runs in same Docker network
3. **Persistent State**: TailScale state stored in `/var/lib/tailscale`
4. **Container Permissions**: Requires `NET_ADMIN` and `NET_RAW` capabilities

## 📚 Advanced Configuration

### Custom TailScale Arguments

Add additional TailScale flags via `TS_EXTRA_ARGS`:

```env
TS_EXTRA_ARGS=--advertise-routes=10.0.0.0/24 --advertise-exit-node
```

### Multiple Interfaces

To advertise multiple network interfaces:

```env
TS_EXTRA_ARGS=--advertise-routes=10.0.0.0/24,192.168.1.0/24
```

### Exit Node Configuration

Make this container an exit node:

```env
TS_EXTRA_ARGS=--advertise-exit-node
```

## 🎯 Comparison: Sidecar vs Funnel

### TailScale Sidecar (Recommended)
- ✅ Automatic networking
- ✅ No manual funnel setup
- ✅ Consistent with your other containers
- ✅ Better for multiple services
- ✅ More flexible routing options

### TailScale Funnel (Alternative)
- ✅ Simpler for single services
- ❌ Manual setup required
- ❌ Less flexible
- ❌ Doesn't match your existing pattern

## 🔮 Future Enhancements

1. **Automatic Auth Key Rotation**: Scripted key rotation
2. **Health Monitoring**: TailScale connectivity checks
3. **Multi-Region Support**: Geographic failover
4. **Bandwidth Monitoring**: Network usage tracking

## 📋 Checklist

- [ ] Obtain TailScale auth key
- [ ] Add `TAILSCALE_AUTHKEY` to `.env`
- [ ] Configure desired `TS_HOSTNAME`
- [ ] Set any additional `TS_EXTRA_ARGS`
- [ ] Start containers with `docker-compose up -d`
- [ ] Verify TailScale connectivity
- [ ] Test remote access

The TailScale sidecar is now properly configured and matches the pattern used in your other containers (plex, cinny, synapse, etc.). This provides consistent, secure networking across all your self-hosted services.