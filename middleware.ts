import { paymentMiddleware } from "x402-next";

export const middleware = paymentMiddleware(
  "0x30e77463369433E6D3d33873C1CCD965ca308440",  // aapka PAY_TO
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
  }
);

export const config = {
  matcher: ["/api/v1/chat"],
};