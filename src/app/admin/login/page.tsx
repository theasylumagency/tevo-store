import { Suspense } from "react";
import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "შესვლა", robots: { index: false, follow: false } };

async function WithNext({ searchParams }: PageProps<"/admin/login">) {
  const sp = await searchParams;
  const next = Array.isArray(sp.next) ? sp.next[0] : sp.next;
  return <LoginForm next={next && next.startsWith("/admin") ? next : "/admin"} />;
}

export default function LoginPage(props: PageProps<"/admin/login">) {
  return <main id="admin-content" tabIndex={-1}><Suspense fallback={null}><WithNext {...props} /></Suspense></main>;
}
