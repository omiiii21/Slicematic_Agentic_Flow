import type { Metadata } from "next";
import { Bricolage_Grotesque, Inter } from "next/font/google";
import "./globals.css";

// Deliberate type pairing: Bricolage Grotesque (characterful display) + Inter (clean body).
const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const body = Inter({ subsets: ["latin"], variable: "--font-body", display: "swap" });

export const metadata: Metadata = {
  title: "SliceMatic — pizza, priced right",
  description:
    "Order a pizza in New Ashok Nagar, Delhi — by form or by talking to our AI agent. The bulk discount and 18% GST are handled in code, to the paisa.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>
        <header className="site-header">
          <a href="/" className="brand">
            Slice<span className="brand-accent">Matic</span>
          </a>
          <nav className="site-nav">
            <a href="/order">Order</a>
            <a href="/agent">AI&nbsp;Agent</a>
            <a href="/admin">Admin</a>
          </nav>
        </header>
        <main className="site-main">{children}</main>
        <footer className="site-footer">
          <span className="footer-brand">
            Slice<span className="brand-accent">Matic</span>
          </span>
          <span>New Ashok Nagar, Delhi · prices GST-exclusive · FDE Batch 2487</span>
        </footer>
      </body>
    </html>
  );
}
