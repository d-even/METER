import { config } from "dotenv";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { wrapFetchWithPayment } from "x402-fetch";
import { baseSepolia } from "viem/chains";

config({ path: ".env.local" });

const account = privateKeyToAccount(
  process.env.DEV_PRIVATE_KEY as `0x${string}`
);

const client = createWalletClient({
  account,
  transport: http(),
  chain: baseSepolia,
});

const fetchWithPay = wrapFetchWithPayment(fetch, client);

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