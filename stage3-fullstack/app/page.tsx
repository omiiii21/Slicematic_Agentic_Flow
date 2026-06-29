export default function HomePage() {
  return (
    <div>
      <h1>
        Slice<span className="text-accent">Matic</span>
      </h1>
      <p className="lead">
        A single pizza outlet in New Ashok Nagar, Delhi. Build one pizza — a base, a pizza, and a
        topping — order 1 to 10, and we price it with the bulk discount and GST automatically.
      </p>

      <div className="tiles">
        <a className="tile" href="/order">
          <h3>Order by form &rarr;</h3>
          <p>The classic step-by-step flow: details, menu, quantity, payment, and an itemised bill.</p>
        </a>
        <a className="tile" href="/agent">
          <h3>Order by chat (AI) &rarr;</h3>
          <p>
            Talk to our ordering assistant in plain language. It extracts and confirms your order;
            the app does every rupee of maths.
          </p>
        </a>
        <a className="tile" href="/admin">
          <h3>Admin dashboard &rarr;</h3>
          <p>Sign in to see orders, revenue, the top pizza and busiest hour, with CSV export.</p>
        </a>
      </div>

      <h2>How pricing works</h2>
      <p className="text-muted">
        Per-unit price = base + pizza + topping. A 10% bulk discount applies at quantity 5 or more,
        then 18% GST is added on the post-discount total. Money is rounded to two decimals. The
        logic is ported faithfully from the Stage 2 engine, so the bill is always deterministic.
      </p>
    </div>
  );
}
