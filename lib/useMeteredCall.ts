"use client";

import { useCallback, useRef, useState } from "react";
import { publicActions } from "viem";
import { useWalletClient } from "wagmi";
import { type Signer, wrapFetchWithPayment } from "x402-fetch";

import { MAX_PRICE_ATOMIC, MAX_PRICE_USD, usdcToUsd } from "./chain";
import type { ModelId } from "./models";
import {
  type PaymentPayload,
  type PaymentRequirement,
  type Paywall,
  type SettlementReceipt,
  type WireStep,
  decodePaymentHeader,
  decodeSettlement,
  paywallStep,
  rejectedStep,
  requestStep,
  retryStep,
  settledStep,
  signingStep,
} from "./wire";

const ENDPOINT = "/api/v1/chat";

export type Usage = {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
};

export type CallResult = {
  content: string;
  usage: Usage;
  /** What the gateway metered from real token counts. */
  cost: { baseCost: number; finalCost: number };
  model: ModelId;
  /** The ceiling the wallet actually authorized, read off the 402. */
  authorizedUsd: number;
  settlement: SettlementReceipt | null;
  elapsedMs: number;
};

export type CallError = {
  title: string;
  detail: string;
  /** What the user can do about it. Never omitted for a recoverable failure. */
  hint?: string;
};

export type Phase = "idle" | "running" | "done" | "error";

/** Let the browser paint between two events that really did happen in order. */
function nextFrame() {
  return new Promise<void>((resolve) => {
    if (typeof requestAnimationFrame === "undefined") return resolve();
    requestAnimationFrame(() => resolve());
  });
}

function paymentHeaderOf(init?: RequestInit): string | null {
  const headers = init?.headers as Record<string, string> | undefined;
  if (!headers) return null;
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === "x-payment") return value;
  }
  return null;
}

function urlOf(input: RequestInfo | URL) {
  const raw =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;
  return new URL(raw, window.location.origin).toString();
}

function describeError(err: unknown): CallError {
  const message = err instanceof Error ? err.message : String(err);
  const lower = message.toLowerCase();

  if (
    lower.includes("user rejected") ||
    lower.includes("user denied") ||
    lower.includes("request rejected")
  ) {
    return {
      title: "Signature declined",
      detail:
        "The wallet returned before signing, so no authorization was created " +
        "and nothing was charged.",
      hint: "Press send again and approve the signature request to continue.",
    };
  }

  if (lower.includes("exceeds maximum")) {
    return {
      title: "Price above your ceiling",
      detail: `The gateway quoted more than the $${MAX_PRICE_USD} this page is willing to authorize, so the wallet was never asked to sign.`,
      hint: "Nothing was charged. The quoted price is shown in step 2 above.",
    };
  }

  if (lower.includes("failed to fetch") || lower.includes("networkerror")) {
    return {
      title: "Could not reach the gateway",
      detail: `The request to ${ENDPOINT} never completed.`,
      hint: "Check that the dev server is running, then send again.",
    };
  }

  return {
    title: "Call failed",
    detail: message,
    hint: "Nothing settles unless step 5 returns a transaction hash.",
  };
}

/**
 * x402 reports refusals as a fixed set of reason codes. Match them exactly —
 * a loose substring match happily turns "is not valid JSON" into a confident
 * claim about the authorization window, which is worse than saying nothing.
 */
const REASON_HINTS: Record<string, string> = {
  insufficient_funds:
    "Your wallet does not hold enough test USDC. Use the faucet link in the left panel, then send again.",
  payment_expired:
    "The authorization window closed before the facilitator settled it. Send again.",
  invalid_exact_evm_payload_authorization_valid_after:
    "The authorization was not yet valid when the facilitator checked it. Check your system clock, then send again.",
  invalid_exact_evm_payload_authorization_valid_before:
    "The authorization had already expired when the facilitator checked it. Send again.",
  invalid_exact_evm_payload_authorization_value:
    "The signed amount did not match the price the gateway quoted in step 2.",
  invalid_exact_evm_payload_signature:
    "The facilitator could not recover your address from the signature. Reconnect the wallet and send again.",
  invalid_exact_evm_payload_recipient_mismatch:
    "The authorization pays a different address than the gateway asked for.",
  invalid_network:
    "The authorization was signed for a different chain. Switch the wallet to Base Sepolia and send again.",
  invalid_scheme:
    "The gateway and the wallet disagree on the payment scheme.",
  unsupported_scheme:
    "The facilitator does not support the scheme this gateway asked for.",
  duplicate_settlement:
    "This authorization was already settled once. Send again to sign a fresh one.",
  unexpected_verify_error:
    "The facilitator failed while verifying the authorization. Nothing was charged — send again.",
  unexpected_settle_error:
    "The facilitator failed while settling the authorization. Send again.",
};

function settlementFailureHint(reason: string): string {
  const code = Object.keys(REASON_HINTS).find((key) =>
    new RegExp(`\\b${key}\\b`).test(reason),
  );
  if (code) return REASON_HINTS[code];

  return (
    "The gateway did not report a reason this page recognises. Nothing " +
    "settles unless step 5 returns a transaction hash, so nothing was " +
    "charged — the raw response is printed in step 5 above."
  );
}

