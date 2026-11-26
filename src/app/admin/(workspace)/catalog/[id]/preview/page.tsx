import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCatalogRole } from "@/lib/auth/admin";
import { editorProduct } from "@/lib/catalog/editorial";
import { prepareProduct } from "@/lib/catalog/publication";
import { ProductView } from "@/components/ProductView";
import { publishAction } from "@/app/actions/catalog";
import { Price } from "../../../pricing/Price";
import { ruleText } from "../../format";
import { primary } from "../../styles";

export const metadata = { title: "მონახაზის წინასწარი ნახვა", robots: { index: false, follow: false } };

async function Preview({ params }: PageProps<"/admin/catalog/[id]/preview">) {
  const role = await requireCatalogRole();
  const { id } = await params;
  const data = await editorProduct(id);
  if (!data) notFound();
  const draft = data.edit?.draft;
  const { product, applied } = prepareProduct(data.source, draft ?? data.edit?.live ?? {}, data.globalRule);
  return <div className="space-y-6"><header className="flex flex-wrap items-center gap-4 rounded-card border border-line bg-accent-soft p-4">
    <div className="mr-auto"><h1 className="font-semibold">{draft ? "მონახაზის წინასწარი ნახვა" : "გამოქვეყნებული ვერსია"}</h1>
      <Link href={"/admin/catalog/" + id} className="text-sm underline">რედაქტირებაზე დაბრუნება</Link></div>
    {role === "admin" && draft && <form action={publishAction}><input type="hidden" name="id" value={id}/>
      <input type="hidden" name="token" value={data.token}/><button className={primary}>მონახაზის გამოქვეყნება</button></form>}
  </header>
    <section className="space-y-2 rounded-card border border-line bg-surface p-4 text-sm">
      <h2 className="font-semibold">ფასის შედარება</h2>
      <p>{{ product: "პროდუქტის წესი", store: "მაღაზიის საერთო წესი", source: "წყაროს ფასი" }[applied.origin]} · {ruleText(applied.rule)}</p>
      <dl className="flex flex-wrap gap-6">{[
        { title: "წყაროს ფასი", price: data.source.price }, { title: "გამოქვეყნებული ფასი", price: data.published.price },
        { title: "წინასწარი ფასი", price: product.price },
      ].map(({ title, price }) => <div key={title}><dt className="text-ink-2">{title}</dt><dd><Price value={price}/></dd></div>)}</dl>
    </section><ProductView product={product} preview /></div>;
}
export default function Page(props: PageProps<"/admin/catalog/[id]/preview">) {
  return <Suspense fallback={null}><Preview {...props}/></Suspense>;
}
