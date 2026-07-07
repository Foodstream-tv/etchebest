"use client";

import { useState } from "react";
import { User } from "@/lib/api";

const DURATIONS = [
  { label: "1 hour", hours: 1 },
  { label: "6 hours", hours: 6 },
  { label: "24 hours", hours: 24 },
  { label: "3 days", hours: 72 },
  { label: "7 days", hours: 168 },
  { label: "30 days", hours: 720 },
];

export default function BanModal({
  user,
  permanent,
  onClose,
  onConfirm,
}: {
  user: User;
  permanent: boolean;
  onClose: () => void;
  onConfirm: (reason: string, durationHours: number) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [durationHours, setDurationHours] = useState(24);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleConfirm() {
    setSubmitting(true);
    setError("");
    try {
      await onConfirm(reason, permanent ? 0 : durationHours);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to ban user");
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h2 className="font-semibold text-lg mb-1">
          {permanent ? "Ban permanently" : "Ban temporarily"}
        </h2>
        <p className="text-gray-400 text-sm mb-5">
          {permanent ? (
            <>
              <span className="font-medium text-gray-300">@{user.username}</span> will be
              banned until an admin lifts the ban.
            </>
          ) : (
            <>
              <span className="font-medium text-gray-300">@{user.username}</span> will be
              banned for the selected duration, then automatically unbanned.
            </>
          )}
        </p>

        {!permanent && (
          <div className="flex flex-col gap-1.5 mb-4">
            <label className="text-sm text-gray-400" htmlFor="ban-duration">
              Duration
            </label>
            <select
              id="ban-duration"
              value={durationHours}
              onChange={(e) => setDurationHours(Number(e.target.value))}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-indigo-500 transition"
            >
              {DURATIONS.map((d) => (
                <option key={d.hours} value={d.hours}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex flex-col gap-1.5 mb-5">
          <label className="text-sm text-gray-400" htmlFor="ban-reason">
            Reason <span className="text-gray-600">(optional)</span>
          </label>
          <textarea
            id="ban-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Shown to the user when they try to sign in"
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-indigo-500 transition resize-none"
          />
        </div>

        {error && (
          <p className="text-red-400 text-sm bg-red-950/40 border border-red-800/50 rounded-lg px-3 py-2 mb-4">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={submitting}
            className="text-sm text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 px-4 py-2 rounded-lg transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={submitting}
            className="bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg px-4 py-2 text-sm font-medium transition"
          >
            {submitting ? "Banning…" : permanent ? "Ban permanently" : "Ban user"}
          </button>
        </div>
      </div>
    </div>
  );
}
