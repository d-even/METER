import OpenAI from "openai";
import { calculateCost } from "@/lib/pricing";
import { build402 } from "@/lib/x402";



export async function POST(req: Request) {
  const client = new OpenAI({
    apiKey: process.env.LLM_API_KEY,
    baseURL: process.env.LLM_BASE_URL,
  });

  try {
    const { messages } = await req.json();
    // const paymentHeader = req.headers.get("PAYMENT-SIGNATURE");

    // if (!paymentHeader) {
    //   return build402("1000", "/api/v1/chat"); // max $0.001
    // }

    // // TODO: kal verify karenge
    // console.log("PAYMENT RECEIVED (unverified):", paymentHeader.slice(0, 40));

    const completion = await client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages,
      max_tokens: 500,
    });

    const usage = completion.usage;
    if (!usage) {
      return Response.json({ error: "no usage data" }, { status: 502 });
    }

    console.log("USAGE:", usage);

    const cost = calculateCost(
      "llama-3.3-70b-versatile",
      usage.prompt_tokens,
      usage.completion_tokens,
    );

    console.log("COST:", cost);

    return Response.json({
      content: completion.choices[0].message.content,
      usage: completion.usage,
      cost,
    });

    //     return Response.json({
    //       content: completion.choices[0].message.content,
    //       usage: completion.usage,
    //     });
  } catch (err) {
    console.error("ERR:", err);
    return Response.json({ error: String(err) }, { status: 502 });
  }
}
