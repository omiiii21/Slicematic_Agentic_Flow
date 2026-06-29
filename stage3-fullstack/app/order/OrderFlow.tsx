"use client";

/**
 * OrderFlow — the customer ordering flow as a client-side state machine.
 *
 * Steps:  intake (name, phone) -> quantity -> base -> pizza -> topping
 *         -> bill (review) -> payment -> confirmation
 *
 * Every transition runs the lib/core.ts validators, so the UI shows the exact
 * same specific error messages as the Stage 2 engine and can NEVER crash on bad
 * input. The bill is computed with computeBillFromItems (single source of truth).
 *
 * On payment confirm we persist to Supabase when configured (orders header + 3
 * order_items); otherwise we still confirm and note that persistence needs
 * Supabase. Nothing here throws at import time, so `next build` is safe.
 */

import { useEffect, useMemo, useState } from "react";
import {
  computeBillFromItems,
  validateName,
  validatePhone,
  validateQuantity,
  validateSelection,
  PAYMENT_MODES,
  PAYMENT_CONFIRMATIONS,
  type MenuItem,
  type PaymentMode,
} from "@/lib/core";
import { getMenus } from "@/lib/menu";
import { isSupabaseConfigured } from "@/lib/supabase";
import type { GroupedMenus } from "@/lib/types";
import { persistOrder } from "./persist";
import BillTable, { inr } from "./BillTable";
import styles from "./order.module.css";

type Step = "intake" | "quantity" | "base" | "pizza" | "topping" | "bill" | "payment" | "done";

const STEP_ORDER: Step[] = [
  "intake",
  "quantity",
  "base",
  "pizza",
  "topping",
  "bill",
  "payment",
  "done",
];

const STEP_LABELS: Record<Step, string> = {
  intake: "Details",
  quantity: "Quantity",
  base: "Base",
  pizza: "Pizza",
  topping: "Topping",
  bill: "Bill",
  payment: "Payment",
  done: "Done",
};

const PAYMENT_ENTRIES = Object.entries(PAYMENT_MODES) as Array<[string, PaymentMode]>;

