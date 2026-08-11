"use client";

import { useEffect, useRef, useState } from "react";

import { NETWORK } from "@/lib/chain";
import { DEFAULT_MODEL, type ModelId } from "@/lib/models";
import { useMeteredCall } from "@/lib/useMeteredCall";
import { useWallet } from "@/lib/useWallet";

import { Answer, ErrorPanel } from "./Answer";
import { Composer } from "./Composer";
import { Ledger } from "./Ledger";
import { Transcript } from "./Transcript";
import { WalletChip } from "./WalletChip";

function Mark() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 18 18"
      aria-hidden
      className="shrink-0"
    >
      <rect x="0" y="11" width="4" height="7" className="fill-proto-dim" />
      <rect x="7" y="6" width="4" height="12" className="fill-proto" />
      <rect x="14" y="0" width="4" height="18" className="fill-money" />
    </svg>
  );
}

export function Console() {
  const wallet = useWallet();
  const { phase, steps, result, error, send } = useMeteredCall();

  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState<ModelId>(DEFAULT_MODEL);

  const scroller = useRef<HTMLDivElement>(null);
  const stepCount = steps.length;

  // Follow the transcript as steps land, but never yank the view away from
  // someone who has scrolled up to read an earlier step.
  useEffect(() => {
    const el = scroller.current;
    if (!el || stepCount === 0) return;
    const distanceFromBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distanceFromBottom > 240) return;
    const reduced = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    el.scrollTo({
      top: el.scrollHeight,
      behavior: reduced ? "auto" : "smooth",
    });
  }, [stepCount]);

  const { refetchBalance } = wallet;
  useEffect(() => {
    if (phase === "done") refetchBalance();
  }, [phase, refetchBalance]);

  return (
    <div className="flex min-h-dvh flex-col lg:h-dvh lg:overflow-hidden">
      <header className="border-line flex h-14 shrink-0 items-center gap-3 border-b px-4 sm:px-5">
        <Mark />
        <span className="text-ink text-[15px] font-semibold tracking-[0.16em]">
          METER
        </span>
        <span
          className="bg-line hidden h-4 w-px sm:block"
          aria-hidden
        />
        <span className="text-ink-faint hidden font-mono text-[11.5px] sm:block">
          x402 · exact · {NETWORK}
        </span>
        <span className="text-ink-faint ml-auto hidden text-[12px] xl:block">
          a USDC payment, settled inside one HTTP request
        </span>
        <div className="ml-auto xl:ml-6">
          <WalletChip wallet={wallet} />
        </div>
      </header>

      <main className="grid flex-1 grid-cols-1 lg:grid-cols-[340px_minmax(0,1fr)] lg:overflow-hidden">
        <aside className="border-line scroll-thin border-b lg:overflow-y-auto lg:border-r lg:border-b-0">
          <Composer
            prompt={prompt}
            onPromptChange={setPrompt}
            model={model}
            onModelChange={setModel}
            onSend={() => send(prompt, model)}
            busy={phase === "running"}
            wallet={wallet}
          />
        </aside>

        <div
          ref={scroller}
          className="scroll-thin space-y-8 p-4 sm:p-6 lg:overflow-y-auto"
        >
          <Transcript steps={steps} phase={phase} />
          <Ledger result={result} />
          {error ? <ErrorPanel error={error} /> : null}
          {result ? <Answer result={result} /> : null}
        </div>
      </main>
    </div>
  );
}
