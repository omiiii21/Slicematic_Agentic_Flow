# Decision Log — SliceMatic

**FDE Programme · Batch 2487**
Architecture Decision Records (ADRs) for the SliceMatic pizza-ordering system.

This log records *why* the project is built the way it is — not just what was built. It exists for
two reasons: (1) it's the kind of deliberate engineering trail graders reward, and (2) the Stage 3
live demo requires each team member to justify a function, a table, or a design choice on the spot.
Every entry below has a **Demo defense** line for exactly that moment.

**Status legend** — `Accepted`: settled, implemented. `Assumed`: a judgement call made without full
information; revisit if the brief clarifies. `Planned`: agreed for a later stage, not yet built.

| # | Decision | Area | Status |
|---|----------|------|--------|
| 001 | Single-outlet, no-auth, no-inventory MVP scope | Product | Accepted |
| 002 | Claim Option B (conversational agent) as primary AI feature | Product / Strategy | Assumed |
| 003 | Prices GST-exclusive; discount **then** GST | Pricing | Accepted |
| 004 | Resolve three reference-doc inconsistencies explicitly | Economics | Accepted |
| 005 | Separate pure logic (`core.py`) from UI (`app.py`) | Architecture | Accepted |
| 006 | Business rules as named constants at top of `core.py` | Architecture | Accepted |
| 007 | Defensive, schema-tolerant menu loading | Stage 2 | Accepted |
| 008 | Validators return `(ok, message, value)` instead of throwing | Stage 2 | Accepted |
| 009 | Free-text input + validation, not constrained widgets | Stage 2 | Accepted |
| 010 | Flat-file `orders_log.txt` for Stage 2 persistence | Stage 2 | Accepted |
| 011 | Dependency-free tests (no pytest) | Stage 2 | Accepted |
| 012 | Contribution-margin model; break-even in orders/day | Economics | Accepted |
| 013 | Supabase (Postgres + Auth), 3-table normalised schema | Stage 3 | Planned |
| 014 | LLM never performs arithmetic — pricing stays in code | Stage 3 / AI | Accepted |
| 015 | Model via OpenRouter, env-var swappable | Stage 3 / AI | Planned |
| 016 | Markdown docs for the repo; PDF only for Stage 1 submission | Process | Accepted |
| 017 | Commit the assignment brief + reference files under `docs/reference/` | Version control | Accepted |
| 018 | Author our own commits; no forged co-authors or AI trailer | Version control | Accepted |
| 019 | Stage-paced incremental commits, never backdated | Version control | Accepted |
| 020 | Voice ordering agent (Option D) as a bonus AI feature + future scope | Product / AI | Accepted |
| 021 | Rewrite the README as a graded presentation surface | Presentation | Accepted |
| 022 | Generate the Stage 1 PDF reproducibly; track the final PDF in the repo | Tooling | Accepted |

---

## Product & scope

### ADR-001 — Scope the MVP to a single outlet, no auth, no inventory
**Status:** Accepted

**Context.** The brief is a single pizza outlet in New Ashok Nagar. Stages 1–2 are graded on a
correct ordering flow and sound economics, not on operational completeness.

**Decision.** Stages 1–2 implement guest ordering only: no login, no live stock levels, no real
payment capture. Customer auth and a persistent menu table arrive in Stage 3 via Supabase.

**Rationale.** Every hour spent on inventory or payments is an hour not spent on the things actually
scored. The PRD names these as known limitations rather than hiding them — honest scoping reads as
maturity, not as a gap.

**Alternatives considered.** Build auth/inventory up front — rejected as out of scope for the points
on offer and a deadline risk.

**Trade-off.** The Stage 2 app can't prevent ordering an out-of-stock item. Acceptable: there is no
stock concept in the brief's data.

**Demo defense.** "We scoped to what's graded each stage and documented the rest as explicit
limitations in the PRD — inventory and payments are deliberate Stage-3-or-later items, not
oversights."

### ADR-002 — Claim Option B (conversational ordering agent) as the primary AI feature
**Status:** Assumed — revisit only if the team prefers a different feature

**Context.** Rule: *the first team to commit an AI feature to GitHub owns it.* The brief offers
multiple AI options. Our repo is named `Slicematic_Agentic_Flow`.

