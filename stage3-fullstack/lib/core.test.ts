/**
 * core.test.ts — runnable assertions for the business logic.
 * Run with:  npm run test:core   (executes via tsx, no test framework needed)
 *
 * Asserts:
 *   - the EXACT reference bill (Rs.3594.87)
 *   - the discount boundary (qty 4 = no discount vs qty 5 = 10% discount)
 *   - a representative set of validator cases
 */

import {
  computeBill,
  serializeOrder,
  validateName,
  validatePhone,
  validateQuantity,
  validateSelection,
  validatePayment,
  type MenuItem,
} from "./core";

let passed = 0;
let failed = 0;

function check(label: string, cond: boolean): void {
  if (cond) {
    passed++;
    console.log(`  PASS  ${label}`);
  } else {
    failed++;
    console.error(`  FAIL  ${label}`);
  }
}

function eq(label: string, actual: unknown, expected: unknown): void {
  const ok = actual === expected;
  if (!ok) {
    console.error(`        expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
  check(label, ok);
}

// --------------------------------------------------------------------------- //
console.log("\n== Reference bill (Cheese Burst 229 + BBQ Chicken 379 + Extra Cheese 69, qty 5) ==");
{
  const bill = computeBill(229, 379, 69, 5);
  eq("unit price = 677", bill.unit, 677);
  eq("subtotal = 3385", bill.subtotal, 3385);
  eq("discount rate = 0.10", bill.discountRate, 0.1);
  eq("discount = 338.50", bill.discount, 338.5);
  eq("post-discount = 3046.50", bill.postDiscount, 3046.5);
  eq("gst = 548.37", bill.gst, 548.37);
  eq("TOTAL = 3594.87", bill.total, 3594.87);
}

// --------------------------------------------------------------------------- //
console.log("\n== Discount boundary (qty 4 vs qty 5) ==");
{
  const four = computeBill(229, 379, 69, 4);
  eq("qty 4 -> no discount rate", four.discountRate, 0);
  eq("qty 4 -> discount amount 0", four.discount, 0);
  eq("qty 4 -> subtotal == post-discount", four.postDiscount, four.subtotal);

  const five = computeBill(229, 379, 69, 5);
  eq("qty 5 -> discount rate 0.10", five.discountRate, 0.1);
  check("qty 5 -> discount applied (> 0)", five.discount > 0);
}

// --------------------------------------------------------------------------- //
console.log("\n== Validators ==");
{
  // name
  check("name 'Riya Sharma' ok", validateName("Riya Sharma").ok);
  check("name '   ' rejected", !validateName("   ").ok);
  check("name 'A' too short", !validateName("A").ok);
  check("name 'Riya123' rejected (digits)", !validateName("Riya123").ok);
  eq("name trims to 'Riya'", validateName("  Riya  ").value, "Riya");

  // phone
  check("phone '9876543210' ok", validatePhone("9876543210").ok);
  check("phone '1234567890' rejected (starts 1)", !validatePhone("1234567890").ok);
  check("phone '98765' wrong length", !validatePhone("98765").ok);
  check("phone 'abcdefghij' non-digit", !validatePhone("abcdefghij").ok);

  // quantity
  eq("qty '5' -> 5", validateQuantity("5").value, 5);
  check("qty '0' rejected", !validateQuantity("0").ok);
  check("qty '11' rejected", !validateQuantity("11").ok);
  check("qty 'three' rejected", !validateQuantity("three").ok);
  check("qty '2.5' rejected", !validateQuantity("2.5").ok);

  // selection (1-based against menu length)
  eq("selection '3' of 5 -> 3", validateSelection("3", 5).value, 3);
  check("selection '0' rejected", !validateSelection("0", 5).ok);
  check("selection '6' of 5 rejected", !validateSelection("6", 5).ok);
  check("selection '229' (price) out of range", !validateSelection("229", 8).ok);

  // payment
  eq("payment '1' -> Cash", validatePayment("1").value, "Cash");
  eq("payment '3' -> UPI", validatePayment("3").value, "UPI");
  check("payment '4' rejected", !validatePayment("4").ok);
}

// --------------------------------------------------------------------------- //
console.log("\n== serializeOrder round-trip ==");
{
  const base: MenuItem = { id: "B3", name: "Cheese Burst", price: 229, category: "base" };
  const pizza: MenuItem = { id: "P7", name: "BBQ Chicken", price: 379, category: "pizza" };
  const topping: MenuItem = { id: "T2", name: "Extra Cheese", price: 69, category: "topping" };
  const bill = computeBill(229, 379, 69, 5);
  bill.lineItems[0].item = base.name;
  bill.lineItems[1].item = pizza.name;
  bill.lineItems[2].item = topping.name;

  const record = serializeOrder({
    customer: "Riya Sharma",
    phone: "9876543210",
    base,
    pizza,
    topping,
    bill,
    paymentMode: "UPI",
    timestamp: "2026-06-29 12:00:00",
  });
  check("record contains total=3594.87", record.includes("total=3594.87"));
  check("record contains base=B3:Cheese Burst:229.00", record.includes("base=B3:Cheese Burst:229.00"));
  check("record contains payment=UPI", record.includes("payment=UPI"));
}

// --------------------------------------------------------------------------- //
console.log(`\n== Results: ${passed} passed, ${failed} failed ==\n`);
if (failed > 0) {
  process.exit(1);
}
