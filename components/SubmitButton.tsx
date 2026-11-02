"use client";

import { useFormStatus } from "react-dom";

/** A form submit button that disables itself while the form is submitting (prevents double submits). */
export function SubmitButton({
  children,
  pendingText,
  formAction,
  className,
}: {
  children: React.ReactNode;
  pendingText: string;
  formAction: (formData: FormData) => void | Promise<void>;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button formAction={formAction} disabled={pending} aria-disabled={pending} className={`${className ?? ""} disabled:cursor-wait disabled:opacity-60`}>
      {pending ? pendingText : children}
    </button>
  );
}
