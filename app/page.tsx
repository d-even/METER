"use client";

import { useEffect, useRef } from "react";
import "./meter.css";

/* ---------- icons ---------- */
const ICONS = {
  screen: <svg viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="14" rx="2" /><path d="M8 21h8M12 18v3" /></svg>,
  chart: <svg viewBox="0 0 24 24"><path d="M4 18l5-6 4 4 7-9" /><path d="M4 21h16" /></svg>,
  clock: <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>,
  lines: <svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h10" /></svg>,
  window: <svg viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="14" rx="2" /><path d="M6 9h6M6 13h9" /></svg>,
  arrow: <svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></svg>,
  dollar: <svg viewBox="0 0 24 24"><path d="M12 3v18M8 7h6a3 3 0 010 6H8m0 0h7" /></svg>,
  lock: <svg viewBox="0 0 24 24"><path d="M7 11V8a5 5 0 0110 0v3" /><rect x="5" y="11" width="14" height="9" rx="2" /></svg>,
  check: <svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5" /></svg>,
  card: <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M8 14h5" /></svg>,
};

const STEPS = [
  { icon: ICONS.arrow, title: "Ask", body: "The client hits your endpoint with no credentials at all — no key, no session, no prior relationship." },
  { icon: ICONS.dollar, title: "Get a price", body: "Your server answers 402 with the amount, the chain, the token, and the address to pay." },
  { icon: ICONS.lock, title: "Sign", body: "The wallet signs a stablecoin authorization locally. No transaction yet, no gas spent guessing." },
  { icon: ICONS.check, title: "Settle", body: "The retry carries the signature. Verified and settled onchain, then the response comes back." },
  { icon: ICONS.clock, title: "Charge what it cost", body: "Price is computed from real token usage, so a short call bills like a short call." },
  { icon: ICONS.card, title: "Built for agents", body: "An autonomous client can't fill in a signup form. It can sign a payment inside a request." },
];

const WIRE = [
  { ar: "→", hot: false, html: 'POST /v1/chat <span class="dim">HTTP/1.1</span>' },
  { ar: "←", hot: true, html: '<span class="k402">402</span> Payment Required<br><span class="dim">price:</span> <span class="amt">0.001000 USDC</span>' },
  { ar: "⚿", hot: false, html: 'Signing authorization <span class="dim">· eip-3009</span>' },
  { ar: "→", hot: false, html: 'POST /v1/chat <span class="dim">retry + x-payment</span>' },
  { ar: "←", hot: true, html: '<span class="k200">200</span> OK <span class="dim">· settled onchain</span><br><span class="dim">charged:</span> <span class="amt">0.000037 USDC</span>' },
];

/* ---------- small components ---------- */

function Badge({ dot, children }: { dot?: boolean; children: React.ReactNode }) {
  return <span className="badge rv">{dot && <i />}{children}</span>;
}

function Placeholder({
  ratio, dark, label, icon, style,
}: {
  ratio: "a" | "b" | "c";
  dark?: boolean;
  label: string;
  icon: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div className={`ph ${ratio}${dark ? " dark" : ""} rv scale`} style={style}>
      <div className="cap">{icon}{label}</div>
    </div>
  );
}

/* ---------- page ---------- */