**Decision.** Stake **Option B — a conversational ordering agent** as the headline feature, fully
specified in `docs/AI_FEATURE.md`, and commit that file early to plant the flag. Options A
(recommendations) and C (demand forecasting) are documented as bonus features (+10 for shipping more
than one).

**Rationale.** The repo name already signals an agentic flow, so Option B is the on-brand claim. The
ownership rule rewards committing the *specification* early, before the code exists.

**Alternatives considered.** Lead with Option A (recommendation engine) — simpler, but doesn't match
the repo's identity and is a weaker centrepiece.

**Trade-off.** This is an assumption about team intent. It's cheap to change: swap which option
`AI_FEATURE.md` frames as primary. The cost of being wrong is one doc edit; the cost of committing
late is losing the feature to another team.

**Demo defense.** "We committed the AI feature spec on day one to claim it under the ownership rule —
the conversational agent matches our repo name, and we layered two more AI features on top for the
bonus."

---

## Pricing & correctness

### ADR-003 — Prices are GST-exclusive; apply the discount first, then GST
**Status:** Accepted

**Context.** The menu files list prices with no tax treatment stated. The bill must show a discount
and 18% GST, and the grader checks totals against a reference bill.

**Decision.** Treat menu prices as **GST-exclusive**. Compute `unit = base + pizza + topping`,
`subtotal = unit × qty`, apply the 10% bulk discount when `qty ≥ 5`, **then** apply 18% GST to the
post-discount amount. Verified against the reference bill: subtotal 3385 → −338.50 → 3046.50 →
+548.37 GST → **Rs.3,594.87**.

**Rationale.** Discount-then-GST is how Indian GST invoices actually work (tax is charged on the
discounted taxable value), and it's the ordering that reproduces the reference total exactly.

**Alternatives considered.** GST-inclusive prices, or GST-before-discount — both fail to reproduce
the reference bill.

**Trade-off.** If the grader's hidden menu assumes inclusive pricing we'd be off, but the reference
bill is unambiguous evidence for the exclusive reading.

**Demo defense.** "GST is charged on the post-discount taxable value, per standard GST invoicing —
and it's the only ordering that reproduces the reference bill of Rs.3,594.87 to the paisa."

### ADR-004 — Resolve the three reference-document inconsistencies explicitly
**Status:** Accepted

**Context.** The reference economics PDF contradicts itself in three places.

**Decision.** Pick the defensible reading for each and document it in `docs/BUSINESS_ECONOMICS.md`:
(1) **AOV** quoted both ex-GST and inclusive → use **ex-GST** throughout, consistent with ADR-003;
(2) **delivery cost** quoted per-order and per-pizza → treat as **per-order**, the realistic unit;
(3) **ingredient COGS** quoted as both Rs.148 and Rs.130 → use the higher **Rs.148** as the
conservative figure and note the gap.

**Rationale.** The brief explicitly invites us to *challenge the numbers*. Surfacing the
contradictions and justifying a choice scores better than silently picking one.

**Trade-off.** Our headline figures differ slightly from a naive read of the PDF — but they're
internally consistent and defended, which is the point.

**Demo defense.** "The reference doc is internally inconsistent in three places; we flagged each,
chose the conservative and consistent reading, and showed the working — that's the 'challenge these
numbers' brief, done."

---

## Architecture

### ADR-005 — Separate pure business logic (`core.py`) from the UI (`app.py`)
**Status:** Accepted

**Context.** Stage 2 is a Gradio app; Stage 3 is a Next.js + Supabase rewrite. The pricing and
validation rules are identical across both.

**Decision.** Put all framework-free logic — menu loading, validation, `compute_bill`,
serialisation — in `core.py`. `app.py` only wires Gradio widgets to those functions. Stage 3's
backend re-implements the same rules from the same source of truth.

**Rationale.** The rules are the asset; the UI is disposable. Isolating them means the logic is
unit-testable without a browser and portable into Stage 3 unchanged.

**Alternatives considered.** Logic inline in the Gradio callbacks — faster to write, but untestable
and unportable, and a near-certain source of Stage 3 drift.

**Trade-off.** Slightly more indirection in Stage 2. Worth it.

