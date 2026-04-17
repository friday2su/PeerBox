"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import ProgressBar from "@/app/components/ProgressBar";
import QRCode from "@/app/components/QRCode";
import { PeerSession, generateRoomCode } from "@/lib/peer";
import { createFileHeader, streamFileChunks } from "@/lib/transfer";

type FileProgress = { sentBytes: number; totalBytes: number; speedMbps: number; etaSeconds: number | null; completed: boolean };

type SendPanelProps = {
  onStateChange: (state: { connectionState: import("@/lib/peer").ConnectionState; statusMessage: string; encrypted: boolean }) => void;
};

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatEta(seconds: number | null) {
  if (seconds === null || !Number.isFinite(seconds)) return "—";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
}

export default function SendPanel({ onStateChange }: SendPanelProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [roomCode, setRoomCode] = useState("");
  const [dragging, setDragging] = useState(false);
  const [transfering, setTransfering] = useState(false);
  const [progressMap, setProgressMap] = useState<Record<string, FileProgress>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const sessionRef = useRef<PeerSession | null>(null);
  const connectionReadyRef = useRef(false);
  const shouldSendOnSecureRef = useRef(false);

  const shareUrl = useMemo(() => {
    if (!roomCode || typeof window === "undefined") return "";
    const url = new URL(window.location.href);
    url.searchParams.set("room", roomCode);
    return url.toString();
  }, [roomCode]);

  useEffect(() => {
    onStateChange({ connectionState: "idle", statusMessage: "Select files to share.", encrypted: false });
  }, [onStateChange]);

  useEffect(() => {
    return () => sessionRef.current?.destroy();
  }, []);

  const updateSharedState = (connectionState: import("@/lib/peer").ConnectionState, statusMessage: string, encrypted: boolean) => {
    onStateChange({ connectionState, statusMessage, encrypted });
  };

  const ensureSession = () => {
    sessionRef.current?.destroy();
    const session = new PeerSession("sender", {
      onStateChange: (state) => updateSharedState(state, "Preparing…", session.isSecure()),
      onStatus: (message) => updateSharedState(session.isSecure() ? "encrypted" : "waiting", message, session.isSecure()),
      onEncryptedChange: (encrypted) => {
        connectionReadyRef.current = encrypted;
        setErrorMessage(null);
        updateSharedState(encrypted ? "encrypted" : "connected", encrypted ? "Ready to send." : "Securing…", encrypted);
        if (encrypted && shouldSendOnSecureRef.current) {
          shouldSendOnSecureRef.current = false;
          void startSending(session);
        }
      },
      onError: (message) => {
        setTransfering(false);
        connectionReadyRef.current = false;
        setErrorMessage(message);
        updateSharedState("error", message, false);
      },
      onOpen: () => updateSharedState("connected", "Receiver joined. Securing…", false),
      onClose: () => setTransfering(false),
    });
    sessionRef.current = session;
    return session;
  };

  const startSending = async (session: PeerSession) => {
    updateSharedState("transferring", "Sending files…", true);
    try {
      for (const file of files) {
        const startTime = performance.now();
        let sentBytes = 0;
        await session.sendJson(createFileHeader(file));
        for await (const chunk of streamFileChunks(file)) {
          await session.sendBinary(chunk);
          sentBytes += chunk.byteLength;
          const elapsedSeconds = Math.max((performance.now() - startTime) / 1000, 0.001);
          const speed = sentBytes / elapsedSeconds / (1024 * 1024);
          const remaining = file.size - sentBytes;
          const etaSeconds = speed > 0 ? remaining / (speed * 1024 * 1024) : null;
          setProgressMap((current) => ({ ...current, [file.name]: { sentBytes, totalBytes: file.size, speedMbps: speed, etaSeconds, completed: sentBytes >= file.size } }));
        }
        await session.sendJson(JSON.stringify({ type: "file-end", name: file.name }));
      }
      updateSharedState("completed", "All files sent.", true);
      setTransfering(false);
    } catch (error) {
      setTransfering(false);
      setErrorMessage(error instanceof Error ? error.message : "Transfer failed.");
      updateSharedState("error", error instanceof Error ? error.message : "Transfer failed.", session.isSecure());
    }
  };

  const beginShare = async () => {
    if (files.length === 0) return;
    setProgressMap(Object.fromEntries(files.map((file) => [file.name, { sentBytes: 0, totalBytes: file.size, speedMbps: 0, etaSeconds: null, completed: false }])));
    const nextRoomCode = generateRoomCode();
    setRoomCode(nextRoomCode);
    setTransfering(true);
    setErrorMessage(null);
    shouldSendOnSecureRef.current = true;
    connectionReadyRef.current = false;
    const session = ensureSession();
    await session.createSender(nextRoomCode);
  };

  const onPickFiles = (nextFiles: FileList | null) => {
    if (!nextFiles) return;
    setFiles(Array.from(nextFiles));
    setRoomCode("");
    setProgressMap({});
  };

  return (
    <div className="rounded-xl border border-white/10 bg-gray-900/50 p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="inline-flex items-center gap-2 text-lg font-medium text-white">
          <svg className="h-5 w-5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          Send files
        </h2>
        <button type="button" onClick={() => fileInputRef.current?.click()} className="inline-flex items-center gap-1 text-sm text-sky-400 hover:text-sky-300">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Browse
        </button>
      </div>

      <div
        onDrop={(e) => { e.preventDefault(); setDragging(false); onPickFiles(e.dataTransfer.files); }}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onClick={() => fileInputRef.current?.click()}
        className={`flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center transition ${
          dragging ? "border-sky-500 bg-sky-500/10" : "border-white/10 hover:border-white/20"
        }`}
      >
        <svg className={`h-10 w-10 mb-3 ${dragging ? "text-sky-400" : "text-gray-500"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        <p className="text-gray-400">{dragging ? "Drop files here" : "Drop files or click to browse"}</p>
        <p className="mt-1 text-xs text-gray-500">Files stream directly, never hit a server</p>
      </div>

      <input ref={fileInputRef} className="hidden" type="file" multiple onChange={(e) => onPickFiles(e.target.files)} />

      <div className="mt-4 space-y-2">
        {files.map((file) => {
          const progress = progressMap[file.name];
          const percent = progress ? (progress.sentBytes / Math.max(progress.totalBytes, 1)) * 100 : 0;
          return (
            <div key={`${file.name}-${file.size}`} className="flex items-center gap-3 rounded-lg border border-white/5 bg-black/30 p-3">
              <svg className="h-5 w-5 shrink-0 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-white">{file.name}</p>
                <p className="text-xs text-gray-500">{formatBytes(file.size)}</p>
              </div>
              {progress && (
                <div className="text-right">
                  <p className="text-xs text-sky-400">{progress.speedMbps.toFixed(1)} MB/s</p>
                  <p className="text-xs text-gray-500">{formatEta(progress.etaSeconds)}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {files.length > 0 && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => void beginShare()}
            disabled={files.length === 0 || transfering}
            className="inline-flex items-center justify-center gap-2 w-full rounded-lg bg-sky-500 py-3 text-sm font-medium text-white transition hover:bg-sky-600 disabled:opacity-50"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            {transfering ? "Preparing…" : "Share"}
          </button>
        </div>
      )}

      {errorMessage && <p className="mt-3 text-sm text-red-400">{errorMessage}</p>}

      {shareUrl && (
        <div className="mt-6 flex flex-col items-center gap-4 rounded-lg border border-white/10 bg-black/30 p-4">
          <QRCode value={shareUrl} />
          <div className="text-center">
            <p className="font-mono text-lg font-bold tracking-widest text-white">{roomCode}</p>
            <p className="mt-1 text-xs text-gray-500">Share code or scan QR</p>
          </div>
        </div>
      )}
    </div>
  );
}
