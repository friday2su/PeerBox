"use client";

import { QRCodeSVG } from "qrcode.react";

type QRCodeProps = { value: string; };

export default function QRCode({ value }: QRCodeProps) {
  return (
    <div className="rounded-xl border border-white/10 bg-white p-3">
      <QRCodeSVG value={value} size={120} bgColor="#ffffff" fgColor="#111114" level="M" />
    </div>
  );
}