**Demo defense.** "Pricing and validation live in `core.py` with zero framework imports, so the same
tested rules drive both the Gradio MVP and the Stage 3 backend — no chance of the two disagreeing."

### ADR-006 — Encode business rules as named constants at the top of `core.py`
**Status:** Accepted

**Context.** The Stage 3 live demo may ask us to *change a live rule* — e.g. drop the bulk-discount
threshold from 5 to 3.

**Decision.** Hoist every tunable to a named constant: `GST_RATE = 0.18`,
`BULK_DISCOUNT_RATE = 0.10`, `BULK_DISCOUNT_MIN_QTY = 5`, `MIN_QTY = 1`, `MAX_QTY = 10`. No magic
numbers in the logic body.

**Rationale.** A demo rule-change becomes a one-line, one-place edit anyone on the team can make live
without hunting through code.

**Demo defense.** "Changing the discount threshold is one line — `BULK_DISCOUNT_MIN_QTY` at the top
of `core.py`. *(edits 5 → 3, reruns, shows the discount now triggering at 3.)*"

### ADR-007 — Defensive, schema-tolerant menu loading
**Status:** Accepted

**Context.** The Stage 2 grader **swaps the three menu `.txt` files** at test time and demands zero
unhandled exceptions across 8 edge cases.

**Decision.** `load_menu` reads `ID;Name;Price`, is BOM-safe (`utf-8-sig`), trims whitespace, skips
malformed or blank lines instead of crashing, and raises `MenuLoadError` *only* when a file is
missing or empty. Nothing about menu contents — IDs, counts, prices — is hardcoded anywhere.

**Rationale.** The swap is the whole test. Any assumption about specific IDs or item counts is a
guaranteed failure on the swapped set.

**Trade-off.** A subtly malformed row is silently dropped rather than reported. For a robustness
test that's the safer failure mode.

**Demo defense.** "Nothing reads a hardcoded menu — `load_menu` parses whatever three files it's
given, skips junk rows, and only errors on a missing or empty file, which is why the menu swap
doesn't faze it."

### ADR-008 — Validators return `(ok, message, value)` tuples instead of raising
**Status:** Accepted

**Context.** Every input (name, phone, quantity, menu selection, payment mode) needs validation, and
the UI must show a friendly re-prompt rather than a stack trace.

**Decision.** Each validator returns `(ok: bool, message: str, value)`. The UI branches on `ok`,
shows `message` on failure, and uses the cleaned `value` on success.

**Rationale.** Turns validation into ordinary control flow, keeps the "zero unhandled exceptions"
guarantee structural rather than reliant on try/except scattered through the UI, and makes each rule
trivially unit-testable.

**Demo defense.** "Validation returns a status tuple, not an exception — the UI just reads the
boolean and the message, so bad input is normal flow, never a crash."

---

## Stage 2 — Gradio MVP

### ADR-009 — Free-text input + validation, not constrained dropdowns/radios
**Status:** Accepted

**Context.** Gradio could constrain choices with `Radio`/`Dropdown`, making invalid input nearly
impossible — but the rubric specifically tests handling of *invalid* input across 8 edge cases.

**Decision.** Accept free text and run it through the `core.py` validators, so the app genuinely
exercises the bad-input paths the grader checks (non-numeric quantity, out-of-range selection,
empty name, bad phone, etc.).

**Rationale.** Constrained widgets would hide the exact behaviour being graded. We want the
edge-case handling to actually run, not be designed away.

**Trade-off.** A polished consumer app would constrain inputs; here, demonstrating robust validation
scores the points.

**Demo defense.** "We took text input on purpose — the rubric grades invalid-input handling, so the
app has to actually receive and reject bad input, which constrained widgets would have hidden."

### ADR-010 — Flat-file `orders_log.txt` for Stage 2 persistence
**Status:** Accepted

**Context.** Stage 2 must persist orders and submit a sample `orders_log.txt`; a database is out of
scope until Stage 3.

**Decision.** Append each order as a pipe-separated `key=value` block, blank-line separated. A sample
file with three orders ships in the repo and round-trips cleanly (serialise → parse verified in
tests).

**Rationale.** Matches the required deliverable, needs no dependencies, and is human-readable for
graders.

**Trade-off.** Flat files don't scale and have no concurrency safety — documented in the PRD as a
limitation that Stage 3's Postgres resolves.

