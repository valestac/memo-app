"use client";

import { BellRing, CalendarClock, History, MessageCircleMore } from "lucide-react";

export default function MemoShell({ active, children }: { active: "upcoming" | "history" | "channels"; children: React.ReactNode }) {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return <main className="min-h-screen px-4 py-5 sm:px-8 sm:py-8"><div className="mx-auto max-w-5xl">
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3"><div className="grid size-11 place-items-center rounded-2xl bg-[#ff6b4a] text-white shadow-[0_8px_30px_rgba(255,107,74,.35)]"><BellRing className="size-5" strokeWidth={2.4} /></div><div><h1 className="text-xl font-bold tracking-[-0.03em]">Memo</h1><p className="text-sm text-slate-500">{timezone}</p></div></div>
      <nav className="flex rounded-2xl border border-slate-200 bg-white p-1 shadow-sm" aria-label="Memo sections">
        <a href="/" className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${active === "upcoming" ? "bg-[#101c32] text-white" : "text-slate-600 hover:bg-slate-50"}`}><CalendarClock className="size-4" /> Upcoming</a>
        <a href="/history" className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${active === "history" ? "bg-[#101c32] text-white" : "text-slate-600 hover:bg-slate-50"}`}><History className="size-4" /> History</a>
        <a href="/channels" className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${active === "channels" ? "bg-[#101c32] text-white" : "text-slate-600 hover:bg-slate-50"}`}><MessageCircleMore className="size-4" /> <span className="hidden sm:inline">Channels</span></a>
      </nav>
    </header>
    {children}
  </div></main>;
}