export default function OrderFlow() {
  // --- loaded data ---
  const [menus, setMenus] = useState<GroupedMenus | null>(null);
  const [menuError, setMenuError] = useState(false);

  // --- collected order fields ---
  const [step, setStep] = useState<Step>("intake");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [qty, setQty] = useState("1");
  const [base, setBase] = useState<MenuItem | null>(null);
  const [pizza, setPizza] = useState<MenuItem | null>(null);
  const [topping, setTopping] = useState<MenuItem | null>(null);
  const [payment, setPayment] = useState<PaymentMode | null>(null);

  // --- transient UI state ---
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [saveNote, setSaveNote] = useState("");

  const persistenceOn = isSupabaseConfigured();

  useEffect(() => {
    let alive = true;
    getMenus()
      .then((m) => {
        if (alive) setMenus(m);
      })
      .catch(() => {
        if (alive) setMenuError(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  // The validated quantity (>=1) used for the bill; falls back to 1 pre-validation.
  const validQty = useMemo(() => {
    const r = validateQuantity(qty);
    return r.ok && r.value ? r.value : 1;
  }, [qty]);

  // Bill is computable once base+pizza+topping are chosen.
  const bill = useMemo(() => {
    if (!base || !pizza || !topping) return null;
    return computeBillFromItems(base, pizza, topping, validQty);
  }, [base, pizza, topping, validQty]);

  function clearError() {
    setError("");
  }

  // --- step transitions (each guarded by the relevant validator) ---
  function next() {
    clearError();
    switch (step) {
      case "intake": {
        const n = validateName(name);
        if (!n.ok) return setError(n.message);
        const p = validatePhone(phone);
        if (!p.ok) return setError(p.message);
        setName(n.value!);
        setPhone(p.value!);
        return setStep("quantity");
      }
      case "quantity": {
        const q = validateQuantity(qty);
        if (!q.ok) return setError(q.message);
        setQty(String(q.value));
        return setStep("base");
      }
      case "base":
        if (!base) return setError("Please choose a base.");
        return setStep("pizza");
      case "pizza":
        if (!pizza) return setError("Please choose a pizza.");
        return setStep("topping");
      case "topping":
        if (!topping) return setError("Please choose a topping.");
        return setStep("bill");
      case "bill":
        return setStep("payment");
      default:
        return;
    }
  }

  function back() {
    clearError();
    const i = STEP_ORDER.indexOf(step);
    if (i > 0) setStep(STEP_ORDER[i - 1]);
  }

  // Select a menu item via the validated 1-based index (mirrors core.validateSelection).
  function chooseByIndex(list: MenuItem[], idx1: number, set: (m: MenuItem) => void) {
    const r = validateSelection(idx1, list.length);
    if (!r.ok || !r.value) return setError(r.message);
    clearError();
    set(list[r.value - 1]);
  }

  async function confirmPayment(mode: PaymentMode) {
    setPayment(mode);
    clearError();
    if (!base || !pizza || !topping || !bill) {
      return setError("Order is incomplete. Please go back and complete every step.");
    }

    if (!persistenceOn) {
      setSavedId(null);
      setSaveNote(
        "Order confirmed locally. Connect Supabase (see README) to persist orders to the database."
      );
      return setStep("done");
    }

    setSaving(true);
    const res = await persistOrder({
      customer: name,
      phone,
      base,
      pizza,
      topping,
      bill,
      paymentMode: mode,
    });
    setSaving(false);

    if (res.ok) {
      setSavedId(res.orderId);
      setSaveNote("");
    } else {
      // Persistence failed, but the order is still valid — confirm and explain.
      setSavedId(res.orderId);
      setSaveNote(`Could not fully save to the database: ${res.message}`);
    }
    setStep("done");
  }

  function restart() {
    setStep("intake");
    setName("");
    setPhone("");
    setQty("1");
    setBase(null);
    setPizza(null);
    setTopping(null);
    setPayment(null);
    setError("");
    setSaving(false);
    setSavedId(null);
    setSaveNote("");
  }

  // --- progress tracker ---
  const currentIndex = STEP_ORDER.indexOf(step);

  // --- loading / fallback states ---
  if (menuError) {
    return (
      <div className="notice notice-warn">
        Could not load the menu. Please refresh the page.
      </div>
    );
  }
  if (!menus) {
    return <p className="text-muted">Loading menu&hellip;</p>;
  }

  return (
    <div className={styles.shell}>
      <ol className={styles.steps} aria-label="Order progress">
        {STEP_ORDER.map((s, i) => (
          <li
            key={s}
            className={[
              styles.step,
              i === currentIndex ? styles.stepActive : "",
              i < currentIndex ? styles.stepDone : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {i < currentIndex ? "✓ " : `${i + 1}. `}
            {STEP_LABELS[s]}
          </li>
        ))}
      </ol>

      {!persistenceOn && step !== "done" && (
        <div className="notice notice-info">
          Demo mode: Supabase is not configured, so orders are priced and confirmed but not saved.
          See the README to connect a database.
        </div>
      )}

      <Recap
        name={name}
        phone={phone}
        qty={step === "intake" ? "" : qty}
        base={base}
        pizza={pizza}
        topping={topping}
        step={step}
      />

      {/* ---------------- INTAKE ---------------- */}
      {step === "intake" && (
        <div className="card">
          <h2>Your details</h2>
          <label htmlFor="name">Name</label>
          <input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Priya Sharma"
            autoComplete="name"
            onKeyDown={(e) => e.key === "Enter" && next()}
          />
          <label htmlFor="phone">Phone (10-digit Indian mobile)</label>
          <input
            id="phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="e.g. 9876543210"
            inputMode="numeric"
            autoComplete="tel"
            maxLength={10}
            onKeyDown={(e) => e.key === "Enter" && next()}
          />
          <p className={styles.fieldError}>{error}</p>
          <div className={styles.actions}>
            <span className={styles.spacer} />
            <button className="btn" onClick={next}>
              Continue
            </button>
          </div>
        </div>
      )}

      {/* ---------------- QUANTITY ---------------- */}
      {step === "quantity" && (
        <div className="card">
          <h2>How many pizzas?</h2>
          <p className="text-muted">
            1 to 10. Order 5 or more to unlock a 10% bulk discount.
          </p>
          <div className={styles.qtyRow}>
            <button
              className="btn btn-secondary qtyBtn"
              aria-label="Decrease quantity"
              onClick={() => {
                clearError();
                setQty((q) => String(Math.max(1, (parseInt(q, 10) || 1) - 1)));
              }}
            >
              &minus;
            </button>
            <input
              className={styles.qtyInput}
              value={qty}
              onChange={(e) => {
                clearError();
                setQty(e.target.value);
              }}
              inputMode="numeric"
              aria-label="Quantity"
              onKeyDown={(e) => e.key === "Enter" && next()}
            />
            <button
              className="btn btn-secondary qtyBtn"
              aria-label="Increase quantity"
              onClick={() => {
                clearError();
                setQty((q) => String(Math.min(10, (parseInt(q, 10) || 0) + 1)));
              }}
            >
              +
            </button>
          </div>
          <p className={styles.fieldError}>{error}</p>
          <div className={styles.actions}>
            <button className="btn btn-secondary" onClick={back}>
              Back
            </button>
            <span className={styles.spacer} />
            <button className="btn" onClick={next}>
              Continue
            </button>
          </div>
        </div>
      )}

      {/* ---------------- BASE / PIZZA / TOPPING ---------------- */}
      {step === "base" && (
        <MenuStep
          title="Choose your base"
          list={menus.base}
          selected={base}
          onSelect={(i) => chooseByIndex(menus.base, i, setBase)}
          error={error}
          onBack={back}
          onNext={next}
        />
      )}
      {step === "pizza" && (
        <MenuStep
          title="Choose your pizza"
          list={menus.pizza}
          selected={pizza}
          onSelect={(i) => chooseByIndex(menus.pizza, i, setPizza)}
          error={error}
          onBack={back}
          onNext={next}
        />
      )}
      {step === "topping" && (
        <MenuStep
          title="Choose your topping"
          list={menus.topping}
          selected={topping}
          onSelect={(i) => chooseByIndex(menus.topping, i, setTopping)}
          error={error}
          onBack={back}
          onNext={next}
        />
      )}

      {/* ---------------- BILL REVIEW ---------------- */}
      {step === "bill" && bill && (
        <div className="card">
          <h2>Review your bill</h2>
          <BillTable bill={bill} />
          <p className={styles.fieldError}>{error}</p>
          <div className={styles.actions}>
            <button className="btn btn-secondary" onClick={back}>
              Back
            </button>
            <span className={styles.spacer} />
            <button className="btn" onClick={next}>
              Proceed to payment
            </button>
          </div>
        </div>
      )}

      {/* ---------------- PAYMENT ---------------- */}
      {step === "payment" && bill && (
        <div className="card">
          <h2>Payment</h2>
          <p className="text-muted">
            Total payable <b className="text-accent">{inr(bill.total)}</b>. Choose how you&rsquo;ll
            pay the rider.
          </p>
          <div className={styles.payGrid}>
            {PAYMENT_ENTRIES.map(([key, mode]) => (
              <button
                key={mode}
                className={[styles.payOption, payment === mode ? styles.payOptionSelected : ""]
                  .filter(Boolean)
                  .join(" ")}
                disabled={saving}
                onClick={() => confirmPayment(mode)}
              >
                <span className={styles.payKey}>Press {key}</span>
                {mode}
              </button>
            ))}
          </div>
          <p className={styles.fieldError}>{error}</p>
          <div className={styles.actions}>
            <button className="btn btn-secondary" onClick={back} disabled={saving}>
              Back
            </button>
            <span className={styles.spacer} />
            {saving && <span className="text-muted">Saving&hellip;</span>}
          </div>
        </div>
      )}

      {/* ---------------- CONFIRMATION ---------------- */}
      {step === "done" && bill && base && pizza && topping && payment && (
        <div className="card">
          <div className={styles.tick} aria-hidden>
            &#10003;
          </div>
          <h2 style={{ marginTop: 0 }}>Order confirmed!</h2>
          <p>
            Thanks, <b>{name}</b>. Your order is in.
            {savedId && (
              <>
                {" "}
                Reference <b>#{savedId.slice(0, 8)}</b>.
              </>
            )}
          </p>

          <div className="notice notice-info">{PAYMENT_CONFIRMATIONS[payment]}</div>

          <BillTable bill={bill} />

          <div className={styles.recap} style={{ marginTop: "1rem" }}>
            <span className={styles.recapChip}>
              <b>Payment</b> {payment}
            </span>
            <span className={styles.recapChip}>
              <b>Phone</b> {phone}
            </span>
          </div>

          {saveNote && <div className="notice notice-warn">{saveNote}</div>}
          {savedId && !saveNote && (
            <p className="text-ok">Saved to the database.</p>
          )}

          <div className={styles.actions}>
            <span className={styles.spacer} />
            <button className="btn" onClick={restart}>
              Place another order
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* --------------------------------------------------------------------------- */
/* Sub-components                                                              */
/* --------------------------------------------------------------------------- */

function MenuStep({
  title,
  list,
  selected,
  onSelect,
  error,
  onBack,
  onNext,
}: {
  title: string;
  list: MenuItem[];
  selected: MenuItem | null;
  onSelect: (index1: number) => void;
  error: string;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div className="card">
      <h2>{title}</h2>
      <div className={styles.menuList} role="listbox" aria-label={title}>
        {list.map((item, i) => {
          const isSel = selected?.id === item.id;
          return (
            <button
              key={item.id}
              role="option"
              aria-selected={isSel}
              className={[styles.menuOption, isSel ? styles.menuOptionSelected : ""]
                .filter(Boolean)
                .join(" ")}
              onClick={() => onSelect(i + 1)}
            >
              <span className={styles.menuName}>
                <span className={styles.menuIndex}>{i + 1}</span>
                {item.name}
              </span>
              <span className={styles.menuPrice}>{inr(item.price)}</span>
            </button>
          );
        })}
      </div>
      <p className={styles.fieldError}>{error}</p>
      <div className={styles.actions}>
        <button className="btn btn-secondary" onClick={onBack}>
          Back
        </button>
        <span className={styles.spacer} />
        <button className="btn" onClick={onNext} disabled={!selected}>
          Continue
        </button>
      </div>
    </div>
  );
}

function Recap({
  name,
  phone,
  qty,
  base,
  pizza,
  topping,
  step,
}: {
  name: string;
  phone: string;
  qty: string;
  base: MenuItem | null;
  pizza: MenuItem | null;
  topping: MenuItem | null;
  step: Step;
}) {
  if (step === "intake" || step === "done") return null;
  const chips: Array<[string, string]> = [];
  if (name) chips.push(["Name", name]);
  if (phone) chips.push(["Phone", phone]);
  if (qty) chips.push(["Qty", qty]);
  if (base) chips.push(["Base", base.name]);
  if (pizza) chips.push(["Pizza", pizza.name]);
  if (topping) chips.push(["Topping", topping.name]);
  if (chips.length === 0) return null;
  return (
    <div className={styles.recap}>
      {chips.map(([k, v]) => (
        <span key={k} className={styles.recapChip}>
          <b>{k}</b> {v}
        </span>
      ))}
    </div>
  );
}
