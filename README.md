# METER

**An API that charges per call, not per month.**

A pay-per-call LLM gateway built on the [x402](https://github.com/coinbase/x402) payment protocol. A client sends a request with no credentials, gets back `402 Payment Required`, signs a USDC authorization, retries, and receives the response — with settlement happening onchain in about a second.

No signup. No API key. No subscription.

> Demo runs on Base Sepolia testnet. Nothing here touches real funds.

<!-- Replace with your demo GIF or video -->
![METER demo](demo/video.mp4)

---

## Why

Card networks charge roughly $0.30 in fixed fees per transaction. A single LLM request through this gateway costs **$0.000037**.

That gap is why every API on the internet is a monthly subscription. You cannot profitably charge a third of a cent on card rails, so pricing gets bundled into plans nobody wants — and a developer who needs five API calls has to commit to a month.

Stablecoin settlement removes the floor. This project is a working demonstration of what becomes possible once it's gone.

It also matters for a second reason: an autonomous agent cannot fill in a signup form or enter a credit card. It can sign a payment inside an HTTP request.

---

## How it works

```
Client                          METER                      Facilitator
  │                               │                             │
  │──── POST /api/v1/chat ───────>│                             │
  │                               │                             │
  │<─── 402 Payment Required ─────│                             │
  │     price, chain, asset,      │                             │
  │     payTo, scheme             │                             │
  │                               │                             │
  │ sign EIP-3009 authorization   │                             │
  │ (local, no gas, no tx yet)    │                             │
  │                               │                             │
  │──── POST + X-PAYMENT ────────>│                             │
  │                               │──── verify + settle ───────>│
  │                               │<─── tx hash ────────────────│
  │<─── 200 OK + response ────────│                             │
```

1. **Ask** — client hits the endpoint with no credentials at all.
2. **Get a price** — server responds `402` with the amount, chain (`eip155:84532`), token (USDC), and destination address.
3. **Sign** — the wallet signs an EIP-3009 `TransferWithAuthorization` locally. No transaction is broadcast yet.
4. **Settle** — the retry carries the signature. The facilitator verifies and settles onchain, then the LLM response is returned.

Cost is computed from actual token usage, so a short call bills like a short call.

---

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router), TypeScript |
| Payment protocol | x402 (`x402-next`, `x402-fetch`) |
| Chain | Base Sepolia |
| Asset | USDC (EIP-3009) |
| Inference | Groq (Llama 3.3 70B) |
| Wallet / signing | viem |

---

## Project structure

```
app/
├── page.tsx                 landing page
├── playground/
│   └── page.tsx             live payment flow UI
└── api/
    ├── v1/chat/route.ts     the paid endpoint
    └── demo/route.ts        server-side payer, streams each step to the UI
lib/
├── pricing.ts               token usage → USD → atomic USDC
├── x402.ts                  402 challenge construction (reference)
└── constants.ts             addresses, chain config
proxy.ts                     payment middleware guarding /api/v1/chat
scripts/
└── pay.ts                   CLI client that pays for a call
```

---

## Running locally

**Prerequisites:** Node 20+, a wallet with Base Sepolia ETH and USDC.

```bash
git clone https://github.com/YOUR_USERNAME/meter
cd meter
npm install
```

Create `.env.local` in the project root:

```
LLM_API_KEY=your_groq_key
LLM_BASE_URL=https://api.groq.com/openai/v1
DEV_PRIVATE_KEY=0x...        # throwaway wallet, testnet funds only
```

```bash
npm run dev
```

Open `http://localhost:3000/playground`.

To pay for a call from the command line instead:

```bash
npx tsx scripts/pay.ts
```

### Getting testnet funds

- **ETH** — [Coinbase faucet](https://portal.cdp.coinbase.com/products/faucet)
- **USDC** — [Circle faucet](https://faucet.circle.com)
- USDC contract on Base Sepolia: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`

---

## Design notes

**Why the UI shows raw HTTP.** The interesting thing about this project isn't the chat response — it's that money moves inside the request. So the playground renders the actual wire exchange with headers, rather than hiding it behind a spinner.

**Authorized vs. charged.** The ledger deliberately shows both numbers. Under the `exact` scheme they're set by a fixed price, but the distinction is the foundation for usage-based billing.

**Integers, not floats.** All amounts are handled in atomic units (micro-USDC) rather than floating point. Rounding is always in the seller's favour (`Math.ceil`) so a call is never charged below cost.

---

## What's next

**Usage-based billing (`upto` scheme).** Currently the price is fixed per call. The protocol's `upto` scheme allows authorizing a ceiling and settling the actual amount — which fits LLM billing exactly, since cost depends on output tokens that aren't known until the response completes.

This wasn't shipped in the first version because `upto` uses a Permit2 witness rather than EIP-3009. EIP-3009 locks the value into the signature itself, so variable settlement isn't possible with it; Permit2 requires an additional token approval step from the payer. That's a meaningful change to the client flow, so it was scoped out of v1 rather than half-built.

**Also planned:**

- Browser wallet connection (wagmi) so anyone can pay from their own wallet, replacing the server-side dev key
- Streaming responses, with settlement on stream completion and partial settlement on disconnect
- Multi-tenant — any developer registers an endpoint, sets a price and payout address, and METER handles the 402 layer
- Open-weight model hosting, so the service is genuinely resold rather than proxied

---

## License

MIT
