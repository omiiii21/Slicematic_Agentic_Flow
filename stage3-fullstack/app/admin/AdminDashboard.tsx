"use client";

/**
 * AdminDashboard — auth-gated admin view.
 *
 *   1. If Supabase is not configured  → "Configure .env.local" notice.
 *   2. If not signed in                → <LoginForm/>.
 *   3. If signed in                    → orders table + filters + insights + CSV.
 *
 * All fetching is client-side. Reading `orders`/`order_items` requires an
 * authenticated session (RLS `to authenticated`), which we have post-login via
 * the browser Supabase client.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseBrowser, isSupabaseConfigured } from "@/lib/supabase";
import { getMenus, indexById } from "@/lib/menu";
import type { MenuItem, OrderWithItems, PaymentMode } from "@/lib/types";
import LoginForm from "./LoginForm";
import styles from "./admin.module.css";

const PAYMENT_FILTERS: ReadonlyArray<"All" | PaymentMode> = ["All", "Cash", "Card", "UPI"];

// ---------- money / date helpers ---------------------------------------- //

function rupees(n: number): string {
  return "Rs." + n.toFixed(2);
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Format an hour-of-day (0–23) as a readable range, e.g. 14 → "2:00 PM – 3:00 PM". */
function formatHourRange(hour: number): string {
  const label = (h: number) => {
    const period = h < 12 ? "AM" : "PM";
    const display = h % 12 === 0 ? 12 : h % 12;
    return `${display}:00 ${period}`;
  };
  return `${label(hour)} – ${label((hour + 1) % 24)}`;
}

// ---------- insight computations ---------------------------------------- //

interface Insights {
  totalRevenue: number;
  orderCount: number;
  topPizza: { name: string; count: number } | null;
  busiestHour: { hour: number; count: number } | null;
}

function computeInsights(
  orders: OrderWithItems[],
  menuIndex: Record<string, MenuItem>
): Insights {
  const totalRevenue = orders.reduce((sum, o) => sum + Number(o.total), 0);

  // Top-selling pizza: count component='pizza' line items by menu_id, weighted
  // by the order quantity (each order represents `quantity` pizzas of that type).
  const pizzaCounts = new Map<string, number>();
  for (const o of orders) {
    const qty = Number(o.quantity) || 0;
    for (const item of o.order_items ?? []) {
      if (item.component === "pizza") {
        pizzaCounts.set(item.menu_id, (pizzaCounts.get(item.menu_id) ?? 0) + qty);
      }
    }
  }
  let topPizza: Insights["topPizza"] = null;
  for (const [menuId, count] of pizzaCounts) {
    if (!topPizza || count > topPizza.count) {
      topPizza = { name: menuIndex[menuId]?.name ?? menuId, count };
    }
  }

  // Busiest hour: group orders by hour-of-day of created_at.
  const hourCounts = new Array<number>(24).fill(0);
  for (const o of orders) {
    const d = new Date(o.created_at);
    if (!Number.isNaN(d.getTime())) hourCounts[d.getHours()] += 1;
  }
  let busiestHour: Insights["busiestHour"] = null;
  for (let h = 0; h < 24; h++) {
    if (hourCounts[h] > 0 && (!busiestHour || hourCounts[h] > busiestHour.count)) {
      busiestHour = { hour: h, count: hourCounts[h] };
    }
  }

  return { totalRevenue, orderCount: orders.length, topPizza, busiestHour };
}

// ---------- CSV export --------------------------------------------------- //

const CSV_HEADERS = [
  "id",
  "created_at",
  "customer_name",
  "phone",
  "quantity",
  "subtotal",
  "discount",
  "gst",
  "total",
  "payment_mode",
] as const;

