import AdminApp from "@/components/admin/AdminApp";

export const dynamic = "force-dynamic";

export const metadata = { title: "ניהול · משק רוזנברג", robots: { index: false, follow: false } };

export default function AdminPage() {
  return <AdminApp />;
}
