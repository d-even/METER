import OpenAI from "openai";
import { calculateCost } from "@/lib/pricing";

const MODEL = "openai/gpt-oss-20b";

export async function POST(req: Request) {
  const client = new OpenAI({
    apiKey: process.env.LLM_API_KEY,
    baseURL: process.env.LLM_BASE_URL,
  });

  try {
    const { messages } = await req.json();

    const completion = await client.chat.completions.create({
      model: MODEL,
      messages,
      max_tokens: 500,
    });

    const usage = completion.usage;
    if (!usage) {
      return Response.json({ error: "no usage data" }, { status: 502 });
    }

    console.log("USAGE:", usage);

    const cost = calculateCost(
      MODEL,
      usage.prompt_tokens,
      usage.completion_tokens,
    );

    console.log("COST:", cost);

    return Response.json({
      content: completion.choices[0].message.content,
      usage,
      cost,
    });
  } catch (err) {
    console.error("ERR:", err);
    return Response.json({ error: String(err) }, { status: 502 });
  }
}