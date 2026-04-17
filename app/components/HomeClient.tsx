"use client";

import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import ReceivePanel from "@/app/components/ReceivePanel";
import SendPanel from "@/app/components/SendPanel";
import { ConnectionState } from "@/lib/peer";

type ViewMode = "send" | "receive";

export default function HomeClient() {
  const searchParams = useSearchParams();
  const roomFromUrl = searchParams.get("room");
  const roomCode = useMemo(() => roomFromUrl?.toUpperCase() ?? null, [roomFromUrl]);
  const [mode, setMode] = useState<ViewMode>(roomCode ? "receive" : "send");
  const [, setStatus] = useState<{
    connectionState: ConnectionState;
    statusMessage: string;
    encrypted: boolean;
  }>({
    connectionState: roomCode ? "waiting" : "idle",
    statusMessage: roomCode ? `Ready to join room ${roomCode}.` : "Select a mode to start.",
    encrypted: false,
  });

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8 sm:px-6" style={{ background: '#0a0a0f' }}>
      <div className="w-full max-w-2xl">
        <header className="mb-8 text-center">
          <div className="mb-3 inline-flex items-center justify-center">
            <svg width="48" height="48" viewBox="0 0 24 24" className="text-sky-400">
              <path fill="currentColor" d="M19 21H5v-2h14zM5 19H3v-4h2zm16 0h-2v-4h2zM13 5h2v2h2v2h-4v8h-2V9H7V7h2V5h2V3h2z"/>
            </svg>
          </div>
          <h1 className="text-3xl font-semibold text-white">PeerBox</h1>
          <p className="mt-2 text-gray-400">Encrypted P2P file transfer</p>
        </header>

        <div className="mb-6 flex justify-center gap-2">
          {(["send", "receive"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              className={`inline-flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-medium transition ${
                mode === value
                  ? "bg-sky-500 text-white"
                  : "bg-white/5 text-gray-400 hover:text-white"
              }`}
            >
              {value === "send" ? (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              )}
              {value}
            </button>
          ))}
        </div>

        {mode === "send" ? (
          <SendPanel onStateChange={setStatus} />
        ) : (
          <ReceivePanel initialRoomCode={roomCode} onStateChange={setStatus} />
        )}
      </div>
    </main>
  );
}
