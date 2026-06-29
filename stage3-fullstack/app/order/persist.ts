/**
 * persist.ts — save a completed order to Supabase from the browser.
 *
 * RLS (supabase/schema.sql) allows anonymous INSERT on `orders` and
 * `order_items`, so the public anon client is sufficient to place an order.
 * Reads are admin-only; we never read here.
 *
 * Persistence is OPTIONAL: when Supabase is unconfigured this module is never
 * called (the caller checks `isSupabaseConfigured()` and confirms offline). All
 * failures are surfaced as a friendly message — the order flow never crashes.
 */

import { getSupabaseBrowser } from "@/lib/supabase";
import type { Bill, MenuItem, PaymentMode } from "@/lib/core";
import type { OrderInsert, OrderItemInsert } from "@/lib/types";

export interface PersistOrderArgs {
  customer: string;
  phone: string;
  base: MenuItem;
  pizza: MenuItem;
  topping: MenuItem;
  bill: Bill;
  paymentMode: PaymentMode;
}

export interface PersistResult {
  ok: boolean;
  orderId: string | null;
  message: string;
}

/**
 * Insert one `orders` header row plus three `order_items` rows (base, pizza,
 * topping price snapshots). Returns { ok, orderId, message } — never throws.
 */
export async function persistOrder(args: PersistOrderArgs): Promise<PersistResult> {
  const supabase = getSupabaseBrowser();
  if (!supabase) {
    return { ok: false, orderId: null, message: "Supabase is not configured." };
  }

  const { customer, phone, base, pizza, topping, bill, paymentMode } = args;
  const qty = bill.lineItems[0]?.qty ?? 1;

  const orderRow: OrderInsert = {
    customer_name: customer,
    phone,
    quantity: qty,
    subtotal: bill.subtotal,
    discount: bill.discount,
    gst: bill.gst,
    total: bill.total,
    payment_mode: paymentMode,
  };

  try {
    const { data: inserted, error: orderErr } = await supabase
      .from("orders")
      .insert(orderRow)
      .select("id")
      .single();

    if (orderErr || !inserted) {
      return {
        ok: false,
        orderId: null,
        message: orderErr?.message ?? "Could not save the order header.",
      };
    }

    const orderId = (inserted as { id: string }).id;

    const items: OrderItemInsert[] = [
      { order_id: orderId, menu_id: base.id, component: "base", unit_price: base.price },
      { order_id: orderId, menu_id: pizza.id, component: "pizza", unit_price: pizza.price },
      { order_id: orderId, menu_id: topping.id, component: "topping", unit_price: topping.price },
    ];

    const { error: itemsErr } = await supabase.from("order_items").insert(items);
    if (itemsErr) {
      // Header saved but items failed — report partial success honestly.
      return {
        ok: false,
        orderId,
        message: `Order header saved (#${orderId.slice(0, 8)}) but line items failed: ${itemsErr.message}`,
      };
    }

    return { ok: true, orderId, message: "" };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unexpected error while saving the order.";
    return { ok: false, orderId: null, message };
  }
}
