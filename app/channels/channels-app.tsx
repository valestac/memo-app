"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bell, Check, ExternalLink, MessageCircleMore } from "lucide-react";
import { toast } from "sonner";
import MemoShell from "../memo-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function ChannelsApp() {
  const [status, setStatus] = useState<{ configured: boolean; deliveryConfigured: boolean; connected: boolean; username: string | null } | null>(null);
  const [connecting, setConnecting] = useState(false);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  async function loadStatus() {
    const response = await fetch("/api/telegram/connect", { cache: "no-store" });
    if (response.ok) setStatus(await response.json());
  }

  async function connectTelegram() {
    setConnecting(true);
    const response = await fetch("/api/telegram/connect", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ timezone }) });
    const data = await response.json() as { url?: string; error?: string };
    setConnecting(false);
    if (!response.ok || !data.url) return toast.error(data.error ?? "Could not start Telegram setup.");
    window.location.href = data.url;
  }

  useEffect(() => { void loadStatus(); }, []);

  return <MemoShell active="channels">
    <section className="mt-8 grid gap-6 lg:grid-cols-[1.08fr_.92fr]">
      <div className="rounded-[28px] bg-[#101c32] p-6 text-white shadow-[0_28px_80px_rgba(15,28,50,.18)] sm:p-8">
        <div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-2xl bg-[#2aabee]"><MessageCircleMore className="size-5" /></span><div><Badge className="border-0 bg-white/10 text-white">Recommended first</Badge><h2 className="mt-2 text-3xl font-bold tracking-[-0.04em]">Telegram secretary</h2></div></div>
        <p className="mt-5 max-w-xl text-base leading-7 text-slate-300">Text reminders in the chat you already use. Memo will confirm the task and time, then send the reminder there with Done, Snooze, and Edit actions.</p>
        <div className="mt-6 space-y-3 rounded-2xl border border-white/10 bg-white/6 p-4">
          {["Send: “Remind me to call Anna tomorrow at 18”", "Receive an immediate task and time confirmation", "At 18:00, tap Done or Snooze without opening Memo"].map((item) => <div key={item} className="flex gap-3 text-sm text-slate-200"><Check className="mt-0.5 size-4 shrink-0 text-emerald-300" />{item}</div>)}
        </div>
        <div className={`mt-6 rounded-2xl px-4 py-3 text-sm leading-6 ${status?.connected ? "bg-emerald-300/10 text-emerald-100" : "bg-amber-300/10 text-amber-100"}`}>{status?.connected ? "Telegram is connected. You can create and complete reminders directly in the chat." : status?.configured && status.deliveryConfigured ? "The bot is ready. Connect this Memo account to your private Telegram chat." : "The conversation design is ready. Activating real Telegram delivery requires a private bot token and a scheduled-delivery key."}</div>
        {status?.configured && status.deliveryConfigured ? <Button onClick={() => void connectTelegram()} disabled={connecting || status.connected} className="mt-5 h-11 rounded-xl bg-[#2aabee] text-white hover:bg-[#229bd9]">{status.connected ? "Telegram connected" : connecting ? "Opening Telegram…" : "Connect Telegram"}</Button> : <Button asChild className="mt-5 h-11 rounded-xl bg-[#2aabee] text-white hover:bg-[#229bd9]"><a href="https://t.me/BotFather" target="_blank" rel="noreferrer">Create the private bot <ExternalLink className="size-4" /></a></Button>}
      </div>

      <div className="space-y-4">
        <article className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_18px_50px_rgba(15,28,50,.06)] sm:p-6"><div className="flex items-start justify-between gap-4"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-2xl bg-emerald-50 text-emerald-600"><MessageCircleMore className="size-5" /></span><div><h3 className="text-lg font-bold">WhatsApp</h3><p className="text-sm text-slate-500">Best familiarity, more setup</p></div></div><Badge variant="secondary">Later</Badge></div><p className="mt-4 text-sm leading-6 text-slate-600">Good as a second channel. Business onboarding, opt-in, and approved templates make personal timed reminders less flexible than Telegram.</p></article>
        <article className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_18px_50px_rgba(15,28,50,.06)] sm:p-6"><div className="flex items-start justify-between gap-4"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-2xl bg-orange-50 text-[#ef5f40]"><Bell className="size-5" /></span><div><h3 className="text-lg font-bold">Phone push</h3><p className="text-sm text-slate-500">Useful fallback</p></div></div><Badge variant="secondary">Planned</Badge></div><p className="mt-4 text-sm leading-6 text-slate-600">Web push can alert your installed Memo app even when it is closed, once device permission and a delivery service are connected.</p></article>
        <div className="rounded-[24px] border border-dashed border-slate-300 p-5"><p className="text-sm font-semibold text-slate-700">Quiet by default</p><p className="mt-1 text-sm leading-6 text-slate-500">Memo sends one timely alert. Repeats should happen only for reminders you mark important, because extra interruptions quickly become noise.</p><Link href="/" className="mt-3 inline-flex text-sm font-semibold text-[#ef5f40] hover:underline">Back to your reminders</Link></div>
      </div>
    </section>
  </MemoShell>;
}
