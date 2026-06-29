/**
 * menu.ts — menu loading.
 *
 * getMenus() reads the `menus` table from Supabase, grouped by category. When
 * Supabase is not configured (or a query fails), it FALLS BACK to a hardcoded
 * seed — the exact items from stage2-gradio/menu/*.txt — so the app stays fully
 * demoable offline.
 */

import { getSupabaseBrowser, isSupabaseConfigured } from "./supabase";
import type { GroupedMenus, MenuItem, Category, MenuRow } from "./types";

// --------------------------------------------------------------------------- //
// Hardcoded seed — EXACT items/ids/prices from stage2-gradio/menu/*.txt.
// Keep in sync with supabase/seed.sql.
// --------------------------------------------------------------------------- //
export const SEED_MENUS: GroupedMenus = {
  base: [
    { id: "B1", name: "Thin Crust", price: 149, category: "base" },
    { id: "B2", name: "Thick Crust", price: 179, category: "base" },
    { id: "B3", name: "Cheese Burst", price: 229, category: "base" },
    { id: "B4", name: "Whole Wheat", price: 159, category: "base" },
    { id: "B5", name: "Multigrain", price: 169, category: "base" },
  ],
  pizza: [
    { id: "P1", name: "Margherita", price: 299, category: "pizza" },
    { id: "P2", name: "Chicago Deep Dish", price: 349, category: "pizza" },
    { id: "P3", name: "Greek Mediterranean", price: 329, category: "pizza" },
    { id: "P4", name: "California Veggie", price: 339, category: "pizza" },
    { id: "P5", name: "Farm House", price: 319, category: "pizza" },
    { id: "P6", name: "Pepperoni Classic", price: 369, category: "pizza" },
    { id: "P7", name: "BBQ Chicken", price: 379, category: "pizza" },
    { id: "P8", name: "Paneer Tikka", price: 349, category: "pizza" },
  ],
  topping: [
    { id: "T1", name: "Black Olives", price: 49, category: "topping" },
    { id: "T2", name: "Extra Cheese", price: 69, category: "topping" },
    { id: "T3", name: "Button Mushrooms", price: 49, category: "topping" },
    { id: "T4", name: "Green Peppers", price: 39, category: "topping" },
    { id: "T5", name: "Jalapenos", price: 39, category: "topping" },
    { id: "T6", name: "Sun-Dried Tomatoes", price: 59, category: "topping" },
    { id: "T7", name: "Caramelised Onions", price: 49, category: "topping" },
    { id: "T8", name: "Sweet Corn", price: 39, category: "topping" },
    { id: "T9", name: "Roasted Garlic", price: 49, category: "topping" },
    { id: "T10", name: "Peri-Peri Drizzle", price: 59, category: "topping" },
  ],
};

const CATEGORIES: Category[] = ["base", "pizza", "topping"];

/** Group a flat list of menu rows into { base, pizza, topping }. */
function group(rows: MenuItem[]): GroupedMenus {
  const out: GroupedMenus = { base: [], pizza: [], topping: [] };
  for (const r of rows) {
    if (CATEGORIES.includes(r.category)) out[r.category].push(r);
  }
  return out;
}

/**
 * Load active menus grouped by category.
 *
 * Source of truth is the Supabase `menus` table; if Supabase is unconfigured or
 * the query fails/returns nothing, returns the hardcoded SEED_MENUS so the app
 * is demoable offline. Never throws.
 */
export async function getMenus(): Promise<GroupedMenus> {
  if (!isSupabaseConfigured()) return SEED_MENUS;

  const supabase = getSupabaseBrowser();
  if (!supabase) return SEED_MENUS;

  try {
    const { data, error } = await supabase
      .from("menus")
      .select("id, category, name, price, is_active")
      .eq("is_active", true)
      .order("id", { ascending: true });

    if (error || !data || data.length === 0) return SEED_MENUS;

    const items: MenuItem[] = (data as MenuRow[]).map((r) => ({
      id: r.id,
      name: r.name,
      price: Number(r.price),
      category: r.category,
    }));
    return group(items);
  } catch {
    return SEED_MENUS;
  }
}

/** Flatten grouped menus to a single id->MenuItem lookup (handy for the agent). */
export function indexById(menus: GroupedMenus): Record<string, MenuItem> {
  const out: Record<string, MenuItem> = {};
  for (const cat of CATEGORIES) {
    for (const item of menus[cat]) out[item.id] = item;
  }
  return out;
}
