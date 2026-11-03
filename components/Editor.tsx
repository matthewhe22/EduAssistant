"use client";

/**
 * A form for editing one part of generated content by hand. It is built from the output's
 * zod schema, so it works for every output type: text becomes a text box, lists can be added
 * to, removed from and reordered, numbers get a number box and fixed choices a dropdown.
 */
import { useEffect, useRef, useState } from "react";
import { defOf, emptyValue, fieldLabel, HIDDEN, optionsOf, renumber, shapeOf, SINGULAR, type Json, type Schema } from "@/lib/ui/editor-schema";
import { Icon, ICONS } from "./Icon";

const rowsFor = (text: string) => Math.min(10, Math.max(1, Math.ceil(text.length / 70) + (text.match(/\n/g)?.length ?? 0)));

function SmallButton({ label, icon, onClick, disabled }: { label: string; icon: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-white text-ink-soft hover:bg-mist disabled:opacity-30"
    >
      <Icon d={icon} size={16} />
    </button>
  );
}

function ItemTools({ i, n, onMove, onRemove, what }: { i: number; n: number; onMove: (to: number) => void; onRemove: () => void; what: string }) {
  return (
    <span className="flex gap-1">
      <SmallButton label={`Move ${what} up`} icon={ICONS.arrowUp} disabled={i === 0} onClick={() => onMove(i - 1)} />
      <SmallButton label={`Move ${what} down`} icon={ICONS.arrowDown} disabled={i === n - 1} onClick={() => onMove(i + 1)} />
      <SmallButton label={`Remove ${what}`} icon={ICONS.trash} onClick={onRemove} />
    </span>
  );
}

function Field({ schema, value, onChange, name, label }: { schema: Schema; value: Json; onChange: (v: Json) => void; name: string; label: string }) {
  const d = defOf(schema);

  if (d.type === "string") {
    const text = typeof value === "string" ? value : "";
    return (
      <textarea
        aria-label={label}
        rows={rowsFor(text)}
        value={text}
        onChange={(e) => onChange(e.target.value)}
        className="field min-h-[44px] w-full resize-y py-2.5 font-normal leading-normal [field-sizing:content]"
      />
    );
  }
  if (d.type === "number") {
    return (
      <input
        type="number"
        aria-label={label}
        value={Number(value) || 0}
        min={0}
        onChange={(e) => onChange(Math.max(0, Math.round(Number(e.target.value) || 0)))}
        className="field w-24 text-center font-normal"
      />
    );
  }
  if (d.type === "enum") {
    return (
      <select aria-label={label} value={String(value)} onChange={(e) => onChange(e.target.value)} className="field font-normal">
        {optionsOf(schema).map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    );
  }
  if (d.type === "array" && d.element) {
    const items = Array.isArray(value) ? value : [];
    const el = d.element;
    const isObject = defOf(el).type === "object";
    const what = SINGULAR[name] ?? "item";
    const set = (next: Json[]) => onChange(renumber(next));
    const move = (from: number, to: number) => {
      const next = [...items];
      const [x] = next.splice(from, 1);
      next.splice(to, 0, x);
      set(next);
    };
    return (
      <div className="flex flex-col gap-2">
        {items.map((item, i) =>
          isObject ? (
            <div key={i} className="flex flex-col gap-3 rounded-xl border border-line bg-white p-3.5">
              <div className="flex items-center justify-between gap-2">
                <p className="eyebrow m-0 text-ink-muted">
                  {what.charAt(0).toUpperCase() + what.slice(1)} {i + 1}
                </p>
                <ItemTools i={i} n={items.length} what={`${what} ${i + 1}`} onMove={(to) => move(i, to)} onRemove={() => set(items.filter((_, j) => j !== i))} />
              </div>
              <ObjectFields
                schema={el}
                value={item}
                label={`${label}, ${what} ${i + 1}`}
                onChange={(v) => set(items.map((x, j) => (j === i ? v : x)))}
              />
            </div>
          ) : (
            <div key={i} className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <Field schema={el} value={item} name={name} label={`${label}, ${what} ${i + 1}`} onChange={(v) => set(items.map((x, j) => (j === i ? v : x)))} />
              </div>
              <ItemTools i={i} n={items.length} what={`${what} ${i + 1}`} onMove={(to) => move(i, to)} onRemove={() => set(items.filter((_, j) => j !== i))} />
            </div>
          ),
        )}
        <button
          type="button"
          onClick={() => set([...items, emptyValue(el)])}
          className="inline-flex min-h-[40px] items-center gap-1.5 self-start rounded-[10px] border border-dashed border-line-strong px-3 text-sm font-bold text-euc-dark hover:bg-euc-tint"
        >
          <Icon d={ICONS.plus} size={16} />
          Add {what}
        </button>
      </div>
    );
  }
  if (d.type === "object") return <ObjectFields schema={schema} value={value} onChange={onChange} label={label} />;
  return null;
}

function ObjectFields({ schema, value, onChange, label }: { schema: Schema; value: Json; onChange: (v: Json) => void; label: string }) {
  const obj = value && typeof value === "object" ? (value as Record<string, Json>) : {};
  return (
    <div className="flex flex-col gap-3">
      {Object.entries(shapeOf(schema))
        .filter(([k]) => !HIDDEN.has(k))
        .map(([k, s]) => {
          const t = defOf(s).type;
          const inline = t === "number" || t === "enum";
          return (
            <div key={k} className={inline ? "flex flex-wrap items-center gap-3" : "flex flex-col gap-1.5"}>
              <span className="text-[15px] font-bold">{fieldLabel(k)}</span>
              <Field schema={s} value={obj[k]} name={k} label={label === fieldLabel(k) ? label : `${label}: ${fieldLabel(k)}`} onChange={(v) => onChange({ ...obj, [k]: v })} />
            </div>
          );
        })}
    </div>
  );
}

/** Edit form for one part of the content. `schema` and `value` are that part only. */
export function SectionEditor({
  schema,
  value,
  name,
  label,
  saving,
  onSave,
  onCancel,
}: {
  schema: Schema;
  value: Json;
  name: string;
  label: string;
  saving?: boolean;
  onSave: (value: Json) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<Json>(() => structuredClone(value));
  const changed = JSON.stringify(draft) !== JSON.stringify(value);
  const formRef = useRef<HTMLFormElement | null>(null);
  useEffect(() => {
    formRef.current?.querySelector<HTMLElement>("textarea, input, select")?.focus({ preventScroll: true });
  }, []);
  return (
    <form
      ref={formRef}
      onSubmit={(e) => {
        e.preventDefault();
        onSave(draft);
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onCancel();
      }}
      className="flex flex-col gap-3.5 rounded-xl border-2 border-wattle bg-paper p-4 print:hidden"
      aria-label={`Edit ${label.toLowerCase()}`}
    >
      <p className="eyebrow m-0 text-[#8A5A00]">Editing: {label}</p>
      <Field schema={schema} value={draft} onChange={setDraft} name={name} label={label} />
      <div className="flex flex-wrap items-center justify-end gap-2.5">
        <button type="button" className="btn text-ink-soft" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={!changed || saving}>
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
