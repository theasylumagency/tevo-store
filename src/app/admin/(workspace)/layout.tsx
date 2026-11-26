import { Suspense } from "react";
import { AdminNav } from "@/components/admin/AdminNav";
import { catalogRole } from "@/lib/auth/admin";

async function Navigation() {
  const role = await catalogRole();
  return role && <AdminNav role={role} />;
}

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return <div className="admin-body">
    <aside><Suspense><Navigation /></Suspense></aside>
    <main id="admin-content" tabIndex={-1}>{children}</main>
  </div>;
}
