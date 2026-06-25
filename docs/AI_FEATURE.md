# SliceMatic — AI Feature

**FDE Programme · Batch 2487 · Stage 3** · Powered by **OpenRouter**.

> Rule 4: *no two teams may submit the same AI feature implementation; first to commit on GitHub
> owns it.* Committing this doc early stakes our claim. The repo name —
> `Slicematic_Agentic_Flow` — reflects our **primary** choice: **Option B, the conversational
> ordering agent.**

---

## Primary feature — Option B: Conversational Ordering Agent

Replace the form-based flow with a chat interface. The customer orders in natural language; an
LLM agent (via OpenRouter) **extracts and confirms** the required fields — name, phone, quantity,
base, pizza, topping, payment mode — handles ambiguity ("something spicy"), and re-prompts for
anything missing. **All business logic (validation, pricing, discount, GST) stays in code** —
the LLM never does arithmetic or invents menu items.

### Why this design

- **Hard boundary between language and logic.** The model's only job is to turn messy text into a
  structured, *proposed* order. `core.py` (or its TS port) validates every field and computes
  every rupee, so the bill is always correct and deterministic regardless of what the LLM says.
- **Ambiguity handling.** "Something spicy" → the agent maps to menu items tagged spicy
  (Jalapenos / Peri-Peri Drizzle) and asks the customer to confirm, rather than guessing silently.
- **Graceful fallback.** If OpenRouter is unavailable or returns malformed JSON, the UI falls back
  to the Stage 2 step form — ordering never breaks because of the AI layer.

### Model choice

Primary: a fast, low-cost instruction-following model via OpenRouter (e.g.
`openai/gpt-4o-mini` or `anthropic/claude-3.5-haiku`) — strong structured-extraction quality at
low latency/cost, which suits a per-message ordering loop. The exact model string is set via env
var so it can be swapped without code changes. Document the final choice + rationale in the
README before the demo.

### System prompt (documented — copy into README)

```
You are SliceMatic's ordering assistant for a single pizza outlet in New Ashok Nagar, Delhi.
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
Until then, reply conversationally with your next question.
```

The backend validates the returned JSON with `core.py` and only then prices and persists the
order. A malformed/partial JSON re-enters the conversation loop.

---

## Bonus options (Rule ★: up to +10 for implementing more than one)

- **Option A — Recommendation engine.** After name + phone, query Supabase for the customer's
  past orders, send the history to OpenRouter, and show a personalised "your usual / try this"
  pizza+topping suggestion before menu selection. (Low effort once order history exists.)
- **Option C — Demand forecasting.** Train a scikit-learn `RandomForestRegressor` on order
  history to predict volume by hour-of-day and day-of-week; chart it on the admin dashboard and
  surface the top-3 predicted peak hours for the next 7 days. Report RMSE. (Directly powers the
  rostering decision in `BUSINESS_ECONOMICS.md` Q3 and Q6.)
- **Option D — Voice ordering agent (our differentiator).** A speech layer *on top of* the
  conversational agent above: the customer **speaks** their order, browser speech-to-text
  (Web Speech API `SpeechRecognition`) feeds the transcript into the same agent loop, and the
  agent's replies are **spoken back** via text-to-speech (`SpeechSynthesis`). This closes the
  loop on SliceMatic's origins — the outlet started with customers phoning in orders, and voice
  restores that "just talk" experience while the flow stays automated, validated, and logged.
  Runs in-browser at **zero extra API cost**, **degrades gracefully to typing** if the browser
  lacks speech support or mic permission is denied, and — like Option B — never lets the model
  touch pricing: `core.py` (or its TS port) validates and computes every rupee. *Stretch:* swap
  Web Speech for Whisper (STT) via OpenRouter for noisy-environment accuracy.

> **Bonus strategy (Rule ★, +10):** shipping the conversational agent (B) **plus** one of A or C
> already secures the bonus, since those are the explicitly-recognised features. The voice agent
> (D) is layered on B as the live-demo differentiator — the app a grader can *talk to*.

**Coordinate the claim on GitHub early** — commit this file in week 1 so the conversational agent
is registered to our team before another team takes it.
