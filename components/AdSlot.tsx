"use client";

import { useEffect } from "react";

declare global {
  interface Window { adsbygoogle?: Array<Record<string, unknown>> }
}

export default function AdSlot({ slot, label = "Advertisement" }: { slot: string; label?: string }) {
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;
  const valid = Boolean(client && /^ca-pub-\d+$/.test(client) && /^\d+$/.test(slot));
  useEffect(() => {
    if (!valid) return;
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch { /* provider may still be loading */ }
  }, [valid]);
  if (!valid) return null;
  return (
    <aside aria-label={label} className="my-6 min-h-64 overflow-hidden rounded-xl border border-slate-100 bg-slate-50 p-2 text-center">
      <span className="block text-[10px] uppercase tracking-widest text-slate-400">{label}</span>
      <ins className="adsbygoogle block" data-ad-client={client} data-ad-slot={slot} data-ad-format="auto" data-full-width-responsive="true" />
    </aside>
  );
}
