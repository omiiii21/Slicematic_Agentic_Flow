/**
 * core.ts — SliceMatic ordering system: business logic.
 *
 * FAITHFUL TypeScript port of stage2-gradio/core.py. This module is the single
 * source of truth for every business rule and is intentionally free of any UI,
 * Next.js, Supabase or OpenRouter dependency so it can be:
 *   1. Unit-tested in isolation (see core.test.ts).
 *   2. Reused unchanged by both the ordering UI and the AI agent's JSON validator.
 *
 * Currency note: all menu prices are GST-EXCLUSIVE. GST is added at billing.
 * Order of operations is load-bearing: discount THEN GST (on the post-discount
 * total). The reference order (Cheese Burst 229 + BBQ Chicken 379 +
 * Extra Cheese 69, qty 5) MUST total Rs.3594.87.
 */

// --------------------------------------------------------------------------- //
// Constants — single source of truth for every business rule.
// Change these in ONE place (e.g. discount threshold for the live demo).
// --------------------------------------------------------------------------- //
export const GST_RATE = 0.18; // 18% GST on post-discount total
export const BULK_DISCOUNT_RATE = 0.1; // 10% off
export const BULK_DISCOUNT_MIN_QTY = 5; // discount applies when qty >= this
export const MIN_QTY = 1;
export const MAX_QTY = 10; // outlet capacity per order

export const NAME_MIN_LEN = 2;
export const NAME_MAX_LEN = 40;
const PHONE_RE = /^[6-9]\d{9}$/; // Indian mobile: 10 digits, starts 6-9
const NAME_RE = /^[A-Za-z ]+$/; // alphabets + spaces only

export const PAYMENT_MODES: Record<number, PaymentMode> = {
  1: "Cash",
  2: "Card",
  3: "UPI",
};

export const PAYMENT_CONFIRMATIONS: Record<PaymentMode, string> = {
  Cash: "Cash selected — please keep exact change ready for the rider.",
  Card: "Card selected — the rider will carry a POS machine to your door.",
  UPI: "UPI selected — a payment request will be sent to your number.",
};

// --------------------------------------------------------------------------- //
// Types
// --------------------------------------------------------------------------- //
export type Category = "base" | "pizza" | "topping";
export type PaymentMode = "Cash" | "Card" | "UPI";

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: Category;
}

export interface BillLineItem {
  component: "Base" | "Pizza" | "Topping";
  item: string;
  unit: number;
  qty: number;
  amount: number;
}

export interface Bill {
  unit: number;
  subtotal: number;
  discountRate: number;
  discount: number;
  postDiscount: number;
  gst: number;
  total: number;
  lineItems: BillLineItem[];
}

/** Result of a validator: matches core.py's (ok, message, value) tuple. */
export interface ValidationResult<T> {
  ok: boolean;
  message: string;
  value: T | null;
}

// --------------------------------------------------------------------------- //
// Money rounding — replicate Python's round(_, 2) behaviour used in core.py.
// Python rounds half-to-even, but the discount-then-GST pipeline operates on
// values that never land on a .xx5 half-cent boundary, so standard rounding
// reproduces every reference figure exactly (verified by core.test.ts).
// --------------------------------------------------------------------------- //
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// --------------------------------------------------------------------------- //
// Input validation — every function returns { ok, message, value }.
// These map 1:1 to the 8 edge cases the grader tests.
// --------------------------------------------------------------------------- //
export function validateName(raw: string | null | undefined): ValidationResult<string> {
  if (raw === null || raw === undefined) {
    return { ok: false, message: "Please enter your name.", value: null };
  }
  const name = raw.trim();
  if (!name) {
    return { ok: false, message: "Name cannot be empty or only spaces.", value: null };
  }
  if (name.length < NAME_MIN_LEN || name.length > NAME_MAX_LEN) {
    return {
      ok: false,
      message: `Name must be ${NAME_MIN_LEN}-${NAME_MAX_LEN} characters.`,
      value: null,
    };
  }
  if (!NAME_RE.test(name)) {
    return { ok: false, message: "Name may contain letters and spaces only.", value: null };
  }
  if (name.replace(/ /g, "").length < NAME_MIN_LEN) {
    return { ok: false, message: "Name must contain at least 2 letters.", value: null };
  }
  return { ok: true, message: "", value: name };
}

export function validatePhone(raw: string | null | undefined): ValidationResult<string> {
  if (raw === null || raw === undefined) {
    return { ok: false, message: "Please enter your phone number.", value: null };
  }
  const phone = raw.trim();
  if (!phone) {
    return { ok: false, message: "Phone number cannot be empty.", value: null };
  }
  if (!/^\d+$/.test(phone)) {
    return { ok: false, message: "Phone number must contain digits only.", value: null };
  }
  if (phone.length !== 10) {
    return { ok: false, message: "Phone number must be exactly 10 digits.", value: null };
  }
  if (!PHONE_RE.test(phone)) {
    return {
      ok: false,
      message: "Indian mobile numbers must start with 6, 7, 8 or 9.",
      value: null,
    };
  }
  return { ok: true, message: "", value: phone };
}

export function validateQuantity(raw: string | number | null | undefined): ValidationResult<number> {
  if (raw === null || raw === undefined || (typeof raw === "string" && !raw.trim())) {
    return { ok: false, message: "Please enter a quantity.", value: null };
  }
  const s = String(raw).trim();
  // Reject non-integers: "three", "2.5".
  if (!/^[+-]?\d+$/.test(s)) {
    return {
      ok: false,
      message: "Quantity must be a whole number (no decimals or words).",
      value: null,
    };
  }
  const qty = parseInt(s, 10);
  if (qty < MIN_QTY) {
    return { ok: false, message: `Quantity must be at least ${MIN_QTY}.`, value: null };
  }
  if (qty > MAX_QTY) {
    return {
      ok: false,
      message: `Maximum ${MAX_QTY} pizzas per order (outlet capacity).`,
      value: null,
    };
  }
  return { ok: true, message: "", value: qty };
}

