// USD per 1 million tokens
const RATES = {
  "llama-3.3-70b-versatile": { input: 0.59, output: 0.79 },
  "llama-3.1-8b-instant":    { input: 0.05, output: 0.08 },
} as const;

// Aapka markup — service chalane ka charge
const MARKUP = 1.2; // 20%

export function calculateCost(
  model: string,
  promptTokens: number,
  completionTokens: number
) {
  const rate = RATES[model as keyof typeof RATES];
  if (!rate) throw new Error(`Unknown model: ${model}`);

  const inputCost  = (promptTokens     / 1_000_000) * rate.input;
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