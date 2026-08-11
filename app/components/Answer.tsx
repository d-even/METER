"use client";

import type { CallError, CallResult } from "@/lib/useMeteredCall";

export function Answer({ result }: { result: CallResult }) {
  return (
    <section aria-label="Model response" className="space-y-3">
      <div className="flex items-baseline gap-3">
        <h2 className="rule-label">Response</h2>
        <span className="bg-line h-px flex-1" aria-hidden />
        <span className="text-ink-faint font-mono text-[11px]">
          {result.model}
        </span>
      </div>

      <div className="border-line bg-panel border px-5 py-4">
        {result.content ? (
          <p className="text-ink text-[14.5px] leading-relaxed whitespace-pre-wrap">
            {result.content}
          </p>
        ) : (
          <p className="text-ink-faint text-[13px]">
            The model returned an empty completion. The payment still settled —
            see step 5 for the transaction.
          </p>
        )}
      </div>
    </section>
  );
}

export function ErrorPanel({ error }: { error: CallError }) {
  return (
    <section aria-label="Error" role="alert" className="space-y-3">
      <div className="flex items-baseline gap-3">
        <h2 className="rule-label text-warn/70">Stopped</h2>
        <span className="bg-line h-px flex-1" aria-hidden />
      </div>

      <div className="border-warn/40 bg-warn/5 border px-5 py-4">
        <h3 className="text-warn text-[14px] font-medium tracking-tight">
          {error.title}
        </h3>
        <p className="text-ink-dim mt-2 text-[13px] leading-relaxed">
          {error.detail}
        </p>
        {error.hint ? (
          <p className="border-warn/25 text-ink mt-3 border-t pt-3 text-[13px] leading-relaxed">
            {error.hint}
          </p>
        ) : null}
      </div>
    </section>
  );
}