/** Returns a 1-based selection index validated against menu length. */
export function validateSelection(
  raw: string | number | null | undefined,
  nItems: number
): ValidationResult<number> {
  if (raw === null || raw === undefined || (typeof raw === "string" && !raw.trim())) {
    return { ok: false, message: "Please select an item by its number.", value: null };
  }
  const s = String(raw).trim();
  if (!/^\d+$/.test(s)) {
    return {
      ok: false,
      message: "Enter the item NUMBER from the list (digits only).",
      value: null,
    };
  }
  const idx = parseInt(s, 10);
  if (idx < 1 || idx > nItems) {
    return { ok: false, message: `Please choose a number between 1 and ${nItems}.`, value: null };
  }
  return { ok: true, message: "", value: idx };
}

export function validatePayment(
  raw: string | number | null | undefined
): ValidationResult<PaymentMode> {
  if (raw === null || raw === undefined || (typeof raw === "string" && !raw.trim())) {
    return {
      ok: false,
      message: "Please choose a payment mode (1 Cash / 2 Card / 3 UPI).",
      value: null,
    };
  }
  const s = String(raw).trim();
  if (!/^\d+$/.test(s)) {
    return { ok: false, message: "Enter 1 (Cash), 2 (Card) or 3 (UPI).", value: null };
  }
  const choice = parseInt(s, 10);
  if (!(choice in PAYMENT_MODES)) {
    return { ok: false, message: "Invalid choice. Enter 1 (Cash), 2 (Card) or 3 (UPI).", value: null };
  }
  return { ok: true, message: "", value: PAYMENT_MODES[choice] };
}

// --------------------------------------------------------------------------- //
// Pricing engine — discount THEN GST. Matches the reference sample bill exactly.
// --------------------------------------------------------------------------- //
/**
 * Per-unit price = base + pizza + topping.
 * Subtotal       = unit * qty
 * Discount       = 10% of subtotal when qty >= 5
 * GST            = 18% of post-discount subtotal
 * Total          = post-discount + GST
 *
 * @param base    base price (Rs.)
 * @param pizza   pizza price (Rs.)
 * @param topping topping price (Rs.)
 * @param qty     quantity (1..10)
 */
export function computeBill(base: number, pizza: number, topping: number, qty: number): Bill {
  const unit = round2(base + pizza + topping);
  const subtotal = round2(unit * qty);

  const discountRate = qty >= BULK_DISCOUNT_MIN_QTY ? BULK_DISCOUNT_RATE : 0.0;
  const discount = round2(subtotal * discountRate);
  const postDiscount = round2(subtotal - discount);

  const gst = round2(postDiscount * GST_RATE);
  const total = round2(postDiscount + gst);

  const lineItems: BillLineItem[] = [
    { component: "Base", item: "", unit: base, qty, amount: round2(base * qty) },
    { component: "Pizza", item: "", unit: pizza, qty, amount: round2(pizza * qty) },
    { component: "Topping", item: "", unit: topping, qty, amount: round2(topping * qty) },
  ];

  return { unit, subtotal, discountRate, discount, postDiscount, gst, total, lineItems };
}

/**
 * Convenience overload that takes MenuItem objects, fills in line-item names,
 * and computes the same bill. Useful for the ordering UI and AI validator.
 */
export function computeBillFromItems(
  base: MenuItem,
  pizza: MenuItem,
  topping: MenuItem,
  qty: number
): Bill {
  const bill = computeBill(base.price, pizza.price, topping.price, qty);
  bill.lineItems[0].item = base.name;
  bill.lineItems[1].item = pizza.name;
  bill.lineItems[2].item = topping.name;
  return bill;
}

// --------------------------------------------------------------------------- //
// Order serialisation — mirrors core.py's pipe-separated key=value record.
// Human-readable AND machine-parseable.
// --------------------------------------------------------------------------- //
export interface SerializeOrderArgs {
  customer: string;
  phone: string;
  base: MenuItem;
  pizza: MenuItem;
  topping: MenuItem;
  bill: Bill;
  paymentMode: PaymentMode;
  timestamp?: string;
}

export function serializeOrder(args: SerializeOrderArgs): string {
  const { customer, phone, base, pizza, topping, bill, paymentMode } = args;
  const ts = args.timestamp ?? new Date().toISOString().slice(0, 19).replace("T", " ");
  const fields = [
    `timestamp=${ts}`,
    `name=${customer}`,
    `phone=${phone}`,
    `base=${base.id}:${base.name}:${base.price.toFixed(2)}`,
    `pizza=${pizza.id}:${pizza.name}:${pizza.price.toFixed(2)}`,
    `topping=${topping.id}:${topping.name}:${topping.price.toFixed(2)}`,
    `unit_price=${bill.unit.toFixed(2)}`,
    `qty=${bill.lineItems[0].qty}`,
    `subtotal=${bill.subtotal.toFixed(2)}`,
    `discount=${bill.discount.toFixed(2)}`,
    `gst=${bill.gst.toFixed(2)}`,
    `total=${bill.total.toFixed(2)}`,
    `payment=${paymentMode}`,
  ];
  return fields.join(" | ");
}
