"""
app.py — SliceMatic ordering system (Stage 2 MVP) on Gradio.

A state-driven, step-by-step flow (NOT one giant form), as the brief requires:
  intake -> quantity -> base -> pizza -> topping -> bill -> payment -> done

All rules live in core.py; this file is only presentation + wiring.
Run:  pip install -r requirements.txt  &&  python app.py
"""

import gradio as gr
import core

ORDERS_LOG = "orders_log.txt"

# Load menus once at startup. If a file is missing/empty, fail gracefully
# with a visible message instead of crashing (rubric: "exit gracefully").
MENU_ERROR = None
try:
    MENUS = core.load_all_menus("menu")
except core.MenuLoadError as exc:
    MENUS = None
    MENU_ERROR = str(exc)


def _vis(show: bool):
    return gr.update(visible=show)


def build_app():
    with gr.Blocks(title="SliceMatic Ordering", theme=gr.themes.Soft()) as demo:
        gr.Markdown("# SliceMatic\nNew Ashok Nagar, Delhi — digital pizza ordering")

        if MENUS is None:
            gr.Markdown(f"### Cannot start: {MENU_ERROR}\n"
                        "Please restore the menu files and restart.")
            return demo

        state = gr.State({})  # per-session order data

        # ---- Step 1: customer intake -------------------------------------- #
        with gr.Group(visible=True) as g_intake:
            gr.Markdown("### Step 1 — Your details")
            name_in = gr.Textbox(label="Name (letters & spaces, 2-40 chars)")
            phone_in = gr.Textbox(label="Phone (10 digits, starts 6/7/8/9)")
            intake_err = gr.Markdown(visible=False)
            intake_btn = gr.Button("Continue", variant="primary")

        # ---- Step 2: quantity --------------------------------------------- #
        with gr.Group(visible=False) as g_qty:
            gr.Markdown("### Step 2 — How many pizzas? (1-10)")
            gr.Markdown("_10% discount automatically applies for 5 or more._")
            qty_in = gr.Textbox(label="Quantity")
            qty_err = gr.Markdown(visible=False)
            qty_btn = gr.Button("Continue", variant="primary")

        # ---- Step 3: base -------------------------------------------------- #
        with gr.Group(visible=False) as g_base:
            gr.Markdown("### Step 3 — Choose a base")
            gr.Markdown(core.render_menu(MENUS["base"]))
            base_in = gr.Textbox(label="Enter base number")
            base_err = gr.Markdown(visible=False)
            base_btn = gr.Button("Continue", variant="primary")

        # ---- Step 4: pizza ------------------------------------------------- #
        with gr.Group(visible=False) as g_pizza:
            gr.Markdown("### Step 4 — Choose a pizza")
            gr.Markdown(core.render_menu(MENUS["pizza"]))
            pizza_in = gr.Textbox(label="Enter pizza number")
            pizza_err = gr.Markdown(visible=False)
            pizza_btn = gr.Button("Continue", variant="primary")

        # ---- Step 5: topping ----------------------------------------------- #
        with gr.Group(visible=False) as g_topping:
            gr.Markdown("### Step 5 — Choose a topping")
            gr.Markdown(core.render_menu(MENUS["topping"]))
            topping_in = gr.Textbox(label="Enter topping number")
            topping_err = gr.Markdown(visible=False)
            topping_btn = gr.Button("See bill", variant="primary")

        # ---- Step 6: bill -------------------------------------------------- #
        with gr.Group(visible=False) as g_bill:
            gr.Markdown("### Step 6 — Your bill")
            bill_df = gr.Dataframe(
                headers=["Component", "Item", "Unit", "Qty", "Amount"],
                interactive=False, wrap=True)
            bill_html = gr.HTML()
            pay_btn = gr.Button("Proceed to payment", variant="primary")

        # ---- Step 7: payment ----------------------------------------------- #
        with gr.Group(visible=False) as g_pay:
            gr.Markdown("### Step 7 — Payment\n1. Cash   2. Card   3. UPI")
            pay_in = gr.Textbox(label="Enter 1, 2 or 3")
            pay_err = gr.Markdown(visible=False)
            confirm_btn = gr.Button("Pay & place order", variant="primary")

        # ---- Step 8: done -------------------------------------------------- #
        with gr.Group(visible=False) as g_done:
            done_md = gr.Markdown()

        # ------------------------- handlers -------------------------------- #
        def on_intake(s, name, phone):
            ok_n, msg_n, clean_n = core.validate_name(name)
            ok_p, msg_p, clean_p = core.validate_phone(phone)
            if not (ok_n and ok_p):
                err = " ".join(m for m in (msg_n, msg_p) if m)
                return s, gr.update(value=f"❌ {err}", visible=True), _vis(True), _vis(False)
            s = {**s, "name": clean_n, "phone": clean_p}
            return s, gr.update(visible=False), _vis(False), _vis(True)

        def on_qty(s, qty):
            ok, msg, val = core.validate_quantity(qty)
            if not ok:
                return s, gr.update(value=f"❌ {msg}", visible=True), _vis(True), _vis(False)
            s = {**s, "qty": val}
            return s, gr.update(visible=False), _vis(False), _vis(True)

        def _on_select(s, raw, key, items, err_stay, grp_next):
            ok, msg, idx = core.validate_selection(raw, len(items))
            if not ok:
                return s, gr.update(value=f"❌ {msg}", visible=True), _vis(True), _vis(False)
            s = {**s, key: items[idx - 1]}
            return s, gr.update(visible=False), _vis(False), _vis(True)

        def on_base(s, raw):
            return _on_select(s, raw, "base", MENUS["base"], base_err, g_pizza)

        def on_pizza(s, raw):
            return _on_select(s, raw, "pizza", MENUS["pizza"], pizza_err, g_topping)

        def on_topping(s, raw):
            ok, msg, idx = core.validate_selection(raw, len(MENUS["topping"]))
            if not ok:
                return (s, gr.update(value=f"❌ {msg}", visible=True), _vis(True),
                        _vis(False), gr.update(), gr.update())
            topping = MENUS["topping"][idx - 1]
            s = {**s, "topping": topping}
            bill = core.compute_bill(s["base"], s["pizza"], topping, s["qty"])
            s = {**s, "bill": bill}
            return (s, gr.update(visible=False), _vis(False), _vis(True),
                    core.bill_rows(bill), core.bill_html(bill, s["name"]))

        def on_proceed(s):
            return _vis(False), _vis(True)

        def on_pay(s, mode):
            ok, msg, mode_name = core.validate_payment(mode)
            if not ok:
                return s, gr.update(value=f"❌ {msg}", visible=True), _vis(True), _vis(False), gr.update()
            bill = s["bill"]
            record = core.serialize_order(s["name"], s["phone"], bill, mode_name)
            core.append_order(ORDERS_LOG, record)
            confirm = core.PAYMENT_CONFIRMATIONS[mode_name]
            msg_done = (f"## ✅ Order confirmed, {s['name']}!\n\n"
                        f"{confirm}\n\n"
                        f"**Amount: Rs.{bill.total:,.2f}** ({mode_name})\n\n"
                        f"Your order has been logged. Thank you for choosing SliceMatic.")
            return s, gr.update(visible=False), _vis(False), _vis(True), msg_done

        # ------------------------- bindings -------------------------------- #
        intake_btn.click(on_intake, [state, name_in, phone_in],
                         [state, intake_err, g_intake, g_qty])
        qty_btn.click(on_qty, [state, qty_in], [state, qty_err, g_qty, g_base])
        base_btn.click(on_base, [state, base_in], [state, base_err, g_base, g_pizza])
        pizza_btn.click(on_pizza, [state, pizza_in], [state, pizza_err, g_pizza, g_topping])
        topping_btn.click(on_topping, [state, topping_in],
                          [state, topping_err, g_topping, g_bill, bill_df, bill_html])
        pay_btn.click(on_proceed, [state], [g_bill, g_pay])
        confirm_btn.click(on_pay, [state, pay_in],
                          [state, pay_err, g_pay, g_done, done_md])
    return demo


if __name__ == "__main__":
    build_app().launch()
