import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SliceMatic",
  description: "SliceMatic — order a pizza by form or by talking to our AI agent.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <a href="/" className="brand">
            Slice<span className="brand-accent">Matic</span>
          </a>
          <nav className="site-nav">
            <a href="/order">Order</a>
            <a href="/agent">AI Agent</a>
            <a href="/admin">Admin</a>
          </nav>
        </header>
        <main className="site-main">{children}</main>
        <footer className="site-footer">
          SliceMatic · New Ashok Nagar, Delhi · prices GST-exclusive
        </footer>
      </body>
    </html>
  );
}
