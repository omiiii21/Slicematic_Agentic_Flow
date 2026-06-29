/**
 * /admin — Admin dashboard route.
 *
 * `force-dynamic` guarantees this route is never prerendered at build time, so
 * `next build` never touches Supabase env vars (per project conventions). All
 * data fetching + auth happens client-side inside <AdminDashboard/>.
 */
export const dynamic = "force-dynamic";

import AdminDashboard from "./AdminDashboard";

export const metadata = {
  title: "Admin · SliceMatic",
  description: "SliceMatic admin dashboard — orders, revenue and insights.",
};

export default function AdminPage() {
  return <AdminDashboard />;
}
