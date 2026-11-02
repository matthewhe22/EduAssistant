"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DeleteButton({ url, label, confirmText, redirectTo }: { url: string; label: string; confirmText: string; redirectTo?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      className="min-h-[40px] rounded-lg px-2 text-[15px] font-bold text-alert underline underline-offset-[3px] hover:bg-alert-tint disabled:opacity-50"
      onClick={async () => {
        if (!window.confirm(confirmText)) return;
        setBusy(true);
        const res = await fetch(url, { method: "DELETE" }).catch(() => null);
        setBusy(false);
        if (!res?.ok) {
          alert("Sorry, that couldn't be deleted.");
          return;
        }
        if (redirectTo) router.push(redirectTo);
        router.refresh();
      }}
    >
      {busy ? "Deleting…" : label}
    </button>
  );
}
