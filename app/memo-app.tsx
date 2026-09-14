"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, Check, ChevronDown, Clock3, Link2, Mail, MessageCircleMore, Pencil, Plus, RotateCcw, StickyNote } from "lucide-react";
import { toast } from "sonner";
import MemoShell from "./memo-shell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatDue, isoToLocalInput, parseReminder } from "@/lib/reminder-parser";

type Reminder = {
  id: number; title: string; dueAt: string; timezone: string; notes: string; link: string;
  emailNotify: boolean; phoneNotify: boolean; status: "scheduled" | "done";
};

type Details = { notes: string; link: string; emailNotify: boolean; phoneNotify: boolean };
const emptyDetails: Details = { notes: "", link: "", emailNotify: false, phoneNotify: false };

declare global {
  interface Document { modelContext?: { registerTool: (tool: Record<string, unknown>, options?: { signal?: AbortSignal }) => void | Promise<void> } }
}

function DeliveryChoices({ value, onChange }: { value: Details; onChange: (next: Details) => void }) {
  return <div className="grid gap-3 sm:grid-cols-2">
    <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 p-3">
      <Checkbox checked={value.emailNotify} onCheckedChange={(checked) => onChange({ ...value, emailNotify: checked === true })} className="mt-0.5" />
      <span><span className="flex items-center gap-2 text-sm font-semibold"><Mail className="size-4 text-slate-500" /> Email</span><span className="mt-1 block text-xs text-slate-500">Optional second reminder, coming next</span></span>
    </label>
    <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 p-3">
      <Checkbox checked={value.phoneNotify} onCheckedChange={(checked) => onChange({ ...value, phoneNotify: checked === true })} className="mt-0.5" />
      <span><span className="flex items-center gap-2 text-sm font-semibold"><Bell className="size-4 text-slate-500" /> Telegram</span><span className="mt-1 block text-xs text-slate-500">Send through your connected bot</span></span>
    </label>
  </div>;
}

