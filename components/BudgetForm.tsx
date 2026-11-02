"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function BudgetForm({ budgetUsd }: { budgetUsd: number | null }) {
  const router = useRouter();
  const [value, setValue] = useState(budgetUsd === null ? "" : String(budgetUsd));
  const [msg, setMsg] = useState("");
  return (
    <form
      className="flex flex-wrap items-center gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const monthlyBudgetUsd = value.trim() === "" ? null : Number(value);
        const res = await fetch("/api/budget", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ monthlyBudgetUsd }) });
        const data = await res.json().catch(() => ({}));
        setMsg(res.ok ? "Saved." : data.error ?? "Couldn't save.");
        if (res.ok) router.refresh();
      }}
    >
      <label className="font-bold">
        Monthly budget (US$){" "}
        <input
          type="number"
          min={0}
          step="0.5"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="No limit"
          className="field ml-2 inline-block w-32"
        />
      </label>
      <button className="btn-outline">Save</button>
      <span className="text-sm text-ink-muted" role="status">{msg}</span>
    </form>
  );
}
