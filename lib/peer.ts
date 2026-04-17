import Peer, { DataConnection } from "peerjs";

import {
  decryptMessage,
  deriveSharedKey,
  encryptMessage,
  generateKeyPair,
} from "@/lib/crypto";

type IceServer = {
  urls: string | string[];
  username?: string;
  credential?: string;
};

export type PeerRole = "sender" | "receiver";
export type ConnectionState =
  | "idle"
  | "connecting"
  | "waiting"
  | "connected"
  | "encrypted"
  | "transferring"
  | "completed"
  | "error";

type PlainHandshakeMessage = {
  type: "pubkey";
  key: JsonWebKey;
};

type TransportPayload =
  | {
      kind: "json";
      text: string;
    }
  | {
      kind: "binary";
      buffer: ArrayBuffer;
    };

type PeerSessionEvents = {
  onStateChange?: (state: ConnectionState) => void;
  onStatus?: (message: string) => void;
  onEncryptedChange?: (encrypted: boolean) => void;
  onTransport?: (payload: TransportPayload) => void;
  onError?: (message: string) => void;
  onOpen?: () => void;
  onClose?: () => void;
};

function buildIceServers(): IceServer[] {
  const servers: IceServer[] = [
    {
      urls: [
        "stun:stun.l.google.com:19302",
        "stun:stun1.l.google.com:19302",
      ],
    },
  ];

  if (process.env.NEXT_PUBLIC_TURN_URL) {
    servers.push({
      urls: process.env.NEXT_PUBLIC_TURN_URL,
      username: process.env.NEXT_PUBLIC_TURN_USERNAME,
      credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL,
    });
  }

  return servers;
}

function toArrayBuffer(value: unknown): ArrayBuffer | null {
  if (value instanceof ArrayBuffer) {
    return value;
  }

  if (ArrayBuffer.isView(value)) {
    const view = value as ArrayBufferView;
    return view.buffer.slice(
      view.byteOffset,
      view.byteOffset + view.byteLength,
    );
  }

  if (value instanceof Blob) {
    return null;
  }

  return null;
}

async function exportPublicKey(keyPair: CryptoKeyPair) {
  return crypto.subtle.exportKey("jwk", keyPair.publicKey);
}

function encodeTransportPayload(payload: TransportPayload): ArrayBuffer {
  if (payload.kind === "json") {
    const textBytes = new TextEncoder().encode(payload.text);
    const buffer = new Uint8Array(1 + textBytes.byteLength);
    buffer[0] = 0;
    buffer.set(textBytes, 1);
    return buffer.buffer;
  }

  const chunk = new Uint8Array(payload.buffer);
  const buffer = new Uint8Array(1 + chunk.byteLength);
  buffer[0] = 1;
  buffer.set(chunk, 1);
  return buffer.buffer;
}

function decodeTransportPayload(buffer: ArrayBuffer): TransportPayload {
  const view = new Uint8Array(buffer);
  const kind = view[0];
  const payload = view.slice(1).buffer;

  if (kind === 0) {
    return {
      kind: "json",
      text: new TextDecoder().decode(payload),
    };
  }

  return {
    kind: "binary",
    buffer: payload,
  };
}

export function generateRoomCode(): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  const bytes = crypto.getRandomValues(new Uint8Array(6));

  for (const byte of bytes) {
    code += alphabet[byte % alphabet.length];
  }

  return code;
}

export class PeerSession {
  private readonly role: PeerRole;
  private readonly events: PeerSessionEvents;
  private peer: Peer | null = null;
  private connection: DataConnection | null = null;
  private keyPair: CryptoKeyPair | null = null;
  private sharedKey: CryptoKey | null = null;
  private remotePublicKey: JsonWebKey | null = null;
  private handshakeStarted = false;
  private destroyed = false;

  constructor(role: PeerRole, events: PeerSessionEvents = {}) {
    this.role = role;
    this.events = events;
  }

  private updateState(state: ConnectionState) {
    this.events.onStateChange?.(state);
  }

  private updateStatus(message: string) {
    this.events.onStatus?.(message);
  }

  private fail(message: string) {
    this.updateState("error");
    this.updateStatus(message);
    this.events.onError?.(message);
  }

  private setupConnection(connection: DataConnection) {
    this.connection = connection;

    connection.on("open", () => {
      this.updateState("connected");
      this.events.onOpen?.();
      void this.beginHandshake();
    });

    connection.on("data", (data) => {
      void this.handleIncomingData(data);
    });

    connection.on("close", () => {
      if (!this.destroyed) {
        this.events.onEncryptedChange?.(false);
        this.fail("Peer disconnected. You can try again.");
      }
      this.events.onClose?.();
    });

    connection.on("error", (error) => {
      this.fail(error.message || "Peer connection error.");
    });
  }

