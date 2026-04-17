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

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Environment Variables

- `NEXT_PUBLIC_PEERJS_KEY` - PeerJS API key (uses cloud server by default)
- `NEXT_PUBLIC_TURN_URL` - TURN server URL for NAT traversal fallback

## How It Works

1. Sender creates a room and shares the code/QR
2. Both browsers exchange ECDH public keys
3. Files stream directly via WebRTC Data Channels
4. Files never touch any server
