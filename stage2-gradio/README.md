---
title: SliceMatic Pizza Ordering
emoji: 🍕
colorFrom: red
colorTo: yellow
sdk: gradio
sdk_version: 4.44.1
python_version: "3.12"
app_file: app.py
pinned: false
license: mit
---

# SliceMatic — Gradio MVP (Stage 2)

A guided, validated pizza-ordering flow for a single outlet in New Ashok Nagar, Delhi.
Built with **Gradio**; all pricing and validation live in `core.py` — a dependency-free
module reused unchanged by the Stage 3 full-stack app.

**Flow:** intake → quantity → base → pizza → topping → itemised bill → payment → confirmation.

- Every input is validated (specific errors, never a crash).
- 10% bulk discount at qty ≥ 5; 18% GST on the **post-discount** total.
- Menus load from `menu/*.txt` at startup — nothing hardcoded, so the files are swap-safe.
- Reference order (Cheese Burst + BBQ Chicken + Extra Cheese, qty 5) = **Rs.3,594.87**.

## Run locally

```bash
pip install -r requirements.txt
python app.py
```

Run the checks (no pytest needed):

```bash
python tests/test_core.py
```

> **On Hugging Face Spaces** the filesystem is ephemeral, so `orders_log.txt` writes won't
> persist across restarts — fine for a live demo. If the build flags `sdk_version`, set it to a
> current Gradio 4.x (e.g. `4.44.0`) or remove the line to let `requirements.txt` decide.

Part of the SliceMatic project — full repo:
<https://github.com/omiiii21/Slicematic_Agentic_Flow>
