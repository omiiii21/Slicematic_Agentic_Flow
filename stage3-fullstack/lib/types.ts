/**
 * types.ts — shared application types matching the Supabase schema
 * (docs/SPEC.md section 6). Re-exports the core domain types so callers have a
 * single import surface.
 */

import type { Category, PaymentMode, Bill, MenuItem } from "./core";

export type { Category, PaymentMode, Bill, MenuItem };

/**
 * Row in the `menus` table.
 * Note: lib/core.ts MenuItem omits `is_active` (it is the in-app shape used by
 * the pricing engine). `MenuRow` is the exact DB row shape.
 */
export interface MenuRow {
  id: string; // 'B3', 'P7', 'T2'
  category: Category;
  name: string;
  price: number;
  is_active: boolean;
}

/** Menus grouped by category, as consumed by the ordering UI and AI agent. */
export interface GroupedMenus {
  base: MenuItem[];
  pizza: MenuItem[];
  topping: MenuItem[];
}

/** Row in the `orders` table (header + computed totals). */
export interface Order {
  id: string; // uuid
  created_at: string; // ISO timestamptz
  customer_name: string;
  phone: string;
  quantity: number; // 1..10
  subtotal: number;
  discount: number;
  gst: number;
  total: number;
  payment_mode: PaymentMode;
}

/**
 * Insert shape for `orders`. `created_at` is DB-generated. `id` is optional: the
 * client supplies a UUID so the INSERT needs no read-back (keeping `orders`
 * reads admin-only); the DB default `gen_random_uuid()` still applies if omitted.
 */
export type OrderInsert = Omit<Order, "id" | "created_at"> & { id?: string };

/** Row in the `order_items` table (price snapshot at order time). */
export interface OrderItem {
  id: string; // uuid
  order_id: string; // uuid -> orders.id
  menu_id: string; // -> menus.id
  component: Category; // 'base' | 'pizza' | 'topping'
  unit_price: number; // snapshot at order time
}

/** Insert shape for `order_items` (id is DB-generated; order_id set on insert). */
export type OrderItemInsert = Omit<OrderItem, "id">;

/** An order joined with its three line items, for admin/history views. */
export interface OrderWithItems extends Order {
  order_items: OrderItem[];
}

/** Structured order the AI agent returns once all fields are collected. */
export interface AgentOrder {
  name: string;
  phone: string;
  quantity: number;
  base_id: string;
  pizza_id: string;
  topping_id: string;
  payment_mode: PaymentMode;
}
