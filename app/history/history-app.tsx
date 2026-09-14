"use client";

import { useEffect, useState } from "react";
import { Bell, CheckCircle2, Clock3, ExternalLink, Link2, Mail, StickyNote } from "lucide-react";
import { toast } from "sonner";
import MemoShell from "../memo-shell";
import { Badge } from "@/components/ui/badge";
import { formatDue } from "@/lib/reminder-parser";

type Reminder = {
  id: number; title: string; dueAt: string; notes: string; link: string;
  emailNotify: boolean; phoneNotify: boolean; status: "scheduled" | "done"; completedAt: string | null;
};

export default function HistoryApp() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/reminders?view=history", { cache: "no-store" });
        const data = await response.json() as { reminders: Reminder[]; error?: string }; if (!response.ok) throw new Error(data.error);
        setReminders(data.reminders);
      } catch (error) { toast.error(error instanceof Error ? error.message : "Could not load history."); }
      finally { setLoading(false); }
    })();
  }, []);

  return <MemoShell active="history"><section className="mt-8 rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_20px_60px_rgba(15,28,50,.07)] sm:p-7">
    <div className="flex items-end justify-between gap-4"><div><p className="text-sm font-semibold text-[#ef5f40]">Archive</p><h2 className="mt-1 text-3xl font-bold tracking-[-0.04em]">History</h2><p className="mt-2 text-sm text-slate-500">Completed reminders and tasks whose time has passed.</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">{reminders.length}</span></div>
    <div className="mt-7 space-y-3">{loading ? <p className="py-16 text-center text-slate-500">Loading history…</p> : reminders.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-200 px-5 py-14 text-center"><Clock3 className="mx-auto size-7 text-slate-400" /><p className="mt-3 font-semibold">No history yet</p><p className="mt-1 text-sm text-slate-500">Completed and passed reminders will appear here.</p></div> : reminders.map((reminder) => {
      const completed = reminder.status === "done";
      return <article key={reminder.id} className="rounded-2xl border border-slate-200 p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div className="flex min-w-0 gap-3">{completed ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-500" /> : <Clock3 className="mt-0.5 size-5 shrink-0 text-amber-500" />}<div><h3 className="font-semibold">{reminder.title}</h3><p className="mt-1 text-sm text-slate-500">Scheduled for {formatDue(reminder.dueAt)}</p></div></div><Badge variant="secondary" className={completed ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}>{completed ? "Completed" : "Passed"}</Badge></div>
        {reminder.notes && <p className="mt-4 whitespace-pre-wrap rounded-xl bg-slate-50 px-3 py-3 text-sm text-slate-600"><StickyNote className="mr-2 inline size-4" />{reminder.notes}</p>}
        <div className="mt-3 flex flex-wrap gap-3 text-sm text-slate-500">{reminder.link && <a href={reminder.link} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-[#ef5f40]"><Link2 className="size-4" /> Open link <ExternalLink className="size-3" /></a>}{reminder.emailNotify && <span className="flex items-center gap-1.5"><Mail className="size-4" /> Email selected</span>}{reminder.phoneNotify && <span className="flex items-center gap-1.5"><Bell className="size-4" /> Telegram selected</span>}</div>
      </article>;
    })}</div>
  </section></MemoShell>;
}
