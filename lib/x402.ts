import { NETWORK, USDC, PAY_TO } from "./constants";

export function build402(maxAmount: string, resource: string) {
  const requirements = {
    x402Version: 2,
    accepts: [{
      scheme: "exact",
      network: NETWORK,
      asset: USDC,
      payTo: PAY_TO,
      maxAmountRequired: maxAmount,
      resource,
      description: "Pay-per-call LLM access",
      maxTimeoutSeconds: 60,
    }],
  };

  const encoded = Buffer.from(JSON.stringify(requirements)).toString("base64");

  return new Response(JSON.stringify(requirements), {
    status: 402,
    headers: {
      "Content-Type": "application/json",
      "PAYMENT-REQUIRED": encoded,
    },
  });
}