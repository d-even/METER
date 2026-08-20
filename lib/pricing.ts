// USD per 1 million tokens
const RATES = {
  "openai/gpt-oss-20b": { input: 0.10, output: 0.50 },
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