function csvCell(value: unknown): string {
  const s = value == null ? "" : String(value);
  // Quote if it contains comma, quote, or newline; escape embedded quotes.
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function buildCsv(orders: OrderWithItems[]): string {
  const lines = [CSV_HEADERS.join(",")];
  for (const o of orders) {
    lines.push(
      [
        o.id,
        o.created_at,
        o.customer_name,
        o.phone,
        o.quantity,
        o.subtotal,
        o.discount,
        o.gst,
        o.total,
        o.payment_mode,
      ]
        .map(csvCell)
        .join(",")
    );
  }
  return lines.join("\r\n");
}

function downloadCsv(orders: OrderWithItems[]): void {
  const blob = new Blob([buildCsv(orders)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `slicematic-orders-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ---------- main component ----------------------------------------------- //

export default function AdminDashboard() {
  const configured = isSupabaseConfigured();
  // Stable client reference for the lifetime of the component.
  const [supabase] = useState<SupabaseClient | null>(() => getSupabaseBrowser());

  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // menu_id -> MenuItem, for resolving readable names in insights/table.
  const [menuIndex, setMenuIndex] = useState<Record<string, MenuItem>>({});

  // Filters
  const [fromDate, setFromDate] = useState(""); // yyyy-mm-dd
  const [toDate, setToDate] = useState(""); // yyyy-mm-dd
  const [payment, setPayment] = useState<"All" | PaymentMode>("All");

  // --- auth lifecycle --- //
  useEffect(() => {
    if (!supabase) {
      setAuthReady(true);
      return;
    }
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setAuthReady(true);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  // --- menu names (for readable insights/items); getMenus never throws --- //
  useEffect(() => {
    let active = true;
    getMenus()
      .then((menus) => {
        if (active) setMenuIndex(indexById(menus));
      })
      .catch(() => {
        /* getMenus already falls back to the seed; ignore. */
      });
    return () => {
      active = false;
    };
  }, []);

  // --- data fetch (only when authed) --- //
  const fetchOrders = useCallback(async () => {
    if (!supabase || !session) return;
    setLoading(true);
    setFetchError(null);
    try {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, created_at, customer_name, phone, quantity, subtotal, discount, gst, total, payment_mode, order_items ( id, order_id, menu_id, component, unit_price )"
        )
        .order("created_at", { ascending: false });

      if (error) {
        setFetchError(error.message);
        setOrders([]);
      } else {
        setOrders((data ?? []) as unknown as OrderWithItems[]);
      }
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Failed to load orders.");
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [supabase, session]);

  useEffect(() => {
    if (session) void fetchOrders();
    else setOrders([]);
  }, [session, fetchOrders]);

  // --- client-side filtering --- //
  const filtered = useMemo(() => {
    // Inclusive date range on the order's calendar day (local time).
    const fromMs = fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : null;
    const toMs = toDate ? new Date(`${toDate}T23:59:59.999`).getTime() : null;

    return orders.filter((o) => {
      if (payment !== "All" && o.payment_mode !== payment) return false;
      const t = new Date(o.created_at).getTime();
      if (Number.isNaN(t)) return true; // keep rows we can't parse rather than hide them
      if (fromMs != null && t < fromMs) return false;
      if (toMs != null && t > toMs) return false;
      return true;
    });
  }, [orders, fromDate, toDate, payment]);

  const insights = useMemo(() => computeInsights(filtered, menuIndex), [filtered, menuIndex]);

  const clearFilters = () => {
    setFromDate("");
    setToDate("");
    setPayment("All");
  };

  async function signOut() {
    if (supabase) await supabase.auth.signOut();
  }

  // --- render: not configured --- //
  if (!configured || !supabase) {
    return (
      <div>
        <h1>
          Admin <span className="text-accent">dashboard</span>
        </h1>
        <div className="notice notice-warn">
          Supabase is not configured. Create <code>.env.local</code> with{" "}
          <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> (see
          the README), then restart the dev server.
        </div>
      </div>
    );
  }

  // --- render: auth still resolving --- //
  if (!authReady) {
    return (
      <div>
        <h1>
          Admin <span className="text-accent">dashboard</span>
        </h1>
        <p className="text-muted">Loading…</p>
      </div>
    );
  }

  // --- render: login gate --- //
  if (!session) {
    return <LoginForm supabase={supabase} />;
  }

  // --- render: dashboard --- //
  const hasOrders = orders.length > 0;
  const hasFiltered = filtered.length > 0;

  return (
    <div className="admin">
      <div className={styles.topbar}>
        <div>
          <h1>
            Admin <span className="text-accent">dashboard</span>
          </h1>
          <p className="text-muted" style={{ margin: 0 }}>
            Signed in as {session.user.email}
          </p>
        </div>
        <div className={styles.topbarActions}>
          <button className="btn btn-secondary" onClick={() => void fetchOrders()} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
          <button className="btn btn-secondary" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      </div>

      {fetchError && (
        <div className="notice notice-warn" role="alert">
          Could not load orders: {fetchError}
        </div>
      )}

      {/* Insight stat cards */}
      <div className={styles.stats}>
        <div className={`card ${styles.stat}`}>
          <div className={styles.statLabel}>Total revenue</div>
          <div className={styles.statValue}>{rupees(insights.totalRevenue)}</div>
          <div className={styles.statSub}>
            {insights.orderCount} order{insights.orderCount === 1 ? "" : "s"} in view
          </div>
        </div>

        <div className={`card ${styles.stat}`}>
          <div className={styles.statLabel}>Top-selling pizza</div>
          <div className={styles.statValue}>
            {insights.topPizza ? insights.topPizza.name : "—"}
          </div>
          <div className={styles.statSub}>
            {insights.topPizza
              ? `${insights.topPizza.count} sold`
              : "No pizza sales in view"}
          </div>
        </div>

        <div className={`card ${styles.stat}`}>
          <div className={styles.statLabel}>Busiest hour</div>
          <div className={styles.statValue}>
            {insights.busiestHour ? formatHourRange(insights.busiestHour.hour) : "—"}
          </div>
          <div className={styles.statSub}>
            {insights.busiestHour
              ? `${insights.busiestHour.count} order${insights.busiestHour.count === 1 ? "" : "s"}`
              : "No orders in view"}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className={`card ${styles.filters}`}>
        <div className={styles.filterField}>
          <label htmlFor="from-date">From date</label>
          <input
            id="from-date"
            type="date"
            value={fromDate}
            max={toDate || undefined}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </div>
        <div className={styles.filterField}>
          <label htmlFor="to-date">To date</label>
          <input
            id="to-date"
            type="date"
            value={toDate}
            min={fromDate || undefined}
            onChange={(e) => setToDate(e.target.value)}
          />
        </div>
        <div className={styles.filterField}>
          <label htmlFor="payment-mode">Payment mode</label>
          <select
            id="payment-mode"
            value={payment}
            onChange={(e) => setPayment(e.target.value as "All" | PaymentMode)}
          >
            {PAYMENT_FILTERS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.filterActions}>
          <button className="btn btn-secondary" onClick={clearFilters}>
            Clear filters
          </button>
          <button
            className="btn"
            onClick={() => downloadCsv(filtered)}
            disabled={!hasFiltered}
            title={hasFiltered ? "Export filtered orders to CSV" : "No orders to export"}
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Orders table */}
      {loading && !hasOrders ? (
        <p className="text-muted">Loading orders…</p>
      ) : !hasOrders ? (
        <div className="notice notice-info">
          No orders yet. Once customers place orders (via the form or the AI agent) they will appear
          here.
        </div>
      ) : !hasFiltered ? (
        <div className="notice notice-info">
          No orders match the current filters.{" "}
          <button
            type="button"
            onClick={clearFilters}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              width: "auto",
              color: "var(--accent-dark)",
              fontWeight: 600,
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Date / time</th>
                <th>Customer</th>
                <th>Phone</th>
                <th>Items</th>
                <th style={{ textAlign: "right" }}>Qty</th>
                <th style={{ textAlign: "right" }}>Subtotal</th>
                <th style={{ textAlign: "right" }}>Discount</th>
                <th style={{ textAlign: "right" }}>GST</th>
                <th style={{ textAlign: "right" }}>Total</th>
                <th>Payment</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => {
                const items = (o.order_items ?? [])
                  .slice()
                  .sort((a, b) => a.component.localeCompare(b.component))
                  .map((it) => menuIndex[it.menu_id]?.name ?? it.menu_id)
                  .join(", ");
                return (
                  <tr key={o.id}>
                    <td>{formatDateTime(o.created_at)}</td>
                    <td>{o.customer_name}</td>
                    <td>{o.phone}</td>
                    <td className="text-muted" style={{ fontSize: "0.85rem" }}>
                      {items || "—"}
                    </td>
                    <td style={{ textAlign: "right" }}>{o.quantity}</td>
                    <td style={{ textAlign: "right" }}>{rupees(Number(o.subtotal))}</td>
                    <td style={{ textAlign: "right" }}>{rupees(Number(o.discount))}</td>
                    <td style={{ textAlign: "right" }}>{rupees(Number(o.gst))}</td>
                    <td style={{ textAlign: "right", fontWeight: 700 }}>
                      {rupees(Number(o.total))}
                    </td>
                    <td>{o.payment_mode}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="text-muted" style={{ fontSize: "0.85rem", marginTop: "0.75rem" }}>
            Showing {filtered.length} of {orders.length} order{orders.length === 1 ? "" : "s"}.
          </p>
        </div>
      )}
    </div>
  );
}
