"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function BudgetForm({ budgetUsd }: { budgetUsd: number | null }) {
  const router = useRouter();
  const [value, setValue] = useState(budgetUsd === null ? "" : String(budgetUsd));
  const [msg, setMsg] = useState("");
  return (
    <form
      className="flex flex-wrap items-center gap-2 text-sm"
      onSubmit={async (e) => {
        e.preventDefault();
        const monthlyBudgetUsd = value.trim() === "" ? null : Number(value);
        const res = await fetch("/api/budget", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ monthlyBudgetUsd }) });
        const data = await res.json().catch(() => ({}));
        setMsg(res.ok ? "Saved." : data.error ?? "Couldn't save.");
        if (res.ok) router.refresh();
      }}
    >
      <label>
        Monthly budget (US$){" "}
        <input
          type="number"
          min={0}
          step="0.5"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="No limit"
          className="w-28 rounded border px-2 py-1 dark:bg-slate-900"
        />
      </label>
      <button className="rounded border px-3 py-1">Save</button>
      <span className="text-xs text-slate-500" role="status">{msg}</span>
    </form>
  );
}
