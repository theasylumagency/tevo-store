"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/app/actions/admin";
import type { CatalogRole } from "@/lib/auth/admin";

const sections = [
  { href: "/admin/catalog", title: "კატალოგი" },
  { href: "/admin/voice", title: "მაღაზიის ხმა" },
  { href: "/admin/homepage", title: "მთავარი გვერდი" },
  { href: "/admin/pricing", title: "ფასები" },
  { href: "/admin", title: "შეკვეთები" },
  { href: "/admin/requests", title: "მოთხოვნები" },
  { href: "/admin/analytics", title: "ანალიტიკა" },
  { href: "/admin/settings", title: "პარამეტრები" },
];

export function AdminNav({ role }: { role: CatalogRole }) {
  const path = usePathname();
  return <nav className="admin-nav" aria-label="ადმინისტრაციის მენიუ">
    {sections.filter(s => role === "admin" || s.href === "/admin/catalog" || s.href === "/admin/voice").map(({ href, title }) => {
      const active = path === href || path.startsWith((href === "/admin" ? "/admin/orders" : href) + "/");
      return <Link key={href} href={href} aria-current={active ? "location" : undefined}>{title}</Link>;
    })}
    <form action={logoutAction}><button>გასვლა</button></form>
  </nav>;
}
