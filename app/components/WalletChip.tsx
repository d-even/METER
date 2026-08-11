"use client";

import { NETWORK_LABEL, short } from "@/lib/chain";
import { useWallet } from "@/lib/useWallet";

const BUTTON =
  "border-line hover:border-line-lit hover:bg-raise border px-3 py-1.5 " +
  "font-mono text-[12px] text-ink-dim transition-colors";

export function WalletChip({ wallet }: { wallet: ReturnType<typeof useWallet> }) {
  if (!wallet.mounted) {
    // Placeholder of the same height so the header does not jump on hydration.
    return <div className="h-[31px] w-[168px]" aria-hidden />;
  }

  if (!wallet.hasConnector) {
    return (
      <a
        href="https://ethereum.org/en/wallets/find-wallet/"
        target="_blank"
        rel="noreferrer"
        className={`${BUTTON} decoration-line-lit underline underline-offset-4`}
      >
        No browser wallet found ↗
      </a>
    );
  }

  if (!wallet.isConnected) {
    return (
      <button
        type="button"
        onClick={wallet.connect}
        disabled={wallet.isConnecting}
        className="border-proto/60 text-proto-lit hover:bg-proto/10 hover:border-proto border px-3 py-1.5 font-mono text-[12px] transition-colors disabled:opacity-50"
      >
        {wallet.isConnecting ? "Connecting…" : "Connect wallet"}
      </button>
    );
  }

  if (!wallet.onRightChain) {
    return (
      <button
        type="button"
        onClick={wallet.switchToBaseSepolia}
        disabled={wallet.isSwitching}
        className="border-warn/50 text-warn hover:bg-warn/10 border px-3 py-1.5 font-mono text-[12px] transition-colors disabled:opacity-50"
      >
        {wallet.isSwitching
          ? "Switching…"
          : `Wrong network — switch to ${NETWORK_LABEL}`}
      </button>
    );
  }

  return (
    <div className="border-line divide-line flex items-stretch divide-x border">
      <span className="text-ink-dim px-3 py-1.5 font-mono text-[12px]">
        {short(wallet.address ?? "", 6, 4)}
      </span>
      <span className="px-3 py-1.5 font-mono text-[12px]">
        {wallet.usdc === null ? (
          <span
            className="text-ink-faint"
            title={
              wallet.balanceError
                ? "Balance unavailable — the RPC did not respond. Set NEXT_PUBLIC_RPC_URL to use your own endpoint."
                : undefined
            }
          >
            {wallet.isBalanceLoading ? "…" : "— USDC"}
          </span>
        ) : (
          <span className={wallet.usdc === 0 ? "text-warn" : "text-ink-dim"}>
            {wallet.usdc.toFixed(4)} USDC
          </span>
        )}
      </span>
      <button
        type="button"
        onClick={() => wallet.disconnect()}
        className="text-ink-faint hover:bg-raise hover:text-ink px-3 py-1.5 font-mono text-[12px] transition-colors"
        aria-label="Disconnect wallet"
      >
        ✕
      </button>
    </div>
  );
}
