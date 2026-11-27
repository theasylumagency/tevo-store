import { Suspense } from "react";
import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/Header";
import { CompareView } from "@/components/choices/CompareView";
import { getChoiceProducts } from "@/lib/choices/catalog";
import { parseComparisonQuery } from "@/lib/choices/comparison";
import ui from "@/components/storefront/foundation.module.css";

export const metadata: Metadata = { title: "პროდუქტების შედარება", robots: { index: false, follow: true } };

async function ComparisonContent({ searchParams }: PageProps<"/compare">) {
  const params = await searchParams;
  const query = parseComparisonQuery(params.ids);
  const initial = query.shared ? await getChoiceProducts(query.ids) : undefined;
  return <CompareView key={query.shared ? "shared" : "local"}
    sharedIds={query.shared ? query.ids : undefined} initial={initial} trimmed={query.trimmed} />;
}

export default function ComparePage(props: PageProps<"/compare">) {
  return <>
    <Breadcrumbs items={[{ href: "/", label: "მთავარი" }, { label: "შედარება" }]} />
    <Suspense fallback={<section className={ui.state} role="status"><h1 className={ui.pageTitle}>პროდუქტების შედარება</h1><p className={ui.stateCopy}>შერჩეული პროდუქტები იტვირთება.</p></section>}>
      <ComparisonContent {...props} />
    </Suspense>
  </>;
}
