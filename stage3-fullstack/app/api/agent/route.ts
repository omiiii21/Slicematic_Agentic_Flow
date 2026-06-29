/**
 * app/api/agent/route.ts — server-side endpoint for the conversational ordering agent.
 *
 * Flow (Option B, see docs/AI_FEATURE.md):
 *   1. Client sends the running conversation (messages[]).
 *   2. We inject the documented system prompt + the CURRENT menu (from getMenus()).
 *   3. We call OpenRouter chat completions server-side using OPENROUTER_API_KEY.
 *   4. If the model replies with the final order JSON, we VALIDATE every field with
 *      lib/core.ts and resolve menu ids against the real menu, then return
 *      { done:true, order, bill }. Otherwise we return { done:false, reply }.
 *
 * MONEY MATH IS DONE BY lib/core.ts (computeBill), NEVER BY THE LLM.
 * The model only turns messy text into a *proposed* structured order; core.ts
 * validates it and computes every rupee deterministically. If the model emits
 * prices, we ignore them — the bill below is the single source of truth.
 *
 * The OPENROUTER_API_KEY is read lazily from process.env inside the handler and is
 * NEVER sent to the client. When it is missing we return a clear error JSON (HTTP
 * 503) so the build never breaks and the UI can fall back to the /order form.
 */

import { NextResponse } from "next/server";
import { getMenus, indexById } from "@/lib/menu";
import {
  computeBill,
  validateName,
  validatePhone,
  validateQuantity,
  type Bill,
  type MenuItem,
  type PaymentMode,
} from "@/lib/core";
import type { AgentOrder, GroupedMenus } from "@/lib/types";

export const dynamic = "force-dynamic";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "openai/gpt-4o-mini";

// --------------------------------------------------------------------------- //
// Documented system prompt — copied verbatim from docs/AI_FEATURE.md.
// The {{MENU}} marker is replaced at request time with the live menu.
// --------------------------------------------------------------------------- //
const SYSTEM_PROMPT = `You are SliceMatic's ordering assistant for a single pizza outlet in New Ashok Nagar, Delhi.
Your ONLY job is to collect a valid order from the customer through natural conversation and
return it as structured data. You do NOT calculate prices, discounts, or taxes — the application
does all maths. You do NOT invent menu items.

You will be given the current MENU as three lists (bases, pizzas, toppings), each item as
{number, name, price}. The customer composes ONE pizza = one base + one pizza + one topping,
ordered in a quantity from 1 to 10.

Fields to collect and confirm, one at a time, in a friendly and concise tone:
  - name: letters and spaces only, 2–40 characters
  - phone: exactly 10 digits, must start with 6, 7, 8 or 9
  - quantity: a whole number from 1 to 10
  - base, pizza, topping: must each be an item from the provided menu (match by name/number)
  - payment_mode: one of Cash, Card, UPI

Rules:
  - Ask for missing fields; never assume a value the customer did not give.
  - If the customer is vague ("something spicy", "the cheesy one"), suggest the closest 1–2
    menu items by name and ask them to confirm. Never pick silently.
  - If an input is invalid (e.g. a phone starting with 1, quantity 0 or 11), explain briefly and
    re-ask. Do not advance.
  - Only choose items that appear in the provided menu. If asked for something not on the menu,
    say it isn't available and offer the closest option.
  - Do NOT state prices, totals, discounts, or GST — say the app will show the final bill.

When ALL fields are collected and confirmed, respond with ONLY this JSON (no prose, no markdown):
{"name": "...", "phone": "...", "quantity": <int>, "base_id": "<menu id>",
 "pizza_id": "<menu id>", "topping_id": "<menu id>", "payment_mode": "Cash|Card|UPI"}
Until then, reply conversationally with your next question.`;

// --------------------------------------------------------------------------- //
// Types for the request/response contract with the client.
// --------------------------------------------------------------------------- //
type Role = "system" | "user" | "assistant";
interface ChatMessage {
  role: Role;
  content: string;
}

