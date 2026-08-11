import { MARKUP, isModelId, ratesFor } from "./models";

export function calculateCost(
  model: string,
  promptTokens: number,
  completionTokens: number,
) {
  if (!isModelId(model)) throw new Error(`Unknown model: ${model}`);
  const rate = ratesFor(model);

  const inputCost = (promptTokens / 1_000_000) * rate.input;
  const outputCost = (completionTokens / 1_000_000) * rate.output;
  const baseCost = inputCost + outputCost;

  return {
    baseCost,
    finalCost: baseCost * MARKUP,
  };
}

// $0.0000366 → "37" (micro-USDC, integer)
export function toAtomic(usd: number): string {
  return Math.ceil(usd * 1_000_000).toString();
}
