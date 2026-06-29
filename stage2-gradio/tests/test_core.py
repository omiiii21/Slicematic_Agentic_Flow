"""
test_core.py — runnable with `python tests/test_core.py` (plain asserts, no pytest needed)
or `pytest`. Verifies the reference sample bill and all 8 grader edge cases.
"""
import os
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import core  # noqa: E402


def test_reference_sample_bill():
    """Reference doc: Cheese Burst(229)+BBQ Chicken(379)+Extra Cheese(69), qty 5
       -> subtotal 3385, -10% = 3046.50, +18% GST = total 3594.87."""
    base = core.MenuItem("B3", "Cheese Burst", 229)
    pizza = core.MenuItem("P7", "BBQ Chicken", 379)
    topping = core.MenuItem("T2", "Extra Cheese", 69)
    bill = core.compute_bill(base, pizza, topping, 5)
    assert bill.unit_price == 677.0
    assert bill.subtotal == 3385.0
    assert bill.discount_amount == 338.50
    assert bill.post_discount == 3046.50
    assert bill.gst_amount == 548.37
    assert bill.total == 3594.87
    print("ok  reference sample bill -> Rs.3,594.87")


def test_discount_threshold():
    b, p, t = (core.MenuItem("B1", "Thin", 149), core.MenuItem("P1", "Margh", 299),
               core.MenuItem("T4", "Peppers", 39))
    assert core.compute_bill(b, p, t, 4).discount_amount == 0.0      # below threshold
    assert core.compute_bill(b, p, t, 5).discount_rate == 0.10       # at threshold
    print("ok  discount applies only at qty >= 5")


def test_edge_cases():
    # (1) name only spaces
    assert core.validate_name("    ")[0] is False
    assert core.validate_name("A1")[0] is False          # digits not allowed
    assert core.validate_name("Jo")[0] is True
    # (2) phone 10 digits starting with 1
    assert core.validate_phone("1234567890")[0] is False
    assert core.validate_phone("9876543210")[0] is True
    # (3) quantity 0 and 11
    assert core.validate_quantity("0")[0] is False
    assert core.validate_quantity("11")[0] is False
    assert core.validate_quantity("5")[2] == 5
    # (7) non-integer quantity
    assert core.validate_quantity("three")[0] is False
    assert core.validate_quantity("2.5")[0] is False
    # (4) item selection 0 or > length  &  (5) price typed instead of item number
    assert core.validate_selection("0", 8)[0] is False
    assert core.validate_selection("9", 8)[0] is False
    assert core.validate_selection("229", 8)[0] is False   # a price = out of range
    assert core.validate_selection("abc", 8)[0] is False
    assert core.validate_selection("3", 8)[2] == 3
    # (6) empty input everywhere
    for fn in (core.validate_name, core.validate_phone):
        assert fn("")[0] is False
    assert core.validate_quantity("")[0] is False
    assert core.validate_selection("", 8)[0] is False
    assert core.validate_payment("")[0] is False
    # payment
    assert core.validate_payment("4")[0] is False
    assert core.validate_payment("3")[2] == "UPI"
    print("ok  all 8 edge cases validated")


def test_menu_loading_and_swap_safety():
    real_dir = os.path.join(os.path.dirname(__file__), "..", "menu")
    bases = core.load_menu(os.path.join(real_dir, "Types_of_Base.txt"))
    assert len(bases) == 5 and bases[0].name == "Thin Crust"

    # (8) malformed lines: missing price, extra spaces, blank, bad price -> skipped, no crash
    with tempfile.TemporaryDirectory() as d:
        path = os.path.join(d, "menu.txt")
        with open(path, "w") as f:
            f.write("X1;Good Item;199\n")
            f.write("X2;Missing Price\n")        # missing field
            f.write("  X3 ; Spaced Item ; 249 \n")  # whitespace -> still parsed
            f.write("X4;Bad Price;abc\n")        # non-numeric
            f.write("\n")                         # blank line
        items = core.load_menu(path)
        assert len(items) == 2                    # only X1 and X3 survive
        assert items[1].name == "Spaced Item" and items[1].price == 249.0

    # missing file -> clean error, not a crash
    try:
        core.load_menu("/nope/missing.txt")
        assert False, "should have raised"
    except core.MenuLoadError:
        pass
    print("ok  menu loading is defensive (swap-safe, malformed-safe)")


def test_serialize_round_trip():
    base = core.MenuItem("B3", "Cheese Burst", 229)
    pizza = core.MenuItem("P7", "BBQ Chicken", 379)
    topping = core.MenuItem("T2", "Extra Cheese", 69)
    bill = core.compute_bill(base, pizza, topping, 5)
    rec = core.serialize_order("Asha Rao", "9876543210", bill, "UPI",
                               ts="2025-06-24 13:00:00")
    parsed = dict(kv.split("=", 1) for kv in rec.split(" | "))
    assert parsed["total"] == "3594.87"
    assert parsed["payment"] == "UPI"
    assert parsed["phone"] == "9876543210"
    print("ok  order record serialises + parses cleanly")


if __name__ == "__main__":
    test_reference_sample_bill()
    test_discount_threshold()
    test_edge_cases()
    test_menu_loading_and_swap_safety()
    test_serialize_round_trip()
    print("\nALL TESTS PASSED")
