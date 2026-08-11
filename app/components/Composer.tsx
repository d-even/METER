"use client";

import {
  MAX_PRICE_USD,
  NETWORK,
  PAY_TO,
  USDC_ADDRESS,
  USDC_FAUCET,
  formatUsd,
  short,
} from "@/lib/chain";
import { MODELS, type ModelId } from "@/lib/models";
import type { useWallet } from "@/lib/useWallet";

type Props = {
  prompt: string;
  onPromptChange: (value: string) => void;
  model: ModelId;
  onModelChange: (value: ModelId) => void;
  onSend: () => void;
  busy: boolean;
  wallet: ReturnType<typeof useWallet>;
};

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-2">
      <dt className="text-ink-faint">{label}</dt>
      <dd className="text-ink-dim break-all">{value}</dd>
    </div>
  );
}

export function Composer({
  prompt,
  onPromptChange,
  model,
  onModelChange,
  onSend,
  busy,
  wallet,
}: Props) {
  const needsWallet = wallet.mounted && !wallet.isConnected;
  const needsChain = wallet.isConnected && !wallet.onRightChain;
  const ready = wallet.isConnected && wallet.onRightChain;
  const empty = prompt.trim().length === 0;

  const action = needsWallet
    ? { label: "Connect wallet", onClick: wallet.connect, disabled: !wallet.hasConnector }
    : needsChain
      ? {
          label: "Switch to Base Sepolia",
          onClick: wallet.switchToBaseSepolia,
          disabled: wallet.isSwitching,
        }
      : { label: "Send", onClick: onSend, disabled: empty || busy || !wallet.mounted };

  return (
    <div className="flex flex-col gap-5 p-5">
      <div className="space-y-2">
        <label htmlFor="prompt" className="rule-label block">
          Prompt
        </label>
        <textarea
          id="prompt"
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && ready && !empty) {
              e.preventDefault();
              onSend();
            }
          }}
          rows={6}
          spellCheck={false}
          placeholder="Explain HTTP 402 in two sentences."
          className="border-line bg-panel text-ink placeholder:text-ink-faint focus:border-line-lit w-full resize-y px-3 py-2.5 font-mono text-[13px] leading-relaxed transition-colors"
        />
        <p className="text-ink-faint text-[11px]">
          ⌘/Ctrl + Enter to send
        </p>
      </div>

      <div className="space-y-2">
        <label htmlFor="model" className="rule-label block">
          Model
        </label>
        <div className="relative">
          <select
            id="model"
            value={model}
            onChange={(e) => onModelChange(e.target.value as ModelId)}
            className="border-line bg-panel text-ink focus:border-line-lit w-full appearance-none py-2.5 pr-9 pl-3 font-mono text-[12.5px] transition-colors"
          >
            {MODELS.map((m) => (
              <option key={m.id} value={m.id} className="bg-panel">
                {m.id}
              </option>
            ))}
          </select>
          <svg
            viewBox="0 0 10 6"
            width="10"
            height="6"
            aria-hidden
            className="text-ink-faint pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 fill-current"
          >
            <path d="M0 0h10L5 6z" />
          </svg>
        </div>
        <p className="text-ink-faint text-[11px] font-mono">
          {MODELS.find((m) => m.id === model)?.note}
        </p>
      </div>

      <div className="space-y-2.5">
        <button
          type="button"
          onClick={action.onClick}
          disabled={action.disabled}
          className="border-proto/60 bg-proto/10 text-ink hover:bg-proto/20 hover:border-proto flex w-full items-center justify-between border px-3.5 py-3 transition-colors disabled:cursor-not-allowed disabled:border-line disabled:bg-transparent disabled:text-ink-faint"
        >
          <span className="text-[13px] font-medium tracking-tight">
            {busy ? "In flight…" : action.label}
          </span>
          {ready ? (
            <span className="font-mono text-[11.5px]">
              max <span className="money">{formatUsd(MAX_PRICE_USD, 3)}</span>
            </span>
          ) : null}
        </button>

        {needsWallet && !wallet.hasConnector ? (
          <p className="text-ink-faint text-[12px] leading-relaxed">
            No injected wallet was found in this browser. Install one, then
            reload this page.
          </p>
        ) : null}

        {needsWallet && wallet.hasConnector ? (
          <p className="text-ink-faint text-[12px] leading-relaxed">
            The 402 can be fetched without a wallet, but nothing can be signed —
            so the call cannot complete.
          </p>
        ) : null}

        {needsChain ? (
          <p className="text-ink-faint text-[12px] leading-relaxed">
            Your wallet is on chain {wallet.chainId ?? "?"}. The gateway only
            accepts authorizations signed for Base Sepolia (84532).
          </p>
        ) : null}

        {ready && wallet.usdc === 0 ? (
          <div className="border-money/40 bg-money/5 space-y-2 border px-3 py-2.5">
            <p className="text-money-lit text-[12px] font-medium">
              No test USDC in this wallet
            </p>
            <p className="text-ink-dim text-[12px] leading-relaxed">
              The wallet will still sign, but the facilitator will refuse to
              settle a transfer it cannot fund. Fund the wallet first.
            </p>
            <a
              href={USDC_FAUCET}
              target="_blank"
              rel="noreferrer"
              className="text-money-lit decoration-money/50 hover:decoration-money-lit inline-block font-mono text-[12px] underline underline-offset-4"
            >
              Get Base Sepolia USDC ↗
            </a>
          </div>
        ) : null}
      </div>

      <div className="border-line mt-auto border-t pt-4">
        <h2 className="rule-label mb-2.5">Endpoint</h2>
        <dl className="space-y-1.5 font-mono text-[11px]">
          <Fact label="path" value="/api/v1/chat" />
          <Fact label="scheme" value="exact" />
          <Fact label="network" value={NETWORK} />
          <Fact label="asset" value={`USDC ${short(USDC_ADDRESS, 6, 4)}`} />
          <Fact label="payTo" value={short(PAY_TO, 6, 4)} />
          <Fact label="facilitator" value="x402.org" />
        </dl>
      </div>
    </div>
  );
}
