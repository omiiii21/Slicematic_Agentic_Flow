"use client";

/**
 * app/agent/page.tsx — conversational ordering agent UI (Option B).
 *
 * A client chat that talks to /api/agent. The server route injects the documented
 * system prompt + live menu, calls OpenRouter, and either replies conversationally
 * ({done:false, reply}) or returns a fully validated order + bill ({done:true}).
 *
 * MONEY MATH IS DONE BY lib/core.ts on the server (computeBill), NEVER by the LLM
 * and never recomputed in this component — we just render the bill the API returns.
 *
 * Graceful fallback: if the AI layer is unavailable (no OPENROUTER_API_KEY, service
 * error), we show a clear notice with a link to the step-by-step /order form so
 * ordering never breaks because of the AI layer.
 */

import { useEffect, useRef, useState } from "react";
import type { AgentOrder, Bill } from "@/lib/types";

interface UiMessage {
  role: "user" | "assistant";
  content: string;
}

interface AgentResponse {
  done?: boolean;
  reply?: string;
  order?: AgentOrder;
  bill?: Bill;
  error?: string;
  unavailable?: boolean;
}

const GREETING: UiMessage = {
  role: "assistant",
  content:
    "Hi! I'm the SliceMatic ordering assistant. Tell me what you'd like — for example " +
    "\"2 BBQ Chicken pizzas on a cheese burst base with extra cheese\" — and I'll take it from there.",
};

export default function AgentPage() {
  const [messages, setMessages] = useState<UiMessage[]>([GREETING]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState<string | null>(null);
  const [order, setOrder] = useState<AgentOrder | null>(null);
  const [bill, setBill] = useState<Bill | null>(null);
  const [placed, setPlaced] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll the transcript to the latest message.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading, bill]);

  async function send() {
    const text = input.trim();
    if (!text || loading || order) return;

    const nextMessages: UiMessage[] = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    setUnavailable(null);

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Only send the user/assistant turns; the server owns the system prompt + menu.
        body: JSON.stringify({ messages: nextMessages }),
      });
      const data: AgentResponse = await res.json();

      if (data.unavailable || (!res.ok && data.error)) {
        setUnavailable(data.error || "The AI ordering agent is currently unavailable.");
        return;
      }

      if (data.done && data.order && data.bill) {
        // Bill comes pre-computed by core.ts on the server. We never do maths here.
        setOrder(data.order);
        setBill(data.bill);
        setMessages([
          ...nextMessages,
          {
            role: "assistant",
            content: "Great — I've got everything. Here's your order summary and bill below. Tap “Place order” to confirm.",
          },
        ]);
        return;
      }

      if (data.reply) {
        setMessages([...nextMessages, { role: "assistant", content: data.reply }]);
      } else {
        setUnavailable(data.error || "The assistant didn't return a reply. Please try again.");
      }
    } catch {
      setUnavailable("Couldn't reach the ordering assistant. Please try again or use the order form.");
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  function placeOrder() {
    // Persisting orders is owned by another part of the app (the /order flow /
    // a future POST). Here we confirm the validated, priced order to the customer.
    setPlaced(true);
  }

  const money = (n: number) => `Rs.${n.toFixed(2)}`;

  return (
    <div>
      <h1>Order by chat</h1>
      <p className="lead">
        Order in plain language. The assistant collects and confirms your details; the app does
        every rupee of maths.
      </p>

      {unavailable && (
        <div className="notice notice-warn">
          {unavailable}{" "}
          <a href="/order">
            <strong>Use the step-by-step order form &rarr;</strong>
          </a>
        </div>
      )}

      <div
        ref={scrollRef}
        className="card"
        style={{ maxHeight: 420, overflowY: "auto", marginTop: "1rem" }}
        aria-live="polite"
      >
        {messages.map((m, i) => (
          <div key={i} style={{ margin: "0.6rem 0", display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
            <span
              style={{
                display: "inline-block",
                maxWidth: "80%",
                whiteSpace: "pre-wrap",
                padding: "0.55rem 0.8rem",
                borderRadius: 12,
                background: m.role === "user" ? "var(--accent)" : "var(--bg)",
                color: m.role === "user" ? "#fff" : "var(--text)",
                border: m.role === "user" ? "none" : "1px solid var(--border)",
              }}
            >
              {m.content}
            </span>
          </div>
        ))}
        {loading && (
          <div style={{ margin: "0.6rem 0" }}>
            <span className="text-muted">Assistant is typing…</span>
          </div>
        )}
      </div>

      {!order && (
        <div style={{ display: "flex", gap: "0.6rem", marginTop: "0.9rem", alignItems: "flex-end" }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Type your message and press Enter…"
            rows={2}
            disabled={loading}
            style={{ resize: "vertical" }}
            aria-label="Message to the ordering assistant"
          />
          <button className="btn" onClick={send} disabled={loading || !input.trim()}>
            Send
          </button>
        </div>
      )}

      {/* Validated, priced order summary — rendered from the bill core.ts returned. */}
      {order && bill && (
        <div className="card" style={{ marginTop: "1.25rem" }}>
          <h2 style={{ marginTop: 0 }}>Order summary</h2>
          <p>
            <strong>{order.name}</strong> · {order.phone} · Payment: {order.payment_mode}
          </p>
          <table>
            <thead>
              <tr>
                <th>Component</th>
                <th>Item</th>
                <th>Unit</th>
                <th>Qty</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {bill.lineItems.map((li, i) => (
                <tr key={i}>
                  <td>{li.component}</td>
                  <td>{li.item}</td>
                  <td>{money(li.unit)}</td>
                  <td>{li.qty}</td>
                  <td>{money(li.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <table style={{ marginTop: "0.75rem" }}>
            <tbody>
              <tr>
                <td>Per-unit price</td>
                <td style={{ textAlign: "right" }}>{money(bill.unit)}</td>
              </tr>
              <tr>
                <td>Subtotal ({bill.lineItems[0].qty} × {money(bill.unit)})</td>
                <td style={{ textAlign: "right" }}>{money(bill.subtotal)}</td>
              </tr>
              <tr>
                <td>
                  Bulk discount{" "}
                  {bill.discountRate > 0 ? `(${Math.round(bill.discountRate * 100)}%)` : "(none)"}
                </td>
                <td style={{ textAlign: "right" }}>− {money(bill.discount)}</td>
              </tr>
              <tr>
                <td>Post-discount</td>
                <td style={{ textAlign: "right" }}>{money(bill.postDiscount)}</td>
              </tr>
              <tr>
                <td>GST (18%)</td>
                <td style={{ textAlign: "right" }}>+ {money(bill.gst)}</td>
              </tr>
              <tr>
                <td>
                  <strong>Total</strong>
                </td>
                <td style={{ textAlign: "right" }}>
                  <strong className="text-accent">{money(bill.total)}</strong>
                </td>
              </tr>
            </tbody>
          </table>

          {placed ? (
            <div className="notice notice-info" style={{ marginBottom: 0 }}>
              <strong className="text-ok">Order placed.</strong> Thanks, {order.name}! Your total is{" "}
              {money(bill.total)} ({order.payment_mode}). We'll be in touch on {order.phone}.
            </div>
          ) : (
            <div style={{ display: "flex", gap: "0.6rem", marginTop: "1rem" }}>
              <button className="btn" onClick={placeOrder}>
                Place order
              </button>
              <a className="btn btn-secondary" href="/agent" onClick={() => location.reload()}>
                Start over
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