export default function MemoApp() {
  const [input, setInput] = useState("");
  const [details, setDetails] = useState<Details>(emptyDetails);
  const [showDetails, setShowDetails] = useState(false);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Reminder | null>(null);
  const [editWhen, setEditWhen] = useState("");
  const timezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);
  const parsed = useMemo(() => parseReminder(input), [input]);

  const loadReminders = useCallback(async () => {
    try {
      const response = await fetch("/api/reminders?view=upcoming", { cache: "no-store" });
      const data = await response.json() as { reminders: Reminder[]; error?: string }; if (!response.ok) throw new Error(data.error);
      setReminders(data.reminders);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not load reminders."); }
    finally { setLoading(false); }
  }, []);

  const createReminder = useCallback(async (requestText: string, extra: Details = emptyDetails) => {
    const result = parseReminder(requestText);
    if (!result) throw new Error("Add a task and time, for example “tomorrow 18:00” or “in 2h”.");
    const response = await fetch("/api/reminders", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ request: requestText, title: result.title, dueAt: result.dueAt.toISOString(), timezone, ...extra }),
    });
    const data = await response.json() as { reminder: Reminder; error?: string }; if (!response.ok) throw new Error(data.error);
    setReminders((current) => [...current, data.reminder].sort((a, b) => a.dueAt.localeCompare(b.dueAt)));
    return data.reminder as Reminder;
  }, [timezone]);

  async function submit() {
    if (!parsed || saving) return; setSaving(true);
    try { await createReminder(input, details); setInput(""); setDetails(emptyDetails); setShowDetails(false); toast.success("Reminder saved"); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Could not save reminder."); }
    finally { setSaving(false); }
  }

  async function complete(id: number) {
    const response = await fetch("/api/reminders", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status: "done" }) });
    if (!response.ok) return toast.error("Could not complete this reminder.");
    setReminders((current) => current.filter((reminder) => reminder.id !== id)); toast.success("Moved to history");
  }

  async function snooze(reminder: Reminder, minutes = 10) {
    const dueAt = new Date(Date.now() + minutes * 60_000).toISOString();
    const response = await fetch("/api/reminders", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...reminder, dueAt, timezone }),
    });
    const data = await response.json() as { reminder: Reminder; error?: string };
    if (!response.ok) return toast.error(data.error ?? "Could not snooze this reminder.");
    setReminders((current) => current.map((item) => item.id === reminder.id ? data.reminder : item).sort((a, b) => a.dueAt.localeCompare(b.dueAt)));
    toast.success(`Snoozed for ${minutes} minutes`);
  }

  function openEditor(reminder: Reminder) { setEditing({ ...reminder }); setEditWhen(isoToLocalInput(reminder.dueAt)); }

  async function saveEdit() {
    if (!editing || !editWhen) return;
    const response = await fetch("/api/reminders", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...editing, dueAt: new Date(editWhen).toISOString(), timezone }),
    });
    const data = await response.json() as { reminder: Reminder; error?: string };
    if (!response.ok) return toast.error(data.error ?? "Could not update reminder.");
    setReminders((current) => current.map((item) => item.id === editing.id ? data.reminder : item).sort((a, b) => a.dueAt.localeCompare(b.dueAt)));
    setEditing(null); toast.success("Reminder updated");
  }

  useEffect(() => { void loadReminders(); }, [loadReminders]);
  useEffect(() => {
    const context = document.modelContext; if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(context.registerTool({
      name: "create_reminder", title: "Create reminder",
      description: "Create a reminder from a natural-language request containing a task and time.",
      inputSchema: { type: "object", properties: { request: { type: "string" } }, required: ["request"], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: async (value: unknown) => {
        const request = (value as { request?: unknown })?.request;
        if (typeof request !== "string" || !request.trim()) throw new Error("request is required");
        const reminder = await createReminder(request); return { id: reminder.id, title: reminder.title, dueAt: reminder.dueAt };
      },
    }, { signal: lifecycle.signal })).catch(() => undefined);
    return () => lifecycle.abort();
  }, [createReminder]);

  return <MemoShell active="upcoming">
    <section className="mt-8 grid gap-8 lg:grid-cols-[1.12fr_.88fr] lg:items-start">
      <div><div className="rounded-[28px] bg-[#101c32] p-5 text-white shadow-[0_28px_80px_rgba(15,28,50,.18)] sm:p-7">
        <div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-full bg-[#ff6b4a]"><MessageCircleMore className="size-4" /></span><div><p className="text-sm font-semibold text-[#ffb09e]">Memo secretary</p><p className="text-xs text-slate-400">Tell me once. I’ll bring it back at the right time.</p></div></div>
        <label htmlFor="memo-input" className="mt-6 block text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">What should I remember?</label>
        <Textarea id="memo-input" value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") void submit(); }} placeholder="Call Marco Friday at 18:00, or check the oven in 45 mins" className="mt-6 min-h-32 resize-none rounded-2xl border-white/15 bg-white/8 px-4 py-4 text-base text-white shadow-none placeholder:text-slate-400 focus-visible:border-[#ff8b70] focus-visible:ring-[#ff8b70]/25" />
        <div className="mt-4 min-h-14 rounded-2xl border border-white/10 bg-white/6 px-4 py-3">{input && !parsed ? <p className="text-sm text-amber-200">I’m missing a task or time. Try 2h, 30 mins, tomorrow 6pm, Friday at 18, or 14/09 at 09:30.</p> : parsed ? <div className="flex items-start gap-3"><span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-emerald-400/15 text-emerald-300"><Check className="size-3.5" /></span><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">I understood</p><p className="mt-1 font-medium">{parsed.title}</p><p className="mt-0.5 text-sm text-slate-300">{formatDue(parsed.dueAt)}</p></div></div> : <p className="text-sm text-slate-400">English and Italian dates, weekdays, and abbreviations work.</p>}</div>
        <button onClick={() => setShowDetails((value) => !value)} className="mt-4 flex w-full items-center justify-between rounded-xl px-1 py-2 text-sm font-semibold text-slate-300 hover:text-white"><span className="flex items-center gap-2"><StickyNote className="size-4" /> Notes, link & notifications</span><ChevronDown className={`size-4 transition ${showDetails ? "rotate-180" : ""}`} /></button>
        {showDetails && <div className="mt-2 space-y-3 rounded-2xl bg-white p-4 text-[#101c32]">
          <Textarea value={details.notes} onChange={(event) => setDetails({ ...details, notes: event.target.value })} placeholder="Optional notes" className="min-h-20 resize-none rounded-xl" />
          <Input value={details.link} onChange={(event) => setDetails({ ...details, link: event.target.value })} placeholder="https://…" type="url" className="h-11 rounded-xl" />
          <DeliveryChoices value={details} onChange={setDetails} />
          {details.emailNotify && <p className="text-xs text-amber-700">Email delivery is not active yet. Telegram reminders are active once the bot is connected.</p>}
        </div>}
        <Button onClick={() => void submit()} disabled={!parsed || saving} className="mt-4 h-12 w-full rounded-2xl bg-[#ff6b4a] text-base text-white hover:bg-[#ff7d61]"><Plus className="size-5" /> {saving ? "Saving…" : "Confirm reminder"}</Button>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">{["Call Marco tomorrow at 18", "Send the document in 2h", "Ricordami la bolletta venerdì alle 20:30", "Check the oven in 45 mins"].map((example) => <button key={example} onClick={() => setInput(example)} className="rounded-full border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-900">{example}</button>)}</div></div>

      <aside className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_20px_60px_rgba(15,28,50,.07)] sm:p-6">
        <div className="flex items-end justify-between"><div><p className="text-sm font-semibold text-[#ef5f40]">Coming up</p><h2 className="mt-1 text-2xl font-bold tracking-[-0.035em]">Your reminders</h2></div><span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">{reminders.length}</span></div>
        <div className="mt-5 space-y-3">{loading ? <p className="py-12 text-center text-sm text-slate-500">Loading reminders…</p> : reminders.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-200 px-5 py-10 text-center"><Clock3 className="mx-auto size-6 text-slate-400" /><p className="mt-3 font-medium">Nothing scheduled</p><p className="mt-1 text-sm text-slate-500">Your next memo will appear here.</p></div> : reminders.map((reminder) => <article key={reminder.id} onClick={() => openEditor(reminder)} className="group flex cursor-pointer gap-3 rounded-2xl border border-slate-200 p-4 transition hover:border-slate-300 hover:shadow-sm">
          <button aria-label={`Complete ${reminder.title}`} onClick={(event) => { event.stopPropagation(); void complete(reminder.id); }} className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border border-slate-300 text-transparent transition hover:border-emerald-500 hover:bg-emerald-500 hover:text-white"><Check className="size-4" /></button>
          <div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><h3 className="font-semibold leading-snug">{reminder.title}</h3><Pencil className="size-4 shrink-0 text-slate-300 group-hover:text-slate-500" /></div><p className="mt-1 text-sm text-slate-500">{formatDue(reminder.dueAt)}</p>
            {(reminder.notes || reminder.link || reminder.emailNotify || reminder.phoneNotify) && <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">{reminder.notes && <span className="flex items-center gap-1"><StickyNote className="size-3" /> Notes</span>}{reminder.link && <a href={reminder.link} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()} className="flex items-center gap-1 hover:text-[#ef5f40]"><Link2 className="size-3" /> Link</a>}{reminder.emailNotify && <span className="flex items-center gap-1"><Mail className="size-3" /> Email</span>}{reminder.phoneNotify && <span className="flex items-center gap-1"><Bell className="size-3" /> Phone</span>}</div>}
            <div className="mt-3 flex gap-2"><button onClick={(event) => { event.stopPropagation(); void snooze(reminder); }} className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-200"><RotateCcw className="size-3" /> Snooze 10m</button><button onClick={(event) => { event.stopPropagation(); openEditor(reminder); }} className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-500 transition hover:bg-slate-100">Edit</button></div>
          </div></article>)}</div>
      </aside>
    </section>

    <Dialog open={Boolean(editing)} onOpenChange={(open) => { if (!open) setEditing(null); }}><DialogContent className="max-h-[90vh] overflow-y-auto rounded-[24px] sm:max-w-xl">
      <DialogHeader><DialogTitle>Edit reminder</DialogTitle><DialogDescription>Change the task, time, details, or delivery choices.</DialogDescription></DialogHeader>
      {editing && <div className="space-y-4">
        <div><label className="mb-1.5 block text-sm font-semibold" htmlFor="edit-title">Task</label><Input id="edit-title" value={editing.title} onChange={(event) => setEditing({ ...editing, title: event.target.value })} className="h-11 rounded-xl" /></div>
        <div><label className="mb-1.5 block text-sm font-semibold" htmlFor="edit-when">When</label><Input id="edit-when" type="datetime-local" value={editWhen} onChange={(event) => setEditWhen(event.target.value)} className="h-11 rounded-xl" /></div>
        <div><label className="mb-1.5 block text-sm font-semibold" htmlFor="edit-notes">Notes</label><Textarea id="edit-notes" value={editing.notes} onChange={(event) => setEditing({ ...editing, notes: event.target.value })} className="min-h-24 resize-none rounded-xl" placeholder="Optional notes" /></div>
        <div><label className="mb-1.5 block text-sm font-semibold" htmlFor="edit-link">Link</label><div className="relative"><Link2 className="absolute left-3 top-3 size-4 text-slate-400" /><Input id="edit-link" type="url" value={editing.link} onChange={(event) => setEditing({ ...editing, link: event.target.value })} className="h-11 rounded-xl pl-9" placeholder="https://…" /></div></div>
        <DeliveryChoices value={editing} onChange={(next) => setEditing({ ...editing, ...next })} />
        {editing.emailNotify && <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">Email delivery is not active yet. Telegram reminders are active once the bot is connected.</p>}
      </div>}
      <DialogFooter><Button variant="outline" onClick={() => setEditing(null)} className="rounded-xl">Cancel</Button><Button onClick={() => void saveEdit()} className="rounded-xl bg-[#101c32] text-white">Save changes</Button></DialogFooter>
    </DialogContent></Dialog>
  </MemoShell>;
}