**Demo defense.** "Stage 2 logs to a flat file because that's the deliverable and it needs no
dependencies; the PRD already names its limits, and Stage 3 moves persistence to Postgres."

### ADR-011 — Tests run with no third-party dependencies
**Status:** Accepted

**Context.** Graders run code in an unknown environment; an uninstalled `pytest` shouldn't be able to
break the test run.

**Decision.** `tests/test_core.py` runs as `python tests/test_core.py` with plain asserts and a
hand-rolled runner — no pytest, no fixtures.

**Rationale.** Removes an environment dependency from the one thing that proves correctness. The
suite covers the reference bill, the discount boundary, all 8 edge cases, menu-swap/malformed
parsing, and log round-tripping.

**Demo defense.** "The tests are dependency-free — `python tests/test_core.py` — so correctness
doesn't hinge on whatever is or isn't installed on the grading box."

---

## Business & economics

### ADR-012 — Model the business on contribution margin; express break-even in orders/day
**Status:** Accepted

**Context.** Stage 1B asks for unit economics and answers to six challenge questions.

**Decision.** Build a contribution-margin model — per-order revenue minus variable cost (COGS +
per-order delivery + aggregator commission where relevant) — and express break-even as **orders per
day** against monthly fixed costs (~Rs.2,02,910/mo). Every challenge question is answered with
explicit arithmetic, not assertion.

**Rationale.** Orders/day is the unit a shop owner actually feels, and contribution margin is the
right lens for "should we add a discount / a third rider / take an aggregator deal" questions.

**Demo defense.** "We work in contribution margin and break-even orders/day — so every 'what if'
question becomes 'how many more orders does this need', which we answer with the math in
`BUSINESS_ECONOMICS.md`."

---

## Stage 3 — data & AI

### ADR-013 — Supabase (Postgres + Auth) with a normalised 3-table schema
**Status:** Planned

**Context.** Stage 3 requires Vercel + Supabase (Postgres + Auth) and a schema each member can
justify live.

**Decision.** Three normalised tables: **`menus`** (items, prices, availability), **`orders`**
(customer, totals, payment, timestamp), **`order_items`** (line items linking an order to menu
items with quantity). Schema and constraints are specified in `docs/SPEC.md`.

**Rationale.** `menus` as its own table lets the admin change prices/availability without a
redeploy. Splitting `orders` from `order_items` is textbook normalisation — one order has many
lines — and keeps line-level detail queryable for the BI metrics in the economics doc.

**Alternatives considered.** A single flat `orders` table with a JSON blob of items — rejected:
unqueryable line items and no referential integrity.

**Demo defense.** "`order_items` is separate because an order has many lines — normalising it keeps
each line queryable for analytics and lets prices live in `menus` so the admin changes them without
a deploy."

### ADR-014 — The LLM never performs arithmetic; pricing stays deterministic in code
**Status:** Accepted (boundary set now, enforced in Stage 3)

**Context.** The Stage 3 AI feature is a conversational agent, and LLMs are unreliable at exact
arithmetic.

**Decision.** A hard boundary: the model's only job is turning messy text into structured fields
(name, phone, quantity, selections). Every rupee is computed by the same `core.py` logic the rest of
the system uses. If the model returns malformed JSON or is unavailable, the UI falls back to the
structured flow.

**Rationale.** Bills must be exact and reproducible. Keeping math out of the model removes a whole
class of "the AI quoted the wrong price" failures and keeps one source of truth for pricing.

**Demo defense.** "The model only extracts fields — it never does math. Pricing runs through the
same `compute_bill` as everything else, so the agent can't misquote a total, and a bad LLM response
just falls back to the form."

### ADR-015 — Serve the model via OpenRouter, swappable by env var
**Status:** Planned

**Context.** The brief mandates OpenRouter; model quality/price/latency trade-offs may shift before
the demo.

**Decision.** Call models through OpenRouter with the model string set via an environment variable.
Default to a fast, cheap, strong-extraction model — `openai/gpt-4o-mini` or
`anthropic/claude-3.5-haiku`. Keys live only in `.env` (git-ignored), never in tracked files.

