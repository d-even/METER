import { paymentMiddleware } from "x402-next";
import { PAY_TO } from "@/lib/constants";

// Sits in front of /api/v1/chat: answers 402 with the price, verifies the
// signed authorization on the retry, and settles it onchain before the
// response goes out.
export const proxy = paymentMiddleware(
  PAY_TO as `0x${string}`,
  {
    "/api/v1/chat": {
      price: "$0.001",
      network: "base-sepolia",
      config: {
        description: "Pay-per-call LLM access",
      },
    },
  },
  {
    url: "https://x402.org/facilitator",
  },
);

export const config = {
  matcher: ["/api/v1/chat"],
};
