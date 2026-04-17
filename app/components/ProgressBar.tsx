"use client";

type ProgressBarProps = { value: number; label?: string; sublabel?: string; };

export default function ProgressBar({ value, label, sublabel }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));
  const isComplete = clamped >= 100;

  return (
    <div className="space-y-1 mt-2">
      {(label || sublabel) && (
        <div className="flex justify-between text-xs">
          <span className="text-gray-400">{label}</span>
          <span className={isComplete ? "text-emerald-400" : "text-gray-500"}>{sublabel ?? `${clamped.toFixed(0)}%`}</span>
        </div>
      )}
      <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
        <div
          className={`h-full rounded-full transition-all duration-300 ${isComplete ? "bg-emerald-500" : "bg-sky-500"}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
