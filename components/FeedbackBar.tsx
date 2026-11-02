"use client";

import { useState } from "react";

export interface Feedback {
  rating: 1 | -1 | null;
  comment: string;
}

export function FeedbackBar({ generationId, initial }: { generationId: string; initial?: Feedback }) {
  const [rating, setRating] = useState<Feedback["rating"]>(initial?.rating ?? null);
  const [comment, setComment] = useState(initial?.comment ?? "");
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function save(nextRating: Feedback["rating"], nextComment = comment) {
    setState("saving");
    const res = await fetch(`/api/generations/${generationId}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating: nextRating, comment: nextComment }),
    }).catch(() => null);
    setState(res?.ok ? "saved" : "error");
  }

  const btn = (value: 1 | -1, label: string, emoji: string) => (
    <button
      type="button"
      aria-pressed={rating === value}
      aria-label={label}
      onClick={() => {
        const next = rating === value ? null : value;
        setRating(next);
        save(next);
      }}
      className={`rounded border px-3 py-1 text-sm ${rating === value ? "border-slate-900 bg-slate-100 dark:border-white dark:bg-slate-800" : ""}`}
    >
      {emoji}
    </button>
  );

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm print:hidden">
      <span className="text-slate-600 dark:text-slate-300">Was this useful?</span>
      {btn(1, "Useful", "👍")}
      {btn(-1, "Not useful", "👎")}
      {rating !== null && (
        <form
          className="flex flex-1 gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            save(rating);
          }}
        >
          <input
            className="flex-1 rounded border px-2 py-1 text-sm dark:bg-slate-900"
            maxLength={2000}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={rating === 1 ? "What worked well? (optional)" : "What should be better? (optional)"}
            aria-label="Feedback comment"
          />
          <button className="rounded border px-3 py-1 text-sm">Save</button>
        </form>
      )}
      <span className="text-xs text-slate-500" role="status">
        {state === "saving" ? "Saving…" : state === "saved" ? "Thanks, saved." : state === "error" ? "Couldn't save feedback." : ""}
      </span>
    </div>
  );
}
