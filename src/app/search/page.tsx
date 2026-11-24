import { Suspense } from "react";
import type { Metadata } from "next";
import { getIndex } from "@/lib/catalog";
import { Listing, ListingSkeleton } from "@/components/Listing";
import { t } from "@/i18n";

export const metadata: Metadata = { title: t("search.title") };

async function SearchHeading({ searchParams }: { searchParams: PageProps<"/search">["searchParams"] }) {
  const sp = await searchParams;
  const q = (Array.isArray(sp.q) ? sp.q[0] : sp.q)?.trim();
  return <h1 className="mb-6 text-2xl font-bold">{q ? `„${q}“` : t("search.prompt")}</h1>;
}

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const { visible } = await getIndex();
  return (
    <>
      <Suspense fallback={<h1 className="mb-6 text-2xl font-bold">{t("search.title")}</h1>}>
        <SearchHeading searchParams={searchParams} />
      </Suspense>
      <Suspense fallback={<ListingSkeleton />}>
        <Listing base={visible} types={[]} pathname="/search" searchParams={searchParams} />
      </Suspense>
    </>
  );
}