**Rationale.** Per-message ordering wants low latency and low cost; env-var swapping lets us retune
without code changes, and keeping keys out of git is non-negotiable.

**Demo defense.** "The model string is an env var, so we can swap models without touching code, and
no key is ever committed — `.env` is git-ignored."

### ADR-016 — Markdown for repo docs; PDF only for the Stage 1 submission
**Status:** Accepted

**Context.** Docs need to look credible in the repo *and* meet Stage 1's "PDF or Notion" submission
format.

**Decision.** Author all docs as Markdown so they render natively on GitHub and diff cleanly in
version control. Export only the Stage 1 PRD + economics to PDF for the formal submission.

**Rationale.** Markdown is the right format for a living, version-controlled doc; PDF is a
submission artifact, not a working format. No reason to pay the PDF/diff cost for docs that keep
changing.

**Demo defense.** "Docs are Markdown so they version and render on GitHub; we export to PDF only for
the Stage 1 hand-in, because PDF is a submission format, not a working one."

---

## Version control & collaboration

> ADR-017 to 022 record decisions taken during the build/handover phase (June 25), once the
> starter files were turned over and the repository was set up.

### ADR-017 — Commit the assignment brief and reference files under `docs/reference/`
**Status:** Accepted

**Context.** The handover included the instructor's `PizzaFlow_Assignment_Brief_FDE.pdf`, the
`SliceMatic_Business_Economics.pdf` reference model, and the original three menu `.txt` files —
none of them our own work.

**Decision.** Keep them in the repo under `docs/reference/`, clearly separated from our authored
docs in `docs/`, rather than discarding them or leaving them loose at the root.

**Rationale.** A self-contained repo lets a grader, or a teammate joining late, see exactly what we
were asked to build without chasing external files — and the reference model is the baseline our
economics is reconciled against (ADR-004). The `docs/reference/` path signals "given, not authored."

**Alternatives considered.** Git-ignore them to keep the tree to our own work — rejected; ~230 KB is
a fair price for provenance and defensibility.

**Trade-off.** Two binary PDFs that don't diff. Acceptable for source material that never changes.

**Demo defense.** "Everything we were handed lives under `docs/reference/`, kept apart from our own
docs, so the repo is self-contained and our economics can be checked against the exact reference."

### ADR-018 — Author our own commits; no forged co-authors or AI-assistant trailer
**Status:** Accepted

**Context.** Version control is graded and the rubric requires "commits from all team members." AI
tooling helped build the project (which the brief encourages). Two shortcuts tempt here: fabricating
co-authors to satisfy the all-members rule, or auto-stamping an AI `Co-Authored-By` trailer on every
commit.

**Decision.** Each member authors their own commits under the git identity tied to their own GitHub
account. We do **not** fabricate co-authors, and we do **not** append an AI-assistant trailer.

**Rationale.** The all-members requirement is met honestly by each person making real commits, not by
faked attribution — which is both detectable and against the spirit of the brief. A truthful
authorship trail is exactly what the rubric checks.

**Trade-off.** It forces real coordination: every teammate commits their own genuine work instead of
one person uploading everything. That coordination is the point.

**Demo defense.** "Every commit is authored by the person who wrote it, under their own GitHub
identity — nothing was faked to satisfy the all-members rule; the history is exactly who did what."

### ADR-019 — Stage-paced incremental commits, never backdated
**Status:** Accepted

**Context.** The rubric zeroes a single final-day upload and rewards commits spread across the three
weeks. A commit's author-date is fixed when it is created — pushing later does not move it earlier —
so an early-built artifact committed all at once still reads as a one-day dump.

**Decision.** Commit each stage's work on or near the day it lands: Stage 1 docs committed and pushed
June 25; the already-written Stage 2 app held uncommitted on disk until ~June 27 and committed then;
Stage 3 as it is built. We never alter commit dates. (An initial pass staged all stages locally at
once; since nothing had been pushed, we reset the unpushed history and re-paced it.)

**Rationale.** A genuine, distributed history is the honest way to earn the version-control marks —
and the only way, since author-dates can't be moved truthfully after the fact.

**Trade-off.** Finished Stage 2 code sits untracked for two days, a small accidental-loss risk before
it's committed. Worth it for a truthful history; the working tree backs it up meanwhile.

