import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCatalogRole } from "@/lib/auth/admin";
import { editorProduct } from "@/lib/catalog/editorial";
import type { Product } from "@/lib/catalog/types";
import { getStore } from "@/config/store";
import { restoreAction } from "@/app/actions/catalog";
import { EditForm } from "../controls";
import { dateText, priceText, ruleText } from "../format";
import { button } from "../styles";

export const metadata = { title: "პროდუქტის რედაქტირება", robots: { index: false, follow: false } };
const copy = ({ name, subtitle, description, features }: Product) => ({ name, subtitle, description, features });

async function Editor({ params, searchParams }: PageProps<"/admin/catalog/[id]">) {
  await requireCatalogRole();
  const { id } = await params;
  const data = await editorProduct(id);
  if (!data) notFound();
  const { edit, source, published, history, token, globalRule, applied } = data;
  const sp = await searchParams;
  return <div className="mx-auto max-w-5xl space-y-4">
    <Link href="/admin/catalog" className="text-sm text-accent underline">კატალოგში დაბრუნება</Link>
    <header><p className="text-sm text-ink-2">{getStore().name} · {source.id} · {source.model}</p>
      <h1 className="text-2xl font-bold">{published.name}</h1></header>
    {typeof sp.error === "string" && <p className="text-warn" role="alert">{sp.error}</p>}
    {(sp.saved || sp.published) && <p className="text-accent" role="status">{sp.saved ? "მონახაზი შენახულია." : "ცვლილებები გამოქვეყნდა."}</p>}
    <div className="grid items-start gap-5 lg:grid-cols-[2fr_1fr]">
      <EditForm key={token} id={id} token={token} source={copy(source)} published={copy(published)} edits={edit?.draft ?? edit?.live ?? {}} />
      <aside className="space-y-3 rounded-card border border-line bg-surface p-4 text-sm">
        <h2 className="text-base font-semibold">მაღაზიის მდგომარეობა</h2>
        <dl className="space-y-2">
          <div><dt className="text-ink-2">წყაროს ფასი</dt><dd>{priceText(source.price.promo ?? source.price.base)}</dd></div>
          <div><dt className="text-ink-2">გამოქვეყნებული ფასი</dt><dd>{priceText(published.price.promo ?? published.price.base)}</dd></div>
          <div><dt className="text-ink-2">გამოყენებული წესი</dt><dd>{{product:"პროდუქტის დანამატი",store:"მაღაზიის დანამატი",source:"წყაროს ფასი"}[applied.origin]} · {ruleText(applied.rule)}</dd></div>
          <div><dt className="text-ink-2">მაღაზიის საერთო წესი</dt><dd>{ruleText(globalRule)}</dd></div>
        </dl>
        {published.visible ? <Link className="block text-accent underline" href={"/p/" + published.slug}>საჯარო გვერდის ნახვა</Link> : <p>საიტზე დამალულია</p>}
        {edit?.draft && <Link className="block text-accent underline" href={"/admin/catalog/" + id + "/preview"}>შენახული მონახაზის ნახვა</Link>}
      </aside>
    </div>
    {history.length > 0 && <section className="space-y-2"><h2 className="text-lg font-semibold">ვერსიების ისტორია</h2>
      <ul className="divide-y divide-line rounded-card border border-line bg-surface">{history.map(h =>
        <li key={h.id} className="p-3"><details><summary className="cursor-pointer">
          {h.actor === "source" ? "საწყისი ვერსია" : "გამოქვეყნებული ვერსია"} · {dateText(h.createdAt)} · {h.resolved?.name}</summary>
          <div className="mt-3 space-y-2 text-sm"><p>{h.resolved?.subtitle}</p><p className="whitespace-pre-line">{h.resolved?.description}</p>
            <p>{h.resolved?.features.join(" · ")}</p><p>იმ დროის ფასი · {priceText(h.resolved?.price.promo ?? h.resolved?.price.base ?? null)}</p>
            <p className="text-ink-2">აღდგება მაღაზიის ცვლილებები. მემკვიდრეობით მიღებული ველები მიმდინარე წყაროს მიჰყვება.</p>
            <form action={restoreAction}><input type="hidden" name="id" value={id}/><input type="hidden" name="token" value={token}/>
              <input type="hidden" name="version" value={h.id}/><button className={button}>მონახაზად აღდგენა</button></form></div>
        </details></li>)}</ul></section>}
  </div>;
}

export default function Page(props: PageProps<"/admin/catalog/[id]">) {
  return <Suspense fallback={null}><Editor {...props}/></Suspense>;
}
