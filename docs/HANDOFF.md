# SliceMatic — Session Handoff & Next Steps

**Repo:** https://github.com/omiiii21/Slicematic_Agentic_Flow
**Team:** Om, Febin, Alok, Guru, Rahul · **As of:** 2026-07-01 · **Stage 3 due:** Jul 2

> Purpose: hand the full project context to a fresh session (human or AI). Read this + the
> Stage 3 README, then drive the deploy. Everything is built and pushed — the remaining work is
> cloud setup (Om's accounts), the Loom, and teammate commits.

---

## TL;DR — what's next
**Deploy the Stage 3 app live on Vercel + Supabase + OpenRouter.** Full runbook lives in
[`stage3-fullstack/README.md`](../stage3-fullstack/README.md); condensed below.

## Where things stand
| Stage | State |
|---|---|
| **Stage 1** — PRD + economics (20 pts, due Jun 25) | ✅ Docs written; `SliceMatic_Stage1_Submission.pdf` generated + committed. (Confirm it's uploaded to the FDE portal.) |
| **Stage 2** — Gradio MVP (30 pts, due Jun 27) | ✅ Built; tests pass (reference bill **Rs.3,594.87** + all 8 edge cases). Files in `stage2-gradio/`. Being hosted on Hugging Face Spaces (`Lumo21/slicematic`). |
| **Stage 3** — Next.js + Supabase + OpenRouter (50 pts, due Jul 2) | ✅ Fully built, frontend redesigned, pushed. **NOT deployed yet — this is the main remaining task.** |
| Pitch deck | ✅ `pitch/index.html` (7 slides) + `pitch/SPEAKER_NOTES.md` (2-min script). Hosted on GitHub Pages. |

Latest state is pushed to `main`. The Stage 3 app builds clean (`npm run build`) and **degrades
gracefully without env vars** (the menu falls back to a hardcoded seed, so `/order` renders offline).

## Immediate goal — deploy Stage 3 (condensed runbook)
App is in `stage3-fullstack/` (Next.js App Router + TypeScript). Om must do the account-bound steps:
1. **Supabase** → create a project → SQL editor: run `supabase/schema.sql`, then `supabase/seed.sql`
   → Authentication → add one admin email/password user → Settings → API: copy **Project URL** + **anon** key.
2. **OpenRouter** → create an API key (model defaults to `openai/gpt-4o-mini`).
3. **Vercel** → import the GitHub repo → **set Root Directory = `stage3-fullstack`** → add the 4 env
   vars → Deploy.
4. Env vars (never commit real keys): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`.
5. Share the live Vercel URL + give the grader **read-only Supabase access**.

## Key facts / conventions — DO NOT break
- **Git identity:** commit as `omiiii21` / `omengshetti@gmail.com`. **No forged co-authors, no AI
  `Co-Authored-By` trailer.** The "commits from all members" rule is satisfied by teammates making
  their own real commits — never fabricated.
- **Frozen pricing/validation:** unit = base + pizza + topping; **10% discount at qty ≥ 5**; **18%
  GST on the post-discount total**; reference order (Cheese Burst + BBQ Chicken + Extra Cheese, qty 5)
  = **Rs.3,594.87**. Lives in `stage2-gradio/core.py`, ported to `stage3-fullstack/lib/core.ts`
  (asserted by `lib/core.test.ts`). Do not change the math. Live-demo trick: change
  `BULK_DISCOUNT_MIN_QTY` 5 → 3 in one place.
- **Commit cadence:** real per-stage commits, dated when the work lands. Never backdate.

## Open threads
- [ ] **Deploy Stage 3** on Vercel/Supabase/OpenRouter (above) — the main task.
- [ ] **Teammate commits** — all Stage 3 commits are currently Om's. Get Febin/Alok/Guru/Rahul to
      commit real work (UI polish, the Loom, copy tweaks) so the version-control marks hold.
- [ ] **Four teammate GitHub handles** to finish the README "Team" line.
- [ ] **Loom video** (3–5 min) — a Stage 3 submission requirement.
- [ ] **Live demo prep** — each member explains a random function + modifies a live feature.
- [ ] Verify the **admin dashboard** live once Supabase is connected (couldn't test without keys).
- [ ] Optional cleanup: delete the stale `pitch/index.stable.html` fallback.

## Gotchas learned this session (don't re-discover)
- **HF Spaces + Gradio:** Python 3.13 removed stdlib `audioop`, and Gradio 4.x is incompatible with
  2026-current fastapi/starlette/jinja2/huggingface_hub → cascading import/serve errors.
  **Fix = Gradio 5** (`gradio==5.50.0`, already in `stage2-gradio/requirements.txt`). The Space also
  needs the `menu/` folder (the 3 `.txt` files) at its **root** or the app shows "Menu file not found".
- **next/font:** don't redefine `--font-display` / `--font-body` in CSS — next/font sets them on
  `<html>`; a circular `var()` reference breaks the fonts (silent serif fallback). Use the vars directly.
- **Windows sandbox:** `Remove-Item -Recurse -Force` is blocked; use git commands (`git update-ref -d`)
  or non-recursive deletes instead.
- **Verifying the app:** `cd stage3-fullstack && npm run build` + `npm run test:core`; for visuals,
  `npm run start` then screenshot with Playwright via system Chrome. `/order` works without Supabase
  (seed-menu fallback), so it's fully demoable offline.

## Frontend design language (Stage 3)
"Wood-fired warmth" — warm semolina canvas, **tomato** brand + **cheese-amber** + **basil-green**
accents, espresso ink, soft shadows; **Bricolage Grotesque** (display) + **Inter** (body) via
next/font; the bill is styled as a kitchen receipt. All driven by tokens in
`stage3-fullstack/app/globals.css`, so a token change restyles every surface. Deliberately distinct
from the dark+red pitch deck.
