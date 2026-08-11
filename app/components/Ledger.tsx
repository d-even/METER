"use client";

import {
  CARD_FLOOR_LABEL,
  CARD_FLOOR_USD,
  MAX_PRICE_USD,
  formatUsd,
} from "@/lib/chain";
import type { CallResult } from "@/lib/useMeteredCall";

const PLACEHOLDER = "—";

function Figure({
  label,
  value,
  sub,
  contrast,
}: {
  label: string;
  value: string;
  sub: string;
  contrast?: boolean;
}) {
  return (
    <div
      className={`px-4 py-3.5 ${
        contrast ? "border-line border-dashed sm:border-l" : ""
      }`}
    >
      <div className="rule-label">{label}</div>
      <div className="mt-2 font-mono text-[17px] leading-none tracking-tight">
        {/* Amber is reserved for money — a placeholder is not money. */}
        {value === PLACEHOLDER ? (
          <span className="text-ink-faint">{value}</span>
        ) : (
          <span className="money">{value}</span>
        )}
      </div>
      <div className="text-ink-faint mt-2 font-mono text-[11px]">{sub}</div>
    </div>
  );
}

export function Ledger({ result }: { result: CallResult | null }) {
  const authorized = result?.authorizedUsd ?? MAX_PRICE_USD;
  const metered = result?.cost.finalCost ?? null;
  const ratio = metered && metered > 0 ? CARD_FLOOR_USD / metered : null;

  const tokens = result
    ? `${result.usage.prompt_tokens.toLocaleString()} in · ${result.usage.completion_tokens.toLocaleString()} out`
    : "awaiting token counts";

  return (
    <section aria-label="Ledger" className="space-y-3">
      <div className="flex items-baseline gap-3">
        <h2 className="rule-label">Ledger</h2>
        <span className="bg-line h-px flex-1" aria-hidden />
      </div>

      <div className="border-line bg-panel border">
        <div className="divide-line grid grid-cols-1 divide-y sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <Figure
            label="Authorized"
            value={formatUsd(authorized)}
            sub="signed ceiling"
          />
          <Figure
            label="Metered"
            value={metered === null ? PLACEHOLDER : formatUsd(metered)}
            sub={tokens}
          />
          <Figure
            label="Card network floor"
            value={formatUsd(CARD_FLOOR_USD, 2)}
            sub={CARD_FLOOR_LABEL}
            contrast
          />
        </div>

        <p className="border-line text-ink-faint border-t px-4 py-3 text-[12px] leading-relaxed">
          {ratio ? (
            <>
              <span className="text-ink-dim">
                {Math.round(ratio).toLocaleString()}× under
              </span>{" "}
              the cheapest charge a card network will process
              {result ? (
                <>
                  {" · settled in "}
                  <span className="text-ink-dim font-mono">
                    {(result.elapsedMs / 1000).toFixed(2)}s
                  </span>
                </>
              ) : null}
              . The authorization is an exact-amount ceiling, so that full
              amount transfers; the metered figure is what the tokens actually
              cost.
            </>
          ) : (
            <>
              Authorized is the ceiling the wallet signs before the model runs.
              Metered is computed from the token counts the model reports back.
              The card floor is there for scale — no card network will move
              money this small.
            </>
          )}
        </p>
      </div>
    </section>
  );
}