export default function Landing() {
  const pinnerRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);

  /* split headlines into words, stagger grid children */
  useEffect(() => {
    document.querySelectorAll<HTMLElement>("[data-split]").forEach((el) => {
      if (el.dataset.split === "done") return;
      el.innerHTML = el.innerHTML.replace(
        /(<em>.*?<\/em>|[^\s<]+(?:<[^>]+>)?)/g,
        (m) => (m.trim() ? `<span class="w">${m}</span>` : m)
      );
      el.dataset.split = "done";
    });

    document.querySelectorAll<HTMLElement>("[data-stagger]").forEach((box) => {
      Array.from(box.children).forEach((child, i) => {
        const el = child as HTMLElement;
        if (el.classList.contains("rv")) el.style.transitionDelay = `${i * 80}ms`;
        el.querySelectorAll<HTMLElement>(".rv").forEach((n) => {
          n.style.transitionDelay = `${i * 80}ms`;
        });
      });
    });
  }, []);

  /* reveal on scroll */
  useEffect(() => {
    const countUp = (el: HTMLElement) => {
      const end = parseFloat(el.dataset.count ?? "0");
      const dec = Number(el.dataset.dec ?? 2);
      const pre = el.dataset.pre ?? "";
      const t0 = performance.now();
      const tick = (now: number) => {
        const p = Math.min(1, (now - t0) / 1100);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = pre + (end * eased).toFixed(dec);
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target as HTMLElement;

          if (el.hasAttribute("data-split")) {
            el.classList.add("on");
            el.querySelectorAll<HTMLElement>(".w").forEach((w, i) => {
              w.style.transitionDelay = `${i * 55}ms`;
            });
          } else if (el.classList.contains("term")) {
            el.classList.add("on");
            el.querySelectorAll<HTMLElement>("[data-t]").forEach((l, i) => {
              setTimeout(() => l.classList.add("on"), 270 * i);
            });
          } else if (el.hasAttribute("data-count")) {
            countUp(el);
          } else {
            el.classList.add("on");
          }
          io.unobserve(el);
        });
      },
      { threshold: 0.16 }
    );

    document
      .querySelectorAll(".rv,[data-split],[data-count]")
      .forEach((el) => io.observe(el));

    return () => io.disconnect();
  }, []);

  /* nav shadow + wordmark shrinks as hero rises over it */
  useEffect(() => {
    let ticking = false;

    const onScroll = () => {
      navRef.current?.classList.toggle("stuck", window.scrollY > 12);
      if (ticking) return;
      ticking = true;

      requestAnimationFrame(() => {
        const hero = heroRef.current;
        const pinner = pinnerRef.current;
        if (hero && pinner) {
          const r = hero.getBoundingClientRect();
          const vh = window.innerHeight;
          const p = Math.min(1, Math.max(0, (vh - r.top) / (vh * 0.8)));
          pinner.style.transform = `scale(${1 - p * 0.14}) translateY(${-p * 46}px)`;
          pinner.style.opacity = String(1 - p * 0.9);
        }
        ticking = false;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="page">
      <nav ref={navRef}>
        <div className="nleft">
          <a href="#why">Why metered</a>
          <a href="#how">How it works</a>
          <a href="#build">Docs</a>
        </div>
        <div className="logo">
          <span className="tick" />METER</div>
        <div className="nright">
          <a href="/playground" className="pill-btn">Playground</a>
        </div>
      </nav>

      {/* ---- wordmark pin + hero riser ---- */}
      <div className="stackzone">
        <div className="pin">
          <div className="pinner" ref={pinnerRef}>
            <p className="wordmark">METER</p>
            <p className="pinsub">pay per call · not per month</p>
            <div className="scrollcue" />
          </div>
        </div>

        <div className="wrap">
          <div className="hero" ref={heroRef}>
            <div className="grabber" />
            <div>
              <Badge dot><b>402</b> Payment Required</Badge>
              <h1 className="rv" data-split>
                Your API earns <em>per call</em>, not per month.
              </h1>
              <p className="lead rv">
                No signup, no keys, no plans. A client asks, gets a price, signs,
                and asks again — settled onchain before the response arrives.
              </p>
              <div className="cta rv">
                <a href="#build" className="b1">Read the docs</a>
                <a href="/playground" className="b2">See a live call</a>
              </div>
            </div>

            <div className="herostack">
              <div className="term rv blur">
                <div className="thead">
                  <span>wire transcript</span>
                  <span>1.09s</span>
                </div>
                {WIRE.map((w, i) => (
                  <div className="tline" data-t key={i}>
                    <span className={`ar${w.hot ? " i" : ""}`}>{w.ar}</span>
                    <span dangerouslySetInnerHTML={{ __html: w.html }} />
                  </div>
                ))}
              </div>
         <img src="/assets/playground.png" alt="METER playground" className="ph c" />
            </div>
             
          </div>
        </div>
      </div>

      <div className="wrap">
        {/* ---- why ---- */}
        <section id="why">
          <div className="split">
            <div>
              <Badge>Why metered</Badge>
              <h2 data-split>The subscription was never the point.</h2>
              <p className="lead rv">
                Card networks take about thirty cents before they take a
                percentage. That floor is why every API became a monthly plan —
                not because anyone wanted one.
              </p>
             
              <img src="/assets/compare.png" alt="METER playground" className="ph a" />
            </div>

            <div className="compare rv scale">
              <div className="ccard">
                <span className="ck">Card rails</span>
                <div className="big" data-count="0.30" data-dec="2" data-pre="$">$0.30</div>
                <p>Minimum viable charge. Anything smaller loses money, so it gets bundled into a plan.</p>
                <ul>
                  <li>Account required</li>
                  <li>Monthly commitment</li>
                  <li>Refunds and churn</li>
                </ul>
              </div>
              <div className="ccard hot">
                <span className="ck">Metered rails</span>
                <div className="big" data-count="0.000037" data-dec="6" data-pre="$">$0.000037</div>
                <p>What one real request actually cost. Charged exactly, settled in about a second.</p>
                <ul>
                  <li>No account</li>
                  <li>Pay per call</li>
                  <li>Nothing to cancel</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ---- how ---- */}
        <section id="how">
          <Badge>How it works</Badge>
          <h2 data-split>Four steps, one request.</h2>
          <p className="lead rv">
            The payment lives inside the HTTP exchange. Nothing is stored,
            nothing is provisioned.
          </p>

          <div className="bento" data-stagger>
            {STEPS.map((s) => (
              <div className="bcard rv" key={s.title}>
                <div className="bico">{s.icon}</div>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </div>
            ))}
          </div>

          <div className="gal" data-stagger>
            
            <video
  src="/assets/video.mp4"
  className="ph c"
  autoPlay
  loop
  muted
  playsInline
/>
            <div className="galcol">
              <img src="/assets/base.png" alt="METER playground" className="ph b" />
            
            </div>
          </div>
        </section>

        {/* ---- code ---- */}
        <div className="code" id="build">
          <div>
            <Badge dot>For developers</Badge>
            <h2 data-split>Three lines on the server.</h2>
            <p className="lead rv">
              Wrap the route, set a price, point at a facilitator. Your handler
              stays exactly as it was.
            </p>
          </div>
          <pre className="rv blur">
<span className="c1">{"// proxy.ts"}</span>{"\n"}
<span className="c2">import</span>{" { paymentProxy } "}<span className="c2">from</span>{" "}<span className="c3">{'"@x402/next"'}</span>;{"\n\n"}
<span className="c2">export const</span>{" proxy = "}<span className="c2">paymentProxy</span>{"({\n  "}<span className="c3">{'"/api/v1/chat"'}</span>{": {\n    price:   "}<span className="c3">{'"$0.001"'}</span>{",\n    network: "}<span className="c3">{'"base-sepolia"'}</span>{",\n    payTo:   "}<span className="c3">{'"0x30e7…8440"'}</span>{",\n  },\n});"}
          </pre>
        </div>

        {/* ---- cta ---- */}
        <div className="strip">
          <Badge>Open source</Badge>
          <h2 data-split>Charge a tenth of a cent. Finally.</h2>
          <p className="lead rv">
            Running on Base Sepolia today. Bring your own endpoint and start
            metering it.
          </p>
          {/* <div className="cta rv">
            <a href="/https://github.com/d-even/METER" className="b1">View on GitHub</a>
            <a href="/playground" className="b2">Try the playground</a>
          </div> */}
        </div>

        <footer>
          <span>METER · built on the x402 protocol</span>
          <span>
            {/* <a href="/https://github.com/d-even/METER">GitHub</a> &nbsp;·&nbsp;  */}
            <a href="https://x.com/D_even70">X</a> &nbsp;·&nbsp;{" "}
          
          </span>
        </footer>
      </div>
    </div>
  );
}