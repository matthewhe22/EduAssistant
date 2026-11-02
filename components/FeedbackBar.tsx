"use client";

import { useState } from "react";
import { Icon, ICONS } from "./Icon";

export interface Feedback {
  rating: 1 | -1 | null;
  comment: string;
}

export function FeedbackBar({ generationId, initial }: { generationId: string; initial?: Feedback }) {
  const [rating, setRating] = useState<Feedback["rating"]>(initial?.rating ?? null);
  const [comment, setComment] = useState(initial?.comment ?? "");
  const [askComment, setAskComment] = useState(false);
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

  const btn = (value: 1 | -1, label: string, d: string) => {
    const on = rating === value;
    return (
      <button
        type="button"
        aria-pressed={on}
        aria-label={label}
        onClick={() => {
          const next = on ? null : value;
          setRating(next);
          setAskComment(next !== null);
          save(next);
        }}
        className={`inline-flex h-11 w-11 items-center justify-center rounded-[10px] ${on ? "border-2 border-euc bg-euc-tint text-euc" : "border border-line-strong bg-white text-ink-soft hover:bg-mist"}`}
      >
        <Icon d={d} size={20} />
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="inline-flex items-center gap-1 text-sm text-ink-soft">
        Useful?
        {btn(1, "Mark as useful", ICONS.up)}
        {btn(-1, "Mark as not useful", ICONS.down)}
        <span className="ml-1 text-xs text-ink-muted" role="status">
          {state === "saving" ? "Saving…" : state === "saved" ? "Thanks" : state === "error" ? "Couldn't save" : ""}
        </span>
      </span>
      {askComment && rating !== null && (
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            save(rating);
            setAskComment(false);
          }}
        >
          <input
            className="field min-h-[40px] flex-1 text-[15px]"
            maxLength={2000}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={rating === 1 ? "What worked well? (optional)" : "What should be better? (optional)"}
            aria-label="Feedback comment"
          />
          <button className="btn-outline min-h-[40px] text-sm">Send</button>
        </form>
      )}
    </div>
  );
}