/** Render the live menu as the three numbered lists described in the prompt. */
function renderMenu(menus: GroupedMenus): string {
  const list = (items: MenuItem[]) =>
    items
      .map((it, i) => `  ${i + 1}. ${it.name} (id ${it.id}) — Rs.${it.price}`)
      .join("\n");
  return [
    "CURRENT MENU (only choose ids that appear here):",
    "",
    "BASES:",
    list(menus.base),
    "",
    "PIZZAS:",
    list(menus.pizza),
    "",
    "TOPPINGS:",
    list(menus.topping),
  ].join("\n");
}

/**
 * Try to extract a JSON order object from a model reply. The model is told to
 * return ONLY JSON when done, but we tolerate stray prose/markdown fences by
 * scanning for the first balanced { ... } block and parsing it.
 */
function extractOrderJson(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();

  const tryParse = (s: string): Record<string, unknown> | null => {
    try {
      const parsed = JSON.parse(s);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      /* not JSON */
    }
    return null;
  };

  // Fast path: the whole reply is JSON.
  const whole = tryParse(trimmed);
  if (whole) return whole;

  // Strip a ```json ... ``` fence if present.
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) {
    const fenced = tryParse(fence[1].trim());
    if (fenced) return fenced;
  }

  // Last resort: first balanced object that mentions our order keys.
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start !== -1 && end > start) {
    const candidate = trimmed.slice(start, end + 1);
    const obj = tryParse(candidate);
    if (obj && "base_id" in obj && "pizza_id" in obj) return obj;
  }
  return null;
}

/** Does this object look like the final order (vs. some other JSON the model emitted)? */
function looksLikeOrder(obj: Record<string, unknown>): boolean {
  const keys = ["name", "phone", "quantity", "base_id", "pizza_id", "topping_id", "payment_mode"];
  return keys.every((k) => k in obj);
}

interface ValidatedOrder {
  ok: boolean;
  message: string;
  order?: AgentOrder;
  bill?: Bill;
}

/**
 * Validate a proposed order object against lib/core.ts + the real menu.
 * Returns a typed order and the deterministic bill (computed by core.ts) on success,
 * or an error message describing the first problem so it can be fed back to the model.
 */
function validateOrder(
  obj: Record<string, unknown>,
  byId: Record<string, MenuItem>,
  menus: GroupedMenus
): ValidatedOrder {
  const name = validateName(typeof obj.name === "string" ? obj.name : null);
  if (!name.ok) return { ok: false, message: name.message };

  const phone = validatePhone(typeof obj.phone === "string" ? obj.phone : String(obj.phone ?? ""));
  if (!phone.ok) return { ok: false, message: phone.message };

  const qty = validateQuantity(
    typeof obj.quantity === "number" || typeof obj.quantity === "string" ? obj.quantity : null
  );
  if (!qty.ok) return { ok: false, message: qty.message };

  // Resolve menu ids against the live menu and check each is in the right category.
  const resolve = (
    rawId: unknown,
    category: MenuItem["category"],
    label: string
  ): { item?: MenuItem; error?: string } => {
    const id = typeof rawId === "string" ? rawId.trim() : "";
    const item = byId[id];
    if (!item) return { error: `The ${label} id "${id}" is not on the menu. Please pick one of the listed ${label}s.` };
    if (item.category !== category)
      return { error: `"${item.name}" is not a ${label}. Please pick a valid ${label} from the menu.` };
    return { item };
  };

  const base = resolve(obj.base_id, "base", "base");
  if (base.error) return { ok: false, message: base.error };
  const pizza = resolve(obj.pizza_id, "pizza", "pizza");
  if (pizza.error) return { ok: false, message: pizza.error };
  const topping = resolve(obj.topping_id, "topping", "topping");
  if (topping.error) return { ok: false, message: topping.error };

  const payRaw = typeof obj.payment_mode === "string" ? obj.payment_mode.trim() : "";
  const PAY: Record<string, PaymentMode> = { cash: "Cash", card: "Card", upi: "UPI" };
  const payment = PAY[payRaw.toLowerCase()];
  if (!payment) return { ok: false, message: "Payment mode must be Cash, Card or UPI." };

  // Touch `menus` so a future caller can extend category lists without lint churn;
  // also a cheap sanity guard that the menu actually loaded.
  if (!menus.base.length || !menus.pizza.length || !menus.topping.length) {
    return { ok: false, message: "The menu is currently unavailable. Please try again." };
  }

  const order: AgentOrder = {
    name: name.value!,
    phone: phone.value!,
    quantity: qty.value!,
    base_id: base.item!.id,
    pizza_id: pizza.item!.id,
    topping_id: topping.item!.id,
    payment_mode: payment,
  };

  // MONEY MATH BY core.ts — the LLM never computes prices.
  const bill = computeBill(base.item!.price, pizza.item!.price, topping.item!.price, qty.value!);
  bill.lineItems[0].item = base.item!.name;
  bill.lineItems[1].item = pizza.item!.name;
  bill.lineItems[2].item = topping.item!.name;

  return { ok: true, message: "", order, bill };
}

