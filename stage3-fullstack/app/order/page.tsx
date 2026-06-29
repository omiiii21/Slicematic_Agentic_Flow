/**
 * /order — the customer ordering flow (form-driven).
 *
 * This page renders the client-side OrderFlow state machine. All data loading
 * (the menu) happens client-side inside OrderFlow via useEffect, so nothing is
 * fetched at build time. We also set `force-dynamic` as a belt-and-braces guard
 * so the route is never statically prerendered against absent env vars.
 */

import OrderFlow from "./OrderFlow";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Order · SliceMatic",
  description: "Build your pizza step by step and get an itemised, GST-accurate bill.",
};

export default function OrderPage() {
  return (
    <div>
      <h1>
        Order a <span className="text-accent">pizza</span>
      </h1>
      <p className="lead">
        Build one pizza step by step. We price it with the bulk discount and 18% GST automatically.
      </p>
      <OrderFlow />
    </div>
  );
}
