/**
 * The transcript model.
 *
 * Every line rendered on the right-hand panel is produced from a real request,
 * a real response, or the real `x-payment` header the wallet just signed —
 * nothing here is scripted. `lib/useMeteredCall.ts` taps the fetch that
 * `x402-fetch` drives and turns each observed event into one of these steps.
 */

import {
  CHAIN_ID,
  NETWORK,
  formatUsd,
  short,
  txUrl,
  usdcToUsd,
} from "./chain";

/* ------------------------------------------------------------------ lines */

export type WireLine =
  /** An HTTP request line or status line — the loud first row of a block. */
  | { k: "start"; text: string; code?: number }
  /** A header or a decoded field. `money` paints the value amber. */
  | {
      k: "kv";
      key: string;
      value: string;
      note?: string;
      money?: boolean;
      href?: string;
    }
  /** A body or an opaque blob, wrapped verbatim. */
  | { k: "raw"; text: string }
  /** A section caption inside a block, e.g. `accepts[0]`. */
  | { k: "label"; text: string }
  | { k: "gap" };

export type WireStep = {
  /** 1–5, printed in the gutter. */
  n: number;
  /** Stable key — a step is appended once and never rewritten. */
  id: string;
  title: string;
  /** Where the bytes went: out to the server, back from it, or nowhere. */
  side: "out" | "in" | "local";
  /** ms since the send button was pressed. */
  at: number;
  /** ms this step itself took, when that is meaningful. */
  dur?: number;
  /** Marks a step that reports a failure, so it can be styled as one. */
  failed?: boolean;
  lines: WireLine[];
};

/* --------------------------------------------------------------- decoding */

export type PaymentRequirement = {
  scheme: string;
  network: string;
  maxAmountRequired: string;
  resource: string;
  description?: string;
  payTo: string;
  asset: string;
  maxTimeoutSeconds: number;
  extra?: { name?: string; version?: string } | null;
};

export type Paywall = {
  x402Version: number;
  error?: string;
  accepts: PaymentRequirement[];
};

export type SignedAuthorization = {
  from: string;
  to: string;
  value: string;
  validAfter: string;
  validBefore: string;
  nonce: string;
};

export type PaymentPayload = {
  x402Version: number;
  scheme: string;
  network: string;
  payload: { signature: string; authorization: SignedAuthorization };
};

export type SettlementReceipt = {
  success: boolean;
  transaction: string;
  network: string;
  payer: string;
};