**Demo defense.** "Our history shows each stage committed when it landed, not one dump — and the
dates are real, because commit dates are set at commit time and we never rewrote them."

---

## AI feature scope

### ADR-020 — Add a voice ordering agent (Option D) as a bonus AI feature and future scope
**Status:** Accepted — feature implementation Planned for Stage 3

**Context.** SliceMatic's status quo is phone ordering. Our primary AI feature is the conversational
agent (ADR-002); the brief offers +10 for shipping more than one AI feature, and the live demo
rewards a memorable differentiator.

**Decision.** Document a **voice ordering agent** as Option D: browser speech-to-text feeds the same
conversational-agent loop, and replies are spoken back via text-to-speech, dropping to typing where
speech is unavailable. Recorded in `AI_FEATURE.md`, the PRD's future-scope, and the Stage 3 roadmap.
Like the text agent, it never lets the model do arithmetic (ADR-014).

**Rationale.** Voice closes the loop on the outlet's phone-ordering origin — customers still "just
talk," but the call is now automated, validated, and logged — and it runs in-browser at no extra API
cost. For the guaranteed bonus we still ship one of the brief's listed options (A or C); voice is the
demo differentiator layered on top.

**Trade-off.** Layered on Option B, voice can read as an enhancement rather than a distinct feature —
so we don't rely on it alone for the +10. Implementation waits for the Stage 3 app to exist.

**Demo defense.** "The outlet started on the phone, so we're bringing voice back — speech in, speech
out, the same validated agent underneath. Browser-native, no extra cost, and it falls back to typing."

---

## Presentation & delivery

### ADR-021 — Rewrite the README as a graded presentation surface
**Status:** Accepted

**Context.** Graders open the repo and the README is the first thing they read. The initial version
was serviceable but generic: an emoji-heavy status table, nearly every line bolded, a
machine-generated cadence.

**Decision.** Rewrite it problem-first (lead with the business problem), in a natural engineering
voice, with near-zero emojis, shields.io badges for stack and stage status, the architecture diagram,
and real team names. One subtle animated tagline; no gimmicks.

**Rationale.** The README is part of the score, not just documentation. A repo that reads like a real
team wrote it — concrete problem, honest status, clean structure — lands better than a templated one.

**Trade-off.** Time on presentation rather than features, justified because repo presentation is
explicitly part of how Stage 3 is judged.

**Demo defense.** "The README opens with the actual problem and reads like we wrote it, not a
generator — because it's the first thing a grader sees and it counts toward the marks."

### ADR-022 — Generate the Stage 1 PDF reproducibly, and track the final PDF in the repo
**Status:** Accepted

**Context.** Stage 1 submits as a PDF (ADR-016), built from `PRD.md` + `BUSINESS_ECONOMICS.md` and
including a Mermaid user-flow diagram. The build machine had no `pandoc` or `wkhtmltopdf`.

**Decision.** Convert the Markdown to a styled HTML with a cover page and print it to A4 via headless
Chrome driven by Playwright, rendering Mermaid from a locally-cached `mermaid.min.js` so the diagram
is real vector graphics and the output never depends on a live CDN. The generator script is kept, and
the **final `SliceMatic_Stage1_Submission.pdf` is committed** to the repo.

**Rationale.** A scripted, dependency-pinned pipeline regenerates the exact PDF whenever the docs
change. Committing the final PDF gives the team and graders the precise artifact submitted, with
provenance in git — a submission snapshot, distinct from the always-Markdown working docs (ADR-016).

**Trade-off.** A binary PDF in the tree that won't diff, and it must be regenerated rather than
hand-edited when the source changes. Acceptable: it's the hand-in of record, not a working file.

**Demo defense.** "The Stage 1 PDF is generated from the Markdown by a script — headless Chrome with
locally-bundled Mermaid — so it's reproducible, and we commit the final file as the submission of
record."

---

## How to maintain this log

Add a new ADR whenever the team makes a choice that someone could later reasonably ask "why did you
do it that way?" — a schema change, a new dependency, picking one library over another, changing a
business rule. Keep entries short: context, decision, why, trade-off. Never delete a superseded
decision — mark it `Superseded by ADR-0NN` so the reasoning trail stays intact. Number ADRs
sequentially and add a row to the index table at the top.