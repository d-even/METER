import { config } from "dotenv";
import { createWalletClient, http, publicActions } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { wrapFetchWithPayment } from "x402-fetch";

config({ path: ".env.local" });

const account = privateKeyToAccount(
  process.env.DEV_PRIVATE_KEY as `0x${string}`
);

const client = createWalletClient({
  account,
  transport: http(),
  chain: baseSepolia,
}).extend(publicActions);

const fetchWithPay = wrapFetchWithPayment(
  fetch,
  client as Parameters<typeof wrapFetchWithPayment>[1]
);

async function main() {
  const res = await fetchWithPay("http://localhost:3000/api/v1/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [{ role: "user", content: "Capital of india" }],
    }),
  });

  console.log("STATUS:", res.status);
  console.log("BODY:", await res.json());
}

main().catch(console.error);