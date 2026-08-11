import { config } from "dotenv";
import { createWalletClient, http, publicActions } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { type Signer, wrapFetchWithPayment } from "x402-fetch";
import { baseSepolia } from "viem/chains";

config({ path: ".env.local" });

const account = privateKeyToAccount(
  process.env.DEV_PRIVATE_KEY as `0x${string}`
);

// x402-fetch wants a client with both wallet and public actions.
const client = createWalletClient({
  account,
  transport: http(),
  chain: baseSepolia,
}).extend(publicActions);

// x402 types its signer against viem's generic `Chain`, which is invariant
// against a client pinned to a concrete chain. The shape is what it wants.
const fetchWithPay = wrapFetchWithPayment(fetch, client as unknown as Signer);

async function main() {
  const res = await fetchWithPay("http://localhost:3000/api/v1/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [{ role: "user", content: "Say hi in 5 words" }],
    }),
  });

  console.log("STATUS:", res.status);
  console.log("BODY:", await res.json());
}

main().catch(console.error);