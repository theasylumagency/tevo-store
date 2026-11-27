import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/Header";
import { SavedView } from "@/components/choices/SavedView";

export const metadata: Metadata = { title: "შენახული პროდუქტები", robots: { index: false, follow: true } };

export default function SavedPage() {
  return <>
    <Breadcrumbs items={[{ href: "/", label: "მთავარი" }, { label: "შენახული" }]} />
    <SavedView />
  </>;
}
