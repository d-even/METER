"use client";

import { useState, useRef, useEffect } from "react";
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
  "Say hi in 5 words",
  "Explain HTTP 402 in one sentence",
  "Write a haiku about micropayments",
];

export default function Playground() {
  const [prompt, setPrompt] = useState(PRESETS[0]);
  const [steps, setSteps] = useState<Step[]>([]);
  const [done, setDone] = useState<Done | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const wireRef = useRef<HTMLDivElement>(null);

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

  async function run() {
    if (busy || !prompt.trim()) return;
    setBusy(true);
    setSteps([]);
    setDone(null);
    setError(null);
    setElapsed(0);

    try {
      const res = await fetch("/api/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      if (!res.body) throw new Error("no stream from /api/demo");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      for (;;) {
        const { value, done: finished } = await reader.read();
        if (finished) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          const msg = JSON.parse(line);
          if (msg.type === "step") setSteps((s) => [...s, msg.data]);
          if (msg.type === "done") setDone(msg.data);
          if (msg.type === "error") setError(msg.data.message);
        }
      }
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
          <span className="net"><i />Base Sepolia · testnet</span>
          <a className="ghost" href="/">← Back</a>
        </div>
      </header>

      <main className="grid">
        {/* ---- left: compose ---- */}
        <section className="col compose">
          <div className="panel">
            <div className="phead"><span className="ptitle">Request</span></div>

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

              <label htmlFor="m" style={{ marginTop: 18 }}>Model</label>
              <select id="m" disabled={busy}>
                <option>llama-3.3-70b-versatile</option>
                <option>llama-3.1-8b-instant</option>
              </select>
            </div>

            <button className="send" onClick={run} disabled={busy}>
              <span>{busy ? "Paying…" : "Send request"}</span>
              <small>max $0.001</small>
            </button>

            <p className="fine">
              Paid by a throwaway server wallet on testnet. No real funds, nothing stored.
            </p>
          </div>

          <div className="panel meta">
            <div className="metarow"><span>Scheme</span><b>exact · eip-3009</b></div>
            <div className="metarow"><span>Asset</span><b>USDC</b></div>
            <div className="metarow"><span>Chain</span><b>eip155:84532</b></div>
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
                <div className="waiting"><i /><i /><i /></div>
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
              <div className="phead"><span className="ptitle">Ledger</span></div>

              <div className="ledger">
                <div className="cell">
                  <span className="ck">Authorized</span>
                  <span className="cv">${done.authorized}</span>
                  <em>ceiling that was signed</em>
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
                <div className="bartrack"><i style={{ width: `${pct}%` }} /></div>
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