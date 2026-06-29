"use client";

/**
 * BillTable — renders an itemised bill from a core.ts `Bill`.
 *
 * Mirrors the Stage 2 receipt: three component line items (Base/Pizza/Topping),
 * subtotal, a discount line ONLY when a bulk discount applied (qty >= 5), GST,
 * and the grand total. All figures come straight from the pricing engine — this
 * component does no maths of its own.
 */

import type { Bill } from "@/lib/core";
import { BULK_DISCOUNT_RATE } from "@/lib/core";
import styles from "./order.module.css";

/** Format a number as Indian Rupees with grouping and 2 decimals. */
export function inr(n: number): string {
  return `Rs.${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function BillTable({ bill }: { bill: Bill }) {
  const qty = bill.lineItems[0]?.qty ?? 1;
  const hasDiscount = bill.discount > 0;
  const discountPct = Math.round((bill.discountRate || BULK_DISCOUNT_RATE) * 100);

  return (
    <table className={styles.bill}>
      <thead>
        <tr>
          <th>Component</th>
          <th>Item</th>
          <th className={styles.num}>Unit</th>
          <th className={styles.num}>Qty</th>
          <th className={styles.num}>Amount</th>
        </tr>
      </thead>
      <tbody>
        {bill.lineItems.map((li) => (
          <tr key={li.component}>
            <td>{li.component}</td>
            <td>{li.item}</td>
            <td className={styles.num}>{inr(li.unit)}</td>
            <td className={styles.num}>{li.qty}</td>
            <td className={styles.num}>{inr(li.amount)}</td>
          </tr>
        ))}

        <tr className={styles.billSection}>
          <td colSpan={4}>
            Subtotal{" "}
            <span className="text-muted">
              ({inr(bill.unit)} &times; {qty})
            </span>
          </td>
          <td className={styles.num}>{inr(bill.subtotal)}</td>
        </tr>

        {hasDiscount && (
          <tr className={`${styles.billSection} ${styles.discountRow}`}>
            <td colSpan={4}>Bulk discount ({discountPct}% &mdash; qty {qty} &ge; 5)</td>
            <td className={styles.num}>&minus;{inr(bill.discount)}</td>
          </tr>
        )}

        {hasDiscount && (
          <tr className={styles.billSection}>
            <td colSpan={4}>Taxable amount</td>
            <td className={styles.num}>{inr(bill.postDiscount)}</td>
          </tr>
        )}

        <tr className={styles.billSection}>
          <td colSpan={4}>GST @ 18%</td>
          <td className={styles.num}>{inr(bill.gst)}</td>
        </tr>

        <tr className={styles.totalRow}>
          <td colSpan={4}>Total payable</td>
          <td className={styles.num}>{inr(bill.total)}</td>
        </tr>
      </tbody>
    </table>
  );
}