export function useMeteredCall() {
  const { data: walletClient } = useWalletClient();
  const [phase, setPhase] = useState<Phase>("idle");
  const [steps, setSteps] = useState<WireStep[]>([]);
  const [result, setResult] = useState<CallResult | null>(null);
  const [error, setError] = useState<CallError | null>(null);
  const running = useRef(false);

  const reset = useCallback(() => {
    setSteps([]);
    setResult(null);
    setError(null);
    setPhase("idle");
  }, []);

  const send = useCallback(
    async (prompt: string, model: ModelId) => {
      if (running.current) return;
      if (!walletClient) {
        setError({
          title: "No wallet connected",
          detail:
            "The 402 can be fetched without a wallet, but nothing can be " +
            "signed, so the call cannot complete.",
          hint: "Connect a wallet from the header to continue.",
        });
        setPhase("error");
        return;
      }

      running.current = true;
      setSteps([]);
      setResult(null);
      setError(null);
      setPhase("running");

      const t0 = performance.now();
      const mark = () => Math.round(performance.now() - t0);
      const push = (step: WireStep) => setSteps((prev) => [...prev, step]);

      const body = JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
      });

      // Filled in as the exchange unfolds; read afterwards to build the ledger.
      const seen: {
        requirement?: PaymentRequirement;
        paywallAt: number;
        rejection?: Paywall;
      } = { paywallAt: 0 };

      const tap: typeof fetch = async (input, init) => {
        const url = urlOf(input);
        const header = paymentHeaderOf(init);

        if (header) {
          // The wallet has signed. Report the signing we just measured, let it
          // paint, then report the request it enabled.
          const signedAt = mark();
          let payment: PaymentPayload | undefined;
          try {
            payment = decodePaymentHeader(header);
          } catch {
            /* header stays opaque; step 4 still shows it verbatim */
          }
          if (payment) {
            push(
              signingStep({
                at: signedAt,
                dur: signedAt - seen.paywallAt,
                payment,
                requirement: seen.requirement,
              }),
            );
            await nextFrame();
          }
          push(retryStep({ at: mark(), url, header }));
        } else {
          push(requestStep({ at: mark(), url, body }));
        }

        const sentAt = mark();
        const response = await fetch(input, init);
        const arrivedAt = mark();
        const snapshot = await response.clone().text();

        if (response.status === 402) {
          let paywall: Paywall;
          try {
            paywall = JSON.parse(snapshot);
          } catch {
            paywall = { x402Version: 1, accepts: [] };
          }

          if (header) {
            // A 402 on the retry means verification or settlement was refused.
            seen.rejection = paywall;
            push(
              rejectedStep({
                at: arrivedAt,
                dur: arrivedAt - sentAt,
                paywall,
              }),
            );
          } else {
            seen.requirement = paywall.accepts?.[0];
            seen.paywallAt = arrivedAt;
            push(
              paywallStep({ at: arrivedAt, dur: arrivedAt - sentAt, paywall }),
            );
          }
          return response;
        }

        const settlementHeader =
          response.headers.get("x-payment-response") ?? undefined;
        let settlement: SettlementReceipt | undefined;
        if (settlementHeader) {
          try {
            settlement = decodeSettlement(settlementHeader);
          } catch {
            /* leave undefined — the step says so rather than inventing one */
          }
        }

        push(
          settledStep({
            at: arrivedAt,
            dur: arrivedAt - sentAt,
            status: response.status,
            settlement,
            settlementHeader,
          }),
        );

        return response;
      };

      try {
        // x402 types its signer against viem's generic `Chain`, which is
        // invariant against a client pinned to a concrete chain. At runtime it
        // only reaches for `chain`, `transport` and `signTypedData`.
        const signer = walletClient.extend(publicActions) as unknown as Signer;
        const payFetch = wrapFetchWithPayment(tap, signer, MAX_PRICE_ATOMIC);

        const response = await payFetch(ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body,
        });

        const elapsedMs = mark();

        if (response.status === 402) {
          const reason =
            seen.rejection?.error ??
            "The payment was not accepted by the gateway.";
          setError({
            title: "Payment refused",
            detail: reason,
            hint: settlementFailureHint(reason),
          });
          setPhase("error");
          return;
        }

        const payload = await response.json();

        if (!response.ok) {
          setError({
            title: `Gateway returned ${response.status}`,
            detail:
              typeof payload?.error === "string"
                ? payload.error
                : "The upstream model call did not succeed.",
            hint: "The signed authorization may still have settled — check step 5 for a transaction hash.",
          });
          setPhase("error");
          return;
        }

        const settlementHeader = response.headers.get("x-payment-response");
        let settlement: SettlementReceipt | null = null;
        if (settlementHeader) {
          try {
            settlement = decodeSettlement(settlementHeader);
          } catch {
            settlement = null;
          }
        }

        setResult({
          content: payload.content ?? "",
          usage: payload.usage,
          cost: payload.cost,
          model: payload.model ?? model,
          authorizedUsd: seen.requirement
            ? usdcToUsd(seen.requirement.maxAmountRequired)
            : MAX_PRICE_USD,
          settlement,
          elapsedMs,
        });
        setPhase("done");
      } catch (err) {
        setError(describeError(err));
        setPhase("error");
      } finally {
        running.current = false;
      }
    },
    [walletClient],
  );

  return { phase, steps, result, error, send, reset };
}
