import OpenAI from "openai";
import { calculateCost } from "@/lib/pricing";
import { DEFAULT_MODEL, MODELS, isModelId } from "@/lib/models";

export async function POST(req: Request) {
  const client = new OpenAI({
    apiKey: process.env.LLM_API_KEY,
    baseURL: process.env.LLM_BASE_URL,
  });

  try {
    const { messages, model: requested } = await req.json();

    if (!Array.isArray(messages) || messages.length === 0) {
      return Response.json(
        { error: "messages must be a non-empty array" },
        { status: 400 },
      );
    }

    const model = requested === undefined ? DEFAULT_MODEL : requested;
    if (!isModelId(model)) {
      return Response.json(
        {
          error: `Unknown model "${model}". Supported: ${MODELS.map((m) => m.id).join(", ")}`,
        },
        { status: 400 },
      );
    }

    const completion = await client.chat.completions.create({
      model,
      messages,
      max_tokens: 500,
    });

    const usage = completion.usage;
    if (!usage) {
      return Response.json({ error: "no usage data" }, { status: 502 });
    }

    const cost = calculateCost(
      model,
      usage.prompt_tokens,
      usage.completion_tokens,
    );

    return Response.json({
      content: completion.choices[0].message.content,
      model,
      usage,
      cost,
    });
  } catch (err) {
    console.error("ERR:", err);
    return Response.json({ error: String(err) }, { status: 502 });
  }
}