export async function POST(req: Request) {
  // Lazy, server-only secret read — never at import time, never sent to client.
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;

  if (!apiKey) {
    return NextResponse.json(
      {
        done: false,
        error:
          "The AI ordering agent is not configured. Set OPENROUTER_API_KEY in .env.local " +
          "(see README), or use the step-by-step order form instead.",
        unavailable: true,
      },
      { status: 503 }
    );
  }

  // Parse and lightly validate the incoming conversation.
  let body: { messages?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ done: false, error: "Invalid request body." }, { status: 400 });
  }

  const incoming = Array.isArray(body.messages) ? body.messages : [];
  const conversation: ChatMessage[] = incoming
    .filter(
      (m): m is ChatMessage =>
        !!m &&
        typeof m === "object" &&
        (((m as ChatMessage).role === "user") || (m as ChatMessage).role === "assistant") &&
        typeof (m as ChatMessage).content === "string"
    )
    .map((m) => ({ role: m.role, content: m.content }));

  if (conversation.length === 0) {
    return NextResponse.json(
      { done: false, error: "No messages provided." },
      { status: 400 }
    );
  }

  // Load the live menu (never throws; falls back to seed) and build the system message.
  const menus = await getMenus();
  const byId = indexById(menus);
  const systemContent = `${SYSTEM_PROMPT}\n\n${renderMenu(menus)}`;

  const messages: ChatMessage[] = [{ role: "system", content: systemContent }, ...conversation];

  // Call OpenRouter server-side.
  let modelReply: string;
  try {
    const res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        // Optional attribution headers per OpenRouter docs.
        "HTTP-Referer": "https://slicematic.app",
        "X-Title": "SliceMatic",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.3,
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return NextResponse.json(
        {
          done: false,
          error: `The AI service returned an error (${res.status}). Please try again or use the order form.`,
          detail: detail.slice(0, 500),
        },
        { status: 502 }
      );
    }

    const data = await res.json();
    modelReply = data?.choices?.[0]?.message?.content;
    if (typeof modelReply !== "string") {
      return NextResponse.json(
        { done: false, error: "The AI service returned an unexpected response." },
        { status: 502 }
      );
    }
  } catch {
    return NextResponse.json(
      {
        done: false,
        error: "Could not reach the AI service. Please try again or use the order form.",
      },
      { status: 502 }
    );
  }

  // If the model returned the final order JSON, validate + price it with core.ts.
  const parsed = extractOrderJson(modelReply);
  if (parsed && looksLikeOrder(parsed)) {
    const result = validateOrder(parsed, byId, menus);
    if (result.ok) {
      return NextResponse.json({ done: true, order: result.order, bill: result.bill });
    }
    // Model proposed an invalid order — DON'T finalise. Re-enter the loop with a
    // corrective assistant message so the conversation can recover.
    return NextResponse.json({
      done: false,
      reply: `Sorry, I couldn't confirm that order: ${result.message} Could you help me fix it?`,
    });
  }

  // Normal conversational turn.
  return NextResponse.json({ done: false, reply: modelReply });
}