function fromBase64(value: string) {
  // The wire carries base64; browsers only give us `atob`.
  return decodeURIComponent(
    atob(value)
      .split("")
      .map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, "0")}`)
      .join(""),
  );
}

export function decodePaymentHeader(header: string): PaymentPayload {
  return JSON.parse(fromBase64(header));
}

export function decodeSettlement(header: string): SettlementReceipt {
  return JSON.parse(fromBase64(header));
}

/* --------------------------------------------------------------- helpers */

function prettyJson(text: string) {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

function elide(text: string, max = 96) {
  return text.length <= max ? text : `${text.slice(0, max)}…`;
}

const STATUS_TEXT: Record<number, string> = {
  200: "OK",
  400: "Bad Request",
  402: "Payment Required",
  429: "Too Many Requests",
  500: "Internal Server Error",
  502: "Bad Gateway",
};

export function statusLine(status: number) {
  return `HTTP/1.1 ${status} ${STATUS_TEXT[status] ?? ""}`.trimEnd();
}

function relativeSeconds(unix: string, from: number) {
  const delta = Number(unix) - from;
  const sign = delta < 0 ? "−" : "+";
  return `now ${sign}${Math.abs(delta)}s`;
}

/* ---------------------------------------------------------------- builders */

export function requestStep(opts: {
  at: number;
  url: string;
  body: string;
}): WireStep {
  const { host, pathname } = new URL(opts.url);
  return {
    n: 1,
    id: "request",
    title: `POST ${pathname}`,
    side: "out",
    at: opts.at,
    lines: [
      { k: "start", text: `POST ${pathname} HTTP/1.1` },
      { k: "kv", key: "host", value: host },
      { k: "kv", key: "content-type", value: "application/json" },
      { k: "kv", key: "accept", value: "application/json" },
      { k: "gap" },
      { k: "raw", text: prettyJson(opts.body) },
    ],
  };
}

export function paywallStep(opts: {
  at: number;
  dur: number;
  paywall: Paywall;
}): WireStep {
  const accept = opts.paywall.accepts[0];
  const lines: WireLine[] = [
    { k: "start", text: statusLine(402), code: 402 },
    { k: "kv", key: "content-type", value: "application/json" },
    { k: "gap" },
    { k: "label", text: "accepts[0]" },
  ];

  if (accept) {
    lines.push(
      { k: "kv", key: "scheme", value: accept.scheme },
      { k: "kv", key: "network", value: accept.network },
      {
        k: "kv",
        key: "maxAmountRequired",
        value: accept.maxAmountRequired,
        note: formatUsd(usdcToUsd(accept.maxAmountRequired)),
        money: true,
      },
      {
        k: "kv",
        key: "asset",
        value: short(accept.asset, 10, 6),
        note: accept.extra?.name ?? "ERC-20",
      },
      { k: "kv", key: "payTo", value: short(accept.payTo, 10, 6) },
      {
        k: "kv",
        key: "maxTimeoutSeconds",
        value: String(accept.maxTimeoutSeconds),
      },
    );
  } else {
    lines.push({ k: "raw", text: "accepts[] was empty" });
  }

  return {
    n: 2,
    id: "paywall",
    title: "402 Payment Required",
    side: "in",
    at: opts.at,
    dur: opts.dur,
    lines,
  };
}

export function signingStep(opts: {
  at: number;
  dur: number;
  payment: PaymentPayload;
  requirement?: PaymentRequirement;
}): WireStep {
  const auth = opts.payment.payload.authorization;
  const signedAt = Math.floor(Date.now() / 1000);
  const asset = opts.requirement?.asset;

  return {
    n: 3,
    id: "sign",
    title: "Sign authorization",
    side: "local",
    at: opts.at,
    dur: opts.dur,
    lines: [
      { k: "label", text: "EIP-712 · TransferWithAuthorization" },
      {
        k: "kv",
        key: "domain.name",
        value: opts.requirement?.extra?.name ?? "USDC",
      },
      {
        k: "kv",
        key: "domain.version",
        value: opts.requirement?.extra?.version ?? "2",
      },
      { k: "kv", key: "domain.chainId", value: String(CHAIN_ID) },
      ...(asset
        ? ([
            {
              k: "kv",
              key: "verifyingContract",
              value: short(asset, 10, 6),
            },
          ] as WireLine[])
        : []),
      { k: "gap" },
      { k: "kv", key: "from", value: short(auth.from, 10, 6), note: "you" },
      { k: "kv", key: "to", value: short(auth.to, 10, 6), note: "gateway" },
      {
        k: "kv",
        key: "value",
        value: auth.value,
        note: formatUsd(usdcToUsd(auth.value)),
        money: true,
      },
      {
        k: "kv",
        key: "validAfter",
        value: auth.validAfter,
        note: relativeSeconds(auth.validAfter, signedAt),
      },
      {
        k: "kv",
        key: "validBefore",
        value: auth.validBefore,
        note: relativeSeconds(auth.validBefore, signedAt),
      },
      { k: "kv", key: "nonce", value: short(auth.nonce, 10, 6) },
      { k: "gap" },
      {
        k: "kv",
        key: "signature",
        value: short(opts.payment.payload.signature, 12, 8),
        note: "65 bytes · no transaction sent, no gas spent",
      },
    ],
  };
}

export function retryStep(opts: {
  at: number;
  url: string;
  header: string;
}): WireStep {
  const { pathname } = new URL(opts.url);
  return {
    n: 4,
    id: "retry",
    title: "Retry with x-payment",
    side: "out",
    at: opts.at,
    lines: [
      { k: "start", text: `POST ${pathname} HTTP/1.1` },
      { k: "kv", key: "content-type", value: "application/json" },
      {
        k: "kv",
        key: "x-payment",
        value: `${opts.header.length} bytes, base64`,
      },
      { k: "raw", text: elide(opts.header, 220) },
    ],
  };
}

export function settledStep(opts: {
  at: number;
  dur: number;
  status: number;
  settlement?: SettlementReceipt;
  settlementHeader?: string;
}): WireStep {
  const lines: WireLine[] = [
    { k: "start", text: statusLine(opts.status), code: opts.status },
    { k: "kv", key: "content-type", value: "application/json" },
  ];

  if (opts.settlementHeader) {
    lines.push({
      k: "kv",
      key: "x-payment-response",
      value: `${opts.settlementHeader.length} bytes, base64`,
    });
  }

  if (opts.settlement) {
    lines.push(
      { k: "gap" },
      { k: "label", text: "x-payment-response · decoded" },
      { k: "kv", key: "success", value: String(opts.settlement.success) },
      { k: "kv", key: "network", value: opts.settlement.network },
      { k: "kv", key: "payer", value: short(opts.settlement.payer, 10, 6) },
      {
        k: "kv",
        key: "transaction",
        value: short(opts.settlement.transaction, 12, 8),
        note: "view on basescan",
        href: txUrl(opts.settlement.transaction),
      },
    );
  } else {
    lines.push(
      { k: "gap" },
      {
        k: "raw",
        text:
          "No x-payment-response header on this response — the gateway did " +
          "not report a settlement.",
      },
    );
  }

  return {
    n: 5,
    id: "settled",
    title: opts.settlement?.success
      ? `${opts.status} · settled onchain`
      : statusLine(opts.status).replace("HTTP/1.1 ", ""),
    side: "in",
    at: opts.at,
    dur: opts.dur,
    failed: opts.status >= 400,
    lines,
  };
}

/** The retry came back 402 — verification or settlement was refused. */
export function rejectedStep(opts: {
  at: number;
  dur: number;
  paywall: Paywall;
}): WireStep {
  return {
    n: 5,
    id: "rejected",
    title: "402 Payment Required",
    side: "in",
    at: opts.at,
    dur: opts.dur,
    failed: true,
    lines: [
      { k: "start", text: statusLine(402), code: 402 },
      { k: "kv", key: "content-type", value: "application/json" },
      { k: "gap" },
      {
        k: "raw",
        text:
          opts.paywall.error ??
          "The facilitator rejected the signed authorization.",
      },
    ],
  };
}

export const WIRE_NETWORK = NETWORK;
