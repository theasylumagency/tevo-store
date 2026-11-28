import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { connection } from "next/server";
import { getStore } from "@/config/store";
import { readPublication } from "@/lib/catalog/published";
import { newRequestToken } from "@/lib/requests/service";
import type { RequestDelivery } from "@/lib/requests/model";
import { RequestForm } from "@/components/requests/RequestForm";
import ui from "@/components/storefront/foundation.module.css";

export const metadata: Metadata = { title: "სრული პირობების დაზუსტება", robots: { index: false, follow: false }, referrer: "no-referrer" };

async function RequestContent({ searchParams }: PageProps<"/request">) {
  await connection();
  const sp = await searchParams;
  const store = getStore();
  const catalog = sp.product !== undefined ? await readPublication() : null;
  const product = catalog?.products.find(p => p.visible && p.id === sp.product);
  if (sp.product !== undefined && !product) return <section className={ui.state}>
    <h2 className={ui.stateTitle}>პროდუქტი ვერ მოიძებნა</h2>
    <p className={ui.stateCopy}>მოთხოვნისთვის ხელახლა შეარჩიეთ პროდუქტი.</p>
    <Link href="/search" className={ui.primaryAction}>კატალოგი</Link>
  </section>;
  const initialDelivery: RequestDelivery = sp.delivery === "delivery" && store.deliveryMethods.includes("delivery") ? "delivery"
    : sp.delivery === "pickup" && store.deliveryMethods.includes("pickup") ? "pickup" : "undecided";
  return <RequestForm key={product?.id ?? "cart"} product={product ? { productId: product.id, name: product.name, slug: product.slug } : null}
    token={newRequestToken()} methods={store.deliveryMethods} maxQuantity={store.maxQuantityPerLine} initialDelivery={initialDelivery} />;
}

export default function RequestPage(props: PageProps<"/request">) {
  return <div className="space-y-6">
    <header className="space-y-2"><h1 className={ui.pageTitle}>სრული პირობების დაზუსტება</h1>
      <p className={ui.lead}>გაარკვიეთ ფასი, ხელმისაწვდომობა ან მიწოდების პირობები შეძენის ვალდებულების გარეშე.</p></header>
    <Suspense fallback={<p role="status">იტვირთება…</p>}><RequestContent {...props} /></Suspense>
  </div>;
}
