"use client";

import { useEffect, useRef, useState } from "react";

import ProgressBar from "@/app/components/ProgressBar";
import { ConnectionState, PeerSession } from "@/lib/peer";
import { FileEndMessage, FileHeader, assembleFile, downloadBlob } from "@/lib/transfer";

type ReceiveProgress = { receivedBytes: number; totalBytes: number; speedMbps: number; etaSeconds: number | null; completed: boolean };

type ReceivePanelProps = {
  initialRoomCode?: string | null;
  onStateChange: (state: { connectionState: ConnectionState; statusMessage: string; encrypted: boolean }) => void;
};

type IncomingFile = { header: FileHeader; chunks: ArrayBuffer[]; receivedBytes: number; startedAt: number };

function formatEta(seconds: number | null) {
  if (seconds === null || !Number.isFinite(seconds)) return "—";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
}

export default function ReceivePanel({ initialRoomCode, onStateChange }: ReceivePanelProps) {
  const [roomCode, setRoomCode] = useState(initialRoomCode ?? "");
  const [inputCode, setInputCode] = useState(initialRoomCode ?? "");
  const [isJoining, setIsJoining] = useState(false);
  const [progressMap, setProgressMap] = useState<Record<string, ReceiveProgress>>({});
  const [completeFiles, setCompleteFiles] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const sessionRef = useRef<PeerSession | null>(null);
  const incomingFileRef = useRef<IncomingFile | null>(null);

  useEffect(() => {
    onStateChange({ connectionState: roomCode ? "connecting" : "idle", statusMessage: roomCode ? "Ready to connect." : "Enter room code.", encrypted: false });
  }, [onStateChange, roomCode]);

  useEffect(() => {
    return () => sessionRef.current?.destroy();
  }, []);

  useEffect(() => {
    if (initialRoomCode) void joinRoom(initialRoomCode);
  }, [initialRoomCode]);

  const updateSharedState = (connectionState: ConnectionState, statusMessage: string, encrypted: boolean) => {
    onStateChange({ connectionState, statusMessage, encrypted });
  };

  const setupSession = () => {
    sessionRef.current?.destroy();
    const session = new PeerSession("receiver", {
      onStateChange: (state) => updateSharedState(state, "Connecting…", session.isSecure()),
      onStatus: (message) => updateSharedState(session.isSecure() ? "encrypted" : "connecting", message, session.isSecure()),
      onEncryptedChange: (encrypted) => updateSharedState(encrypted ? "encrypted" : "connected", encrypted ? "Secure." : "Securing…", encrypted),
      onError: (message) => { setIsJoining(false); setErrorMessage(message); updateSharedState("error", message, false); },
      onOpen: () => { setIsJoining(false); setErrorMessage(null); updateSharedState("connected", "Connected. Waiting…", false); },
      onTransport: (payload) => { if (payload.kind === "json") void handleControlMessage(payload.text); else void handleChunk(payload.buffer); },
    });
    sessionRef.current = session;
    return session;
  };

  const joinRoom = async (code: string) => {
    const normalized = code.trim().toUpperCase();
    if (!normalized) return;
    setRoomCode(normalized);
    setInputCode(normalized);
    setIsJoining(true);
    setErrorMessage(null);
    setCompleteFiles([]);
    incomingFileRef.current = null;
    setProgressMap({});
    const session = setupSession();
    await session.createReceiver(normalized);
    updateSharedState("waiting", "Waiting for sender…", false);
  };

  const handleControlMessage = async (text: string) => {
    const message = JSON.parse(text) as FileHeader | FileEndMessage;
    if (message.type === "file-start") {
      incomingFileRef.current = { header: message, chunks: [], receivedBytes: 0, startedAt: performance.now() };
      setProgressMap((current) => ({ ...current, [message.name]: { receivedBytes: 0, totalBytes: message.size, speedMbps: 0, etaSeconds: null, completed: false } }));
      updateSharedState("transferring", `Receiving ${message.name}…`, true);
      return;
    }
    if (message.type === "file-end" && incomingFileRef.current) {
      const currentFile = incomingFileRef.current;
      const blob = assembleFile(currentFile.chunks, currentFile.header.mime);
      downloadBlob(blob, currentFile.header.name);
      setCompleteFiles((current) => [...current, currentFile.header.name]);
      setProgressMap((current) => ({ ...current, [currentFile.header.name]: { ...current[currentFile.header.name], completed: true, receivedBytes: currentFile.header.size, totalBytes: currentFile.header.size, etaSeconds: 0 } }));
      updateSharedState("completed", `${currentFile.header.name} downloaded.`, true);
      incomingFileRef.current = null;
    }
  };

  const handleChunk = async (buffer: ArrayBuffer) => {
    const currentFile = incomingFileRef.current;
    if (!currentFile) return;
    currentFile.chunks.push(buffer);
    currentFile.receivedBytes += buffer.byteLength;
    const elapsedSeconds = Math.max((performance.now() - currentFile.startedAt) / 1000, 0.001);
    const speed = currentFile.receivedBytes / elapsedSeconds / (1024 * 1024);
    const remaining = currentFile.header.size - currentFile.receivedBytes;
    const etaSeconds = speed > 0 ? remaining / (speed * 1024 * 1024) : null;
    setProgressMap((current) => ({ ...current, [currentFile.header.name]: { receivedBytes: currentFile.receivedBytes, totalBytes: currentFile.header.size, speedMbps: speed, etaSeconds, completed: false } }));
  };

  return (
    <div className="rounded-xl border border-white/10 bg-gray-900/50 p-6">
      <h2 className="mb-4 inline-flex items-center gap-2 text-lg font-medium text-white">
        <svg className="h-5 w-5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        Receive files
      </h2>

      <form onSubmit={(e) => { e.preventDefault(); void joinRoom(inputCode); }} className="flex gap-2">
        <input
          value={inputCode}
          onChange={(e) => setInputCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
          placeholder="ABC123"
          className="flex-1 rounded-lg border border-white/10 bg-black/30 px-4 py-3 font-mono text-lg tracking-widest text-white placeholder:text-gray-600 focus:border-sky-500 focus:outline-none"
        />
        <button type="submit" disabled={inputCode.length !== 6 || isJoining} className="inline-flex items-center gap-2 rounded-lg bg-sky-500 px-6 py-3 text-sm font-medium text-white transition hover:bg-sky-600 disabled:opacity-50">
          {isJoining ? (
            <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          ) : (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
            </svg>
          )}
          Join
        </button>
      </form>

      {errorMessage && <p className="mt-3 text-sm text-red-400">{errorMessage}</p>}

      <div className="mt-4 space-y-2">
        {Object.entries(progressMap).map(([fileName, progress]) => {
          const percent = (progress.receivedBytes / Math.max(progress.totalBytes, 1)) * 100;
          const isComplete = completeFiles.includes(fileName);
          return (
            <div key={fileName} className="rounded-lg border border-white/5 bg-black/30 p-3">
              <div className="flex items-center gap-3">
                <svg className={`h-5 w-5 shrink-0 ${isComplete ? "text-emerald-400" : "text-sky-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  {isComplete ? (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  )}
                </svg>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-white">{fileName}</p>
                  {!isComplete && (
                    <p className="text-xs text-sky-400">{progress.speedMbps.toFixed(1)} MB/s · {formatEta(progress.etaSeconds)}</p>
                  )}
                </div>
                {isComplete && <span className="text-xs text-emerald-400">Done</span>}
              </div>
              {!isComplete && <ProgressBar value={percent} sublabel={`${percent.toFixed(0)}%`} />}
            </div>
          );
        })}
        {Object.keys(progressMap).length === 0 && (
          <div className="py-8 text-center">
            <svg className="mx-auto h-10 w-10 text-gray-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <p className="text-sm text-gray-500">
              {roomCode ? `Waiting in room ${roomCode}…` : "Enter a room code above"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