  private async beginHandshake() {
    if (!this.connection || this.handshakeStarted) {
      return;
    }

    this.handshakeStarted = true;
    this.updateStatus("Exchanging encryption keys…");

    try {
      this.keyPair = await generateKeyPair();
      const publicKey = await exportPublicKey(this.keyPair);
      const message: PlainHandshakeMessage = {
        type: "pubkey",
        key: publicKey,
      };
      this.connection.send(message);
    } catch (error) {
      this.fail(
        error instanceof Error ? error.message : "Failed to start encryption.",
      );
    }
  }

  private async handleHandshakeMessage(message: PlainHandshakeMessage) {
    if (!this.keyPair) {
      this.keyPair = await generateKeyPair();
    }

    this.remotePublicKey = message.key;
    this.sharedKey = await deriveSharedKey(this.keyPair.privateKey, message.key);
    this.events.onEncryptedChange?.(true);
    this.updateState("encrypted");
    this.updateStatus("End-to-end encryption active.");
  }

  private async handleIncomingData(data: unknown) {
    if (
      typeof data === "object" &&
      data !== null &&
      "type" in data &&
      (data as PlainHandshakeMessage).type === "pubkey"
    ) {
      await this.handleHandshakeMessage(data as PlainHandshakeMessage);
      return;
    }

    const raw = toArrayBuffer(data);
    if (!raw) {
      return;
    }

    if (!this.sharedKey) {
      this.fail("Received encrypted data before handshake completed.");
      return;
    }

    try {
      const decrypted = await decryptMessage(this.sharedKey, raw);
      this.events.onTransport?.(decodeTransportPayload(decrypted));
    } catch (error) {
      this.fail(
        error instanceof Error ? error.message : "Failed to decrypt data.",
      );
    }
  }

  async createSender(roomCode: string) {
    this.updateState("connecting");
    this.updateStatus("Opening room…");

    const peer = new Peer(roomCode, {
      host: "0.peerjs.com",
      port: 443,
      path: "/",
      secure: true,
      config: {
        iceServers: buildIceServers(),
      },
    });

    this.peer = peer;

    peer.on("open", () => {
      this.updateState("waiting");
      this.updateStatus("Room ready. Waiting for a receiver…");
    });

    peer.on("connection", (connection) => {
      this.updateStatus("Receiver connected. Securing channel…");
      this.setupConnection(connection);
    });

    peer.on("error", (error) => {
      this.fail(error.message || "Failed to create room.");
    });
  }

  async createReceiver(roomCode: string) {
    this.updateState("connecting");
    this.updateStatus("Connecting to sender…");

    const peer = new Peer({
      host: "0.peerjs.com",
      port: 443,
      path: "/",
      secure: true,
      config: {
        iceServers: buildIceServers(),
      },
    });

    this.peer = peer;

    peer.on("open", () => {
      const connection = peer.connect(roomCode, {
        reliable: true,
        serialization: "binary",
      });
      this.setupConnection(connection);
    });

    peer.on("error", (error) => {
      this.fail(error.message || "Failed to connect to room.");
    });
  }

  async sendJson(text: string) {
    if (!this.sharedKey || !this.connection?.open) {
      throw new Error("Secure channel is not ready.");
    }

    const payload = encodeTransportPayload({ kind: "json", text });
    const encrypted = await encryptMessage(this.sharedKey, payload);
    this.connection.send(encrypted);
  }

  async sendBinary(buffer: ArrayBuffer) {
    if (!this.sharedKey || !this.connection?.open) {
      throw new Error("Secure channel is not ready.");
    }

    const payload = encodeTransportPayload({ kind: "binary", buffer });
    const encrypted = await encryptMessage(this.sharedKey, payload);
    this.connection.send(encrypted);
  }

  isSecure() {
    return Boolean(this.sharedKey);
  }

  isOpen() {
    return Boolean(this.connection?.open);
  }

  destroy() {
    this.destroyed = true;
    this.events.onEncryptedChange?.(false);
    this.connection?.close();
    this.peer?.destroy();
    this.connection = null;
    this.peer = null;
    this.sharedKey = null;
    this.keyPair = null;
    this.remotePublicKey = null;
    this.handshakeStarted = false;
  }
}
