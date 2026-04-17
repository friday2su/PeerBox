import type { Metadata } from "next";
import { Inter } from "next/font/google";

import "./globals.css";

const inter = Inter({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "PeerBox | P2P File Transfer",
  description: "Encrypted peer-to-peer file transfer in your browser.",
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'><path fill='%230ea5e9' d='M19 21H5v-2h14zM5 19H3v-4h2zm16 0h-2v-4h2zM13 5h2v2h2v2h-4v8h-2V9H7V7h2V5h2V3h2z'/></svg>",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.className}>
      <body>{children}</body>
    </html>
  );
}
