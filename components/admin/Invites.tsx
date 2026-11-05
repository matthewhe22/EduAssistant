"use client";

import { useEffect, useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import type { InviteResult } from "@/app/admin/actions";

type Action = (prev: InviteResult | null, formData: FormData) => Promise<InviteResult>;

function Submit({ children, pending: pendingText, className }: { children: React.ReactNode; pending: string; className: string }) {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} aria-disabled={pending} className={`${className} disabled:cursor-wait disabled:opacity-60`}>
      {pending ? pendingText : children}
    </button>
  );
}

function CopyLink({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <input readOnly value={link} aria-label="Invitation link" className="field min-w-0 flex-1 font-normal" onFocus={(e) => e.currentTarget.select()} />
      <button
        type="button"
        className="btn-outline"
        onClick={async () => {
          await navigator.clipboard?.writeText(link).catch(() => {});
          setCopied(true);
        }}
      >
        {copied ? "Copied" : "Copy link"}
      </button>
    </div>
  );
}

function Result({ state }: { state: InviteResult | null }) {
  if (!state) return null;
  return (
    <div role={state.ok ? "status" : "alert"} className={`rounded-xl px-4 py-3 text-[15px] ${state.ok ? "bg-euc-tint text-euc-dark" : "bg-alert-tint text-alert"}`}>
      {state.message}
      {state.link && <CopyLink link={state.link} />}
    </div>
  );
}

/** Invite someone by email: they get a link that lets that address create an account. */
export function InviteForm({ action, emailReady }: { action: Action; emailReady: boolean }) {
  const [state, formAction] = useFormState(action, null);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) form.current?.reset();
  }, [state]);
  return (
    <form ref={form} action={formAction} className="card flex flex-col gap-4 p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="label">Email
          <input name="email" type="email" required autoComplete="off" className="field font-normal" placeholder="teacher@school.vic.edu.au" />
        </label>
        <label className="label"><span>Name <span className="font-normal text-ink-muted">(optional)</span></span>
          <input name="name" autoComplete="off" maxLength={100} className="field font-normal" />
        </label>
      </div>
      <label className="label"><span>Personal note <span className="font-normal text-ink-muted">(optional, added to the email)</span></span>
        <textarea name="message" rows={3} maxLength={1000} className="field py-2.5 font-normal" />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <Submit pending="Sending…" className="btn-primary">{emailReady ? "Send invitation" : "Create invitation link"}</Submit>
        {!emailReady && <span className="text-sm text-ink-muted">Email isn&apos;t set up, so you&apos;ll get a link to send yourself.</span>}
      </div>
      <Result state={state} />
    </form>
  );
}

/** "Send again" for one invitation, with a fresh link. */
export function ResendButton({ action, id }: { action: Action; id: string }) {
  const [state, formAction] = useFormState(action, null);
  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="id" value={id} />
      <Submit pending="Sending…" className="min-h-[40px] rounded-lg px-2 text-[15px] font-bold text-euc underline underline-offset-[3px] hover:bg-euc-tint">
        Send again
      </Submit>
      {state && <div className="mt-2 max-w-[420px]"><Result state={state} /></div>}
    </form>
  );
}

export function WithdrawButton({ action, id, email }: { action: (formData: FormData) => Promise<void>; id: string; email: string }) {
  return (
    <form
      action={action}
      className="inline"
      onSubmit={(e) => {
        if (!window.confirm(`Withdraw the invitation for ${email}? The link will stop working.`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <Submit pending="Withdrawing…" className="min-h-[40px] rounded-lg px-2 text-[15px] font-bold text-alert underline underline-offset-[3px] hover:bg-alert-tint">
        Withdraw
      </Submit>
    </form>
  );
}
