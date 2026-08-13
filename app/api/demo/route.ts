import { createWalletClient, http, publicActions } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { wrapFetchWithPayment } from "x402-fetch";

export const runtime = "nodejs";

type Step = {
  dir: string;
  cls: "up" | "down";
  line: string;
  ms: string;
  hdrs: string[];
};

export async function POST(req: Request) {
  const { prompt } = await req.json();

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (type: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(JSON.stringify({ type, data }) + "\n")
        );
      };

      const t0 = Date.now();
      const since = () => `${Date.now() - t0}ms`;

      try {
        const account = privateKeyToAccount(
          process.env.DEV_PRIVATE_KEY as `0x${string}`
        );

        const wallet = createWalletClient({
          account,
          chain: baseSepolia,
          transport: http(),
        }).extend(publicActions);

        const origin = new URL(req.url).origin;
        const target = `${origin}/api/v1/chat`;
        const body = JSON.stringify({
          messages: [{ role: "user", content: prompt }],
        });

        // --- step 1: unpaid probe, so we can show the real 402 ---
        send("step", {
          dir: "→",
          cls: "up",
          line: 'POST /api/v1/chat <k>HTTP/1.1</k>',
          ms: since(),
          hdrs: [
            "<k>content-type:</k> application/json",
            `<k>content-length:</k> ${body.length}`,
          ],
        } satisfies Step);

        const probe = await fetch(target, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        });

        const challenge = await probe.json();
        const accepts = challenge?.accepts?.[0] ?? {};
        const atomic = Number(accepts.maxAmountRequired ?? 0);
        const priceUsd = (atomic / 1_000_000).toFixed(6);

        send("step", {
          dir: "←",
          cls: "down",
          line: `<span class="status">${probe.status}</span> Payment Required`,
          ms: since(),
          hdrs: [
            `<k>payment-required:</k> <span class="amt">${priceUsd} USDC</span>`,
            `<k>network:</k> ${accepts.network ?? "—"}`,
            `<k>pay-to:</k> ${short(accepts.payTo)}`,
            `<k>scheme:</k> ${accepts.scheme ?? "—"} · eip-3009`,
          ],
        } satisfies Step);

        // --- step 2: sign ---
        send("step", {
          dir: "⚿",
          cls: "up",
          line: "Signing authorization <k>locally</k>",
          ms: since(),
          hdrs: [
            "<k>typed-data:</k> TransferWithAuthorization",
            `<k>valid-before:</k> +${accepts.maxTimeoutSeconds ?? 60}s`,
            `<k>signer:</k> ${short(account.address)}`,
          ],
        } satisfies Step);

        // --- step 3+4: paid request ---
        const fetchWithPay = wrapFetchWithPayment(
          fetch,
          wallet as Parameters<typeof wrapFetchWithPayment>[1]
        );

        send("step", {
          dir: "→",
          cls: "up",
          line: "POST /api/v1/chat <k>retry with payment</k>",
          ms: since(),
          hdrs: ["<k>x-payment:</k> <span class=\"dimtrunc\">signed payload…</span>"],
        } satisfies Step);

        const paid = await fetchWithPay(target, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        });

        const result = await paid.json();
        const receiptRaw = paid.headers.get("x-payment-response");
        const receipt = decodeReceipt(receiptRaw);

        const txHref = receipt?.transaction
          ? `https://sepolia.basescan.org/tx/${receipt.transaction}`
          : null;

        send("step", {
          dir: "←",
          cls: "down",
          line: `<span class="status ok">${paid.status}</span> OK <k>· settled onchain</k>`,
          ms: since(),
          hdrs: [
            `<k>x-payment-response:</k> ${receipt?.success ? "success" : "—"}`,
            `<k>charged:</k> <span class="amt">${fmt(result?.cost?.finalCost)} USDC</span>`,
            txHref
              ? `<k>tx:</k> <a class="tx" href="${txHref}" target="_blank" rel="noreferrer">${short(receipt.transaction)} ↗</a>`
              : "<k>tx:</k> —",
          ],
        } satisfies Step);

        send("done", {
          total: since(),
          authorized: priceUsd,
          charged: result?.cost?.finalCost ?? 0,
          usage: result?.usage ?? null,
          content: result?.content ?? "",
          txHref,
        });
      } catch (err) {
        send("error", { message: String(err) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-store",
    },
  });
}

function short(v?: string) {
  if (!v) return "—";
  return `${v.slice(0, 8)}…${v.slice(-4)}`;
}

function fmt(n?: number) {
  if (typeof n !== "number") return "—";
  return n.toFixed(6);
}

function decodeReceipt(raw: string | null) {
  if (!raw) return null;
  try {
    return JSON.parse(Buffer.from(raw, "base64").toString());
  } catch {
    return null;
  }
}