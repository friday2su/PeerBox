# PeerBox

Encrypted peer-to-peer file transfer in your browser.

<img width="1364" height="767" alt="image" src="https://github.com/user-attachments/assets/d3589dfa-1c72-4962-a674-839658b5a09a" />

## Features

- End-to-end encrypted file transfers
- Direct browser-to-browser connection (no server storage)
- No accounts or uploads required
- QR code room sharing
- Supports large files via streaming

## Tech Stack

- Next.js 14
- PeerJS (WebRTC signaling)
- WebRTC Data Channels
- ECDH + AES-GCM encryption
- Tailwind CSS

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## How It Works

1. **Send** — Select files, get a room code or QR
2. **Receive** — Enter code or scan QR on another device
3. **Done** — Files stream directly, encrypted end-to-end

## Features

| Feature | PeerBox | Traditional |
|---------|---------|------------|
| Server for transfer | ❌ None | ✅ Required |
| End-to-end encryption | ✅ ECDH + AES-GCM | ❌ Usually none |
| File storage | ❌ Never stored | ✅ Server storage |
| Download limits | ✅ Unlimited | ❌ 1-time usually |
| Expiration | ✅ Ephemeral | ❌ Time-based only |
| File size | ✅ Unlimited* | ❌ Server limited |
| Privacy | ✅ 100% private | ❌ Server sees all |

*Browser memory is the only limit. Files stream in chunks.

## Tech Stack

- **Next.js 14** — Framework
- **PeerJS** — WebRTC signaling
- **WebRTC Data Channels** — Direct P2P transport
- **ECDH + AES-GCM** — End-to-end encryption
- **Tailwind CSS** — Styling

## Comparison: PeerBox vs Server-Based Solutions

### Your Friend's Server Solution

```javascript
// Files go through server — server sees everything
app.post('/upload', upload.single('file'), (req, res) => {
    // File stored on server
    filesStore.set(fileId, fileData);
});
```

**Problems:**
- Files stored on server (security risk)
- Server sees unencrypted file content
- Single download only (ephemeral but limited)
- 50MB file limit
- Needs always-on server hosting
- Server costs money
- Single point of failure
- Server can go down

### PeerBox

```javascript
// Files stream directly — server never sees content
for await (const chunk of streamFileChunks(file)) {
    await session.sendBinary(chunk); // Encrypted before send
}
```

**Advantages:**
- No server in transfer path
- Files never stored anywhere
- End-to-end encrypted (server can't read)
- Unlimited downloads
- No file size server limit
- No server hosting costs
- No server maintenance
- Works offline (same network)

## Architecture

```
Traditional (Server-Based):
┌─────────┐     ┌─────────┐     ┌─────────┐
│ Sender  │ ──► │ Server  │ ──► │Receiver │
└─────────┘     └─────────┘     └─────────┘
                 ▲ ▲ ▲
                 │ │ │
            Sees files, metadata, IPs

PeerBox (P2P):
┌─────────┐     ┌─────────┐     ┌─────────┐
│ Sender  │ ◄── │ PeerJS  │──► │Receiver │
└─────────┘     │ (signal)│     └─────────┘
                └─────────┘
                     │
              Signal only, no file data
```

## Security

- **ECDH key exchange** — Both parties generate key pairs, exchange public keys
- **AES-GCM encryption** — All file chunks encrypted before transmission
- **No key storage** — Keys are ephemeral, generated per session
- **No server access** — Transfer happens directly between browsers

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_PEERJS_KEY` | Cloud server | PeerJS API key for signaling |
| `NEXT_PUBLIC_TURN_URL` | — | TURN server for NAT traversal |

## License

MIT
