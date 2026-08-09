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
  amountRequired: maxAmount,
  resource,
  description: "Pay-per-call LLM access",
  mimeType: "application/json",
  outputSchema: {},
  maxTimeoutSeconds: 60,
  extra: { name: "USDC", version: "2" },
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




const FACILITATOR = "https://x402.org/facilitator";

export async function verifyPayment(
  paymentHeader: string,
  requirements: object
) {
  const payload = JSON.parse(
    Buffer.from(paymentHeader, "base64").toString()
  );

  console.log("DECODED PAYLOAD:", JSON.stringify(payload, null, 2));

  const res = await fetch(`${FACILITATOR}/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      x402Version: 2,
      paymentPayload: payload,
      paymentRequirements: requirements,
    }),
  });

  return res.json();  // { isValid: boolean, invalidReason?: string }
}