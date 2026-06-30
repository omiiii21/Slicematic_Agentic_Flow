export default function HomePage() {
  return (
    <div>
      <section className="hero reveal">
        <span className="kicker">New Ashok Nagar · Delhi</span>
        <h1>
          Pizza, built your way — <span className="accent-word">priced right</span>, every time.
        </h1>
        <p className="lead">
          One base, one pizza, one topping. Order 1 to 10 and we handle the bulk discount and 18% GST
          automatically — calculated in code, to the paisa.
        </p>
        <div className="hero-cta">
          <a className="btn btn-lg" href="/order">
            Start an order &rarr;
          </a>
          <a className="btn btn-secondary btn-lg" href="/agent">
            Order by chat
          </a>
        </div>
      </section>

      <div className="tiles">
        <a className="tile reveal" href="/order">
          <h3>Order by form</h3>
          <p>The step-by-step flow: your details, the menu, quantity, payment, and an itemised bill.</p>
        </a>
        <a className="tile reveal-2" href="/agent">
          <h3>Order by chat (AI)</h3>
          <p>
            Tell our assistant what you want in plain language. It extracts and confirms your order;
            the app does every rupee of maths.
          </p>
        </a>
        <a className="tile reveal-3" href="/admin">
          <h3>Admin dashboard</h3>
          <p>Sign in for orders, revenue, the top pizza and busiest hour — with one-click CSV export.</p>
        </a>
      </div>

      <section className="card" style={{ marginTop: "2.25rem" }}>
        <span className="kicker">How pricing works</span>
        <p className="text-muted" style={{ marginTop: "0.85rem" }}>
          Per-unit price = base + pizza + topping. A 10% bulk discount kicks in at quantity 5 or more,
          then 18% GST is added on the post-discount total, with every figure rounded to two decimals.
          The logic is ported faithfully from the Stage 2 engine, so the bill is always deterministic —
          the reference order totals <b className="text-accent">Rs.3,594.87</b> to the paisa.
        </p>
      </section>
    </div>
  );
}
