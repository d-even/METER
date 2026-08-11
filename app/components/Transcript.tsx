"use client";

import type { WireLine, WireStep } from "@/lib/wire";
import type { Phase } from "@/lib/useMeteredCall";

const SEQUENCE = [
  { n: 1, title: "POST /api/v1/chat", hint: "the call goes out unpaid" },
  { n: 2, title: "402 Payment Required", hint: "the server quotes a price" },
  { n: 3, title: "Sign authorization", hint: "the wallet signs, offline" },
  { n: 4, title: "Retry with x-payment", hint: "same call, now carrying money" },
  { n: 5, title: "200 OK · settled", hint: "USDC moved, onchain" },
];

function Glyph({ side }: { side: WireStep["side"] }) {
  const map = {
    out: { char: "→", className: "text-ink-dim" },
    in: { char: "←", className: "text-proto" },
    local: { char: "◆", className: "text-proto" },
  } as const;
  const { char, className } = map[side];
  return (
    <span
      aria-hidden
      className={`font-mono text-[13px] leading-none ${className}`}
    >
      {char}
    </span>
  );
}

function Line({ line, failed }: { line: WireLine; failed?: boolean }) {
  switch (line.k) {
    case "gap":
      return <div className="h-3" aria-hidden />;

    case "label":
      return (
        <div className="rule-label mt-1 mb-1.5 flex items-center gap-2">
          <span>{line.text}</span>
          <span className="bg-line h-px flex-1" aria-hidden />
        </div>
      );

    case "start": {
      const tone = failed ? "text-warn" : line.code ? "text-proto-lit" : "";
      if (line.code) {
        const [version, ...rest] = line.text.split(" ");
        return (
          <div className="break-all">
            <span className="text-ink-faint">{version} </span>
            <span className={`font-semibold ${tone}`}>{rest.join(" ")}</span>
          </div>
        );
      }
      const [method, ...rest] = line.text.split(" ");
      return (
        <div className="break-all">
          <span className="text-ink font-semibold">{method} </span>
          <span className="text-ink-dim">{rest.join(" ")}</span>
        </div>
      );
    }

    case "raw":
      return (
        <pre className="text-ink-dim border-line mt-1 border-l pl-3 break-all whitespace-pre-wrap">
          {line.text}
        </pre>
      );

    case "kv": {
      const value = line.href ? (
        <a
          href={line.href}
          target="_blank"
          rel="noreferrer"
          className="text-proto-lit decoration-proto-dim hover:decoration-proto-lit underline underline-offset-4"
        >
          {line.value}
          <span aria-hidden> ↗</span>
        </a>
      ) : (
        <span className="text-ink">{line.value}</span>
      );

      return (
        <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-[9.5rem_minmax(0,1fr)]">
          <span className="text-ink-faint break-all">{line.key}</span>
          <span className="break-all">
            {value}
            {line.note ? (
              <span className={line.money ? "money ml-2" : "text-ink-faint ml-2"}>
                {line.money ? line.note : `· ${line.note}`}
              </span>
            ) : null}
          </span>
        </div>
      );
    }
  }
}

function StepBlock({ step }: { step: WireStep }) {
  return (
    <article className="wire-in border-line bg-panel border">
      <header className="border-line flex items-center gap-3 border-b px-4 py-2.5">
        <span className="text-ink-faint font-mono text-[11px] tabular-nums">
          {String(step.n).padStart(2, "0")}
        </span>
        <Glyph side={step.side} />
        <h3
          className={`text-[13px] font-medium tracking-tight ${
            step.failed ? "text-warn" : "text-ink"
          }`}
        >
          {step.title}
        </h3>
        <span className="text-ink-faint ml-auto shrink-0 font-mono text-[11px] tabular-nums">
          +{step.at}ms
          {step.dur !== undefined ? (
            <span className="text-ink-faint/60"> / {step.dur}ms</span>
          ) : null}
        </span>
      </header>
      <div className="space-y-0.5 px-4 py-3 font-mono text-[12.5px] leading-[1.75]">
        {step.lines.map((line, i) => (
          <Line key={i} line={line} failed={step.failed} />
        ))}
      </div>
    </article>
  );
}

function Pending({ next }: { next: (typeof SEQUENCE)[number] }) {
  return (
    <div className="border-line/70 flex items-center gap-3 border border-dashed px-4 py-2.5">
      <span className="text-ink-faint font-mono text-[11px] tabular-nums">
        {String(next.n).padStart(2, "0")}
      </span>
      <span className="bg-proto pulse-dim h-1.5 w-1.5 shrink-0" aria-hidden />
      <span className="text-ink-faint text-[13px]">
        waiting on {next.title.toLowerCase()}
      </span>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="border-line bg-panel border">
      <div className="border-line border-b px-4 py-2.5">
        <h3 className="text-ink text-[13px] font-medium tracking-tight">
          Expected sequence
        </h3>
      </div>
      <ol className="divide-line divide-y">
        {SEQUENCE.map((s) => (
          <li key={s.n} className="flex items-baseline gap-3 px-4 py-2.5">
            <span className="text-ink-faint font-mono text-[11px] tabular-nums">
              {String(s.n).padStart(2, "0")}
            </span>
            <span className="text-ink-dim font-mono text-[12.5px]">
              {s.title}
            </span>
            <span className="text-ink-faint ml-auto hidden text-[12px] sm:block">
              {s.hint}
            </span>
          </li>
        ))}
      </ol>
      <p className="border-line text-ink-faint border-t px-4 py-3 text-[12.5px] leading-relaxed">
        Nothing has been sent yet. Write a prompt, press send, and each step
        above is printed the moment it actually happens — headers and all.
      </p>
    </div>
  );
}

export function Transcript({
  steps,
  phase,
}: {
  steps: WireStep[];
  phase: Phase;
}) {
  const nextExpected =
    phase === "running"
      ? SEQUENCE.find((s) => !steps.some((step) => step.n === s.n))
      : undefined;

  return (
    <section aria-label="Wire transcript" className="space-y-3">
      <div className="flex items-baseline gap-3">
        <h2 className="rule-label">Wire transcript</h2>
        <span className="bg-line h-px flex-1" aria-hidden />
        <span className="text-ink-faint font-mono text-[11px] tabular-nums">
          {steps.length}/5
        </span>
      </div>

      {steps.length === 0 && phase !== "running" ? (
        <EmptyState />
      ) : (
        <div className="space-y-3">
          {steps.map((step) => (
            <StepBlock key={step.id} step={step} />
          ))}
          {nextExpected ? <Pending next={nextExpected} /> : null}
        </div>
      )}
    </section>
  );
}
