// Shared model catalog. Imported by the route handler (to validate the
// requested model) and by the UI (to render the dropdown), so the two can
// never drift apart.

export const MARKUP = 1.2; // 20% — what running the gateway costs

export const MODELS = [
  {
    id: "llama-3.3-70b-versatile",
    note: "70B · higher quality",
    // USD per 1M tokens
    rates: { input: 0.59, output: 0.79 },
  },
  {
    id: "llama-3.1-8b-instant",
    note: "8B · lowest latency",
    rates: { input: 0.05, output: 0.08 },
  },
] as const;

export type ModelId = (typeof MODELS)[number]["id"];

export const DEFAULT_MODEL: ModelId = "llama-3.3-70b-versatile";

export function isModelId(value: unknown): value is ModelId {
  return MODELS.some((m) => m.id === value);
}

export function ratesFor(model: ModelId) {
  return MODELS.find((m) => m.id === model)!.rates;
}
