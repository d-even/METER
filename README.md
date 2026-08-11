# Meter

A pay-per-call AI API gateway built on [x402](https://x402.org), running on Base
Sepolia. A prompt goes out unpaid, the gateway answers `402 Payment Required`
with a price, the wallet signs a USDC authorization offline, the request
retries carrying that authorization, and the facilitator settles it onchain —
all inside a single round trip.

The frontend exists to make that sequence legible. The right-hand panel prints
each step as raw HTTP the moment it actually happens; none of it is scripted or
replayed.

## Running it

```bash
npm install
npm run dev
```

Then open http://localhost:3000, connect a browser wallet on Base Sepolia, and
send a prompt.

### Environment

Create `.env.local`:

```bash
LLM_API_KEY=...           # OpenAI-compatible key (Groq, etc.)
LLM_BASE_URL=...          # e.g. https://api.groq.com/openai/v1
NEXT_PUBLIC_RPC_URL=...   # optional — only used to read the USDC balance
DEV_PRIVATE_KEY=0x...     # optional — only for scripts/pay.ts
```

### Funding a wallet

The wallet needs Base Sepolia USDC to settle. Without it the authorization is
still signed, but the facilitator refuses it with `insufficient_funds`.

- USDC: https://faucet.circle.com
- ETH (not needed to pay, only if you want to transact): https://portal.cdp.coinbase.com/products/faucet

### A note on localhost

The hosted facilitator at `x402.org` has to reach your `resource` URL. Running
against `http://localhost:3000` means it cannot, and settlement fails with an
opaque error. Expose the dev server (a tunnel) or deploy it to see step 5
return a transaction hash.

## Layout

```
proxy.ts                  x402 paywall in front of /api/v1/chat
app/api/v1/chat/route.ts  the metered LLM call
lib/models.ts             model catalog + rates, shared by server and client
lib/pricing.ts            cost from real token counts, plus markup
lib/chain.ts              network, USDC, explorer and faucet constants
lib/wire.ts               turns observed HTTP into transcript steps
lib/useMeteredCall.ts     taps the fetch x402-fetch drives, records each event
app/components/           the console UI
scripts/pay.ts            headless payer, for testing without a browser
```

### How the transcript stays honest

`x402-fetch` handles the 402 internally, so the UI wraps the `fetch` it drives
rather than reimplementing the protocol. Every step is built from something
observed: the request bodies as sent, the 402 payload as received, the signed
`x-payment` header decoded back into its EIP-712 fields, and the
`x-payment-response` header decoded into the settlement receipt. Timings are
measured, not simulated.

## Ledger

Three figures sit under the transcript:

- **Authorized** — the ceiling the wallet signed, read off the 402.
- **Metered** — computed from the token counts the model reported.
- **Card network floor** — $0.30, for scale.

The `exact` scheme transfers the authorized amount, so authorized is what
moves; metered is what the tokens were actually worth.
