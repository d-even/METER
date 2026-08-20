"use client";

import { useState, useRef, useEffect } from "react";
import { useAccount, useConnect, useSwitchChain, useWalletClient } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { publicActions } from "viem";
import { wrapFetchWithPayment } from "x402-fetch";
import "./playground.css";

type Step = { dir: string; cls: "up" | "down"; line: string; ms: string; hdrs: string[] };
type Done = {
  total: string;
  authorized: string;
  charged: number;
  usage: { prompt_tokens: number; completion_tokens: number } | null;
  content: string;
  txHref: string | null;
};

const PRESETS = [
  "Know about x402",
  "Help me in study",
  "Write a haiku about micropayments",
];

function decodeReceipt(raw: string | null) {
  if (!raw) return null;
  try {
    return JSON.parse(atob(raw));
  } catch {
    return null;
  }
}

function shortAddr(v?: string) {
  if (!v) return "—";
  return `${v.slice(0, 6)}…${v.slice(-4)}`;
}

export default function Playground() {
  const [prompt, setPrompt] = useState(PRESETS[0]);
  const [steps, setSteps] = useState<Step[]>([]);
  const [done, setDone] = useState<Done | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [mounted, setMounted] = useState(false);
  const wireRef = useRef<HTMLDivElement>(null);

  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors } = useConnect();
  const { switchChain } = useSwitchChain();
  const { data: walletClient } = useWalletClient();
  const ready = mounted && isConnected;
  const wrongChain = ready && chainId !== baseSepolia.id;

  /* live timer while the request is in flight */
  useEffect(() => {
    if (!busy) return;
    const t0 = Date.now();
    const id = setInterval(() => setElapsed(Date.now() - t0), 50);
    return () => clearInterval(id);
  }, [busy]);

  useEffect(() => {
    wireRef.current?.scrollTo({ top: 99999, behavior: "smooth" });
  }, [steps]);

  useEffect(() => {
    setMounted(true);
  }, []);

  async function run() {
    if (busy || !walletClient) return;
    setBusy(true);
    setSteps([]);
    setDone(null);
    setError(null);
    setElapsed(0);

    const t0 = Date.now();
    const ms = () => `${Date.now() - t0}ms`;
    const push = (s: Step) => setSteps((prev) => [...prev, s]);
    const wallet = walletClient.extend(publicActions) as Parameters<
      typeof wrapFetchWithPayment
    >[1];

    const body = JSON.stringify({
      messages: [{ role: "user", content: prompt }],
    });

    try {
      /* step 1 — unpaid probe, so the real 402 can be shown */
      push({
        dir: "→",
        cls: "up",
        line: "POST /api/v1/chat <k>HTTP/1.1</k>",
        ms: ms(),
        hdrs: ["<k>content-type:</k> application/json"],
      });

      const probe = await fetch("/api/v1/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      const challenge = await probe.json();
      const a = challenge?.accepts?.[0] ?? {};
      const price = (Number(a.maxAmountRequired ?? 0) / 1e6).toFixed(6);

      push({
        dir: "←",
        cls: "down",
        line: `<span class="status">${probe.status}</span> Payment Required`,
        ms: ms(),
        hdrs: [
          `<k>price:</k> <span class="amt">${price} USDC</span>`,
          `<k>network:</k> ${a.network ?? "—"}`,
          `<k>pay-to:</k> ${shortAddr(a.payTo)}`,
          `<k>scheme:</k> ${a.scheme ?? "—"} · eip-3009`,
        ],
      });

      /* step 2 — wallet signs (MetaMask popup happens here) */
      push({
        dir: "⚿",
        cls: "up",
        line: "Signing authorization <k>in wallet</k>",
        ms: ms(),
        hdrs: [
          "<k>typed-data:</k> TransferWithAuthorization",
          `<k>signer:</k> ${shortAddr(address)}`,
        ],
      });

      const fetchWithPay = wrapFetchWithPayment(fetch, wallet);

      const paid = await fetchWithPay("/api/v1/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });

      const result = await paid.json();
      const receipt = decodeReceipt(paid.headers.get("x-payment-response"));
      const txHref = receipt?.transaction
        ? `https://sepolia.basescan.org/tx/${receipt.transaction}`
        : null;

      push({
        dir: "←",
        cls: "down",
        line: `<span class="status ok">${paid.status}</span> OK <k>· settled onchain</k>`,
        ms: ms(),
        hdrs: [
          `<k>charged:</k> <span class="amt">${
            result?.cost?.finalCost?.toFixed(6) ?? "—"
          } USDC</span>`,
          txHref ? "<k>tx:</k> settled onchain" : "<k>tx:</k> —",
        ],
      });

      setDone({
        total: ms(),
        authorized: price,
        charged: result?.cost?.finalCost ?? 0,
        usage: result?.usage ?? null,
        content: result?.content ?? "",
        txHref,
      });
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  const pct = done ? Math.min(100, (done.charged / Number(done.authorized)) * 100) : 0;
  const multiple = done && done.charged > 0 ? Math.round(0.3 / done.charged) : null;

  return (
    <div className="pg">
      {/* ---- top bar ---- */}
      <header className="bar">
        <a className="brand" href="/">
          <span className="tick" />
          METER
          <span className="sep">/</span>
          <span className="where">playground</span>
        </a>

        <div className="barright">
          <span className="net">
            <i />
            Base Sepolia · testnet
          </span>

          {ready ? (
            <span className="wallet">{shortAddr(address)}</span>
          ) : (
            <button
              className="connect"
              onClick={() => connect({ connector: connectors[0] })}
            >
              Connect wallet
            </button>
          )}
        </div>
      </header>

      <main className="grid">
        {/* ---- left: compose ---- */}
        <section className="col compose">
          <div className="panel">
            <div className="phead">
              <span className="ptitle">Request</span>
            </div>

            <div className="pbody">
              <label htmlFor="p">Prompt</label>
              <textarea
                id="p"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) run();
                }}
                spellCheck={false}
                disabled={busy}
                rows={4}
              />

              <div className="presets">
                {PRESETS.map((p) => (
                  <button
                    key={p}
                    className={`preset${p === prompt ? " on" : ""}`}
                    onClick={() => setPrompt(p)}
                    disabled={busy}
                  >
                    {p.length > 26 ? p.slice(0, 26) + "…" : p}
                  </button>
                ))}
              </div>

              <label htmlFor="m" style={{ marginTop: 18 }}>
                Model
              </label>
              <select id="m" disabled={busy}>
                <option>openai/gpt-oss-20b</option>
                <option>llama-3.1-8b-instant</option>
              </select>
            </div>

            {/* one button, three states */}
            {!ready ? (
              <button
                className="send"
                onClick={() => connect({ connector: connectors[0] })}
              >
                <span>Connect wallet</span>
                <small>to pay per call</small>
              </button>
            ) : wrongChain ? (
              <button
                className="send"
                onClick={() => switchChain({ chainId: baseSepolia.id })}
              >
                <span>Switch to Base Sepolia</span>
                <small>wrong network</small>
              </button>
            ) : (
              <button className="send" onClick={run} disabled={busy}>
                <span>{busy ? "Paying…" : "Send request"}</span>
                <small>max $0.001</small>
              </button>
            )}

            <p className="fine">
              Your wallet signs each call on Base Sepolia. Testnet only — no real
              funds, nothing stored.{" "}
              <a href="https://faucet.circle.com" target="_blank" rel="noreferrer">
                Need test USDC?
              </a>
            </p>
          </div>

          <div className="panel meta">
            <div className="metarow">
              <span>Scheme</span>
              <b>exact · eip-3009</b>
            </div>
            <div className="metarow">
              <span>Asset</span>
              <b>USDC</b>
            </div>
            <div className="metarow">
              <span>Chain</span>
              <b>eip155:84532</b>
            </div>
          </div>
        </section>

        {/* ---- right: transcript + ledger ---- */}
        <section className="col">
          <div className="panel">
            <div className="phead">
              <span className="ptitle">Wire transcript</span>
              <span className="ptime">
                {done ? done.total : busy ? `${(elapsed / 1000).toFixed(2)}s` : ""}
              </span>
            </div>

            <div className="wire" ref={wireRef}>
              {steps.length === 0 && !error && (
                <div className="idle">
                  <div className="pulse" />
                  Nothing on the wire yet
                  <span>send a request to watch the 402 handshake</span>
                </div>
              )}

              {steps.map((s, i) => (
                <div key={i}>
                  {i > 0 && <div className="rule" />}
                  <div className={`hop ${s.cls}`}>
                    <div className="dir">{s.dir}</div>
                    <div className="hopbody">
                      <div className="l1">
                        <span className="ms">{s.ms}</span>
                        <span dangerouslySetInnerHTML={{ __html: s.line }} />
                      </div>
                      <ul className="hdrs">
                        {s.hdrs.map((h, j) => (
                          <li key={j} dangerouslySetInnerHTML={{ __html: h }} />
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ))}

              {busy && steps.length > 0 && !done && (
                <div className="waiting">
                  <i />
                  <i />
                  <i />
                </div>
              )}

              {error && (
                <div className="err">
                  <b>Request failed</b>
                  {error}
                </div>
              )}
            </div>
          </div>

          {done && (
            <div className="panel ledger-panel">
              <div className="phead">
                <span className="ptitle">Ledger</span>
              </div>

              <div className="ledger">
                <div className="cell">
                  <span className="ck">Authorized</span>
                  <span className="cv">${done.authorized}</span>
                  <em>ceiling you signed</em>
                </div>
                <div className="cell">
                  <span className="ck">Actually charged</span>
                  <span className="cv money">${done.charged.toFixed(6)}</span>
                  <em>
                    {done.usage
                      ? `${done.usage.prompt_tokens} in · ${done.usage.completion_tokens} out`
                      : "—"}
                  </em>
                </div>
                <div className="cell">
                  <span className="ck">Card network floor</span>
                  <span className="cv">$0.300000</span>
                  <em>{multiple ? `${multiple.toLocaleString()}× the sale` : "—"}</em>
                </div>
              </div>

              <div className="barwrap">
                <div className="bartrack">
                  <i style={{ width: `${pct}%` }} />
                </div>
                <span className="barlabel">{pct.toFixed(1)}% of ceiling used</span>
              </div>

              {done.txHref && (
                <a className="txrow" href={done.txHref} target="_blank" rel="noreferrer">
                  <span className="ck">Settlement</span>
                  <span>View on BaseScan ↗</span>
                </a>
              )}

              <div className="answer">
                <span className="ck">Response</span>
                <p>{done.content}</p>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}