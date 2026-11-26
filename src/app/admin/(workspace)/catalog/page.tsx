import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { getStore } from "@/config/store";
import { requireCatalogRole } from "@/lib/auth/admin";
import { adminCatalog } from "@/lib/catalog/editorial";
import { importAction } from "@/app/actions/catalog";
import { button, field } from "./styles";
import { priceText } from "./format";

export const metadata = { title: "კატალოგის მართვა", robots: { index: false, follow: false } };

async function CatalogList({ searchParams }: PageProps<"/admin/catalog">) {
  await connection();
  const role = await requireCatalogRole();
  const [{ row, edits }, sp] = await Promise.all([adminCatalog(), searchParams]);
  const q = typeof sp.q === "string" ? sp.q.trim().toLocaleLowerCase().slice(0, 100) : "";
  const status = typeof sp.status === "string" ? sp.status : "";
  const rows = row.published.products.filter(p => {
    const draft = edits.get(p.id)?.draft;
    if ((status === "draft" && !draft) || (status === "visible" && !p.visible) || (status === "hidden" && p.visible)) return false;
    return !q || [p.name, p.id, p.model, ...Object.values(p.codes), draft?.name].some(v => v?.toLowerCase().includes(q));
  });
  const pages = Math.max(1, Math.ceil(rows.length / 30));
  const page = Math.min(pages, Math.max(1, Math.floor(Number(sp.page)) || 1));
  const pageLink = (n: number) => "/admin/catalog?" + new URLSearchParams({ q, status, page: String(n) });
  return <div className="mx-auto max-w-5xl space-y-5">
    <header><p className="text-sm text-ink-2">{getStore().name}</p><h1 className="text-2xl font-bold">პროდუქტების მართვა</h1></header>
    {typeof sp.error === "string" && <p role="alert" className="text-warn">{sp.error}</p>}
    {sp.imported && <p role="status" className="text-accent">კატალოგი წყაროსთან სინქრონიზებულია.</p>}
    {role === "admin" && <details className="rounded-card border border-line bg-surface p-4">
      <summary className="cursor-pointer font-medium">კატალოგის წყარო</summary>
      <form action={importAction} className="mt-3 space-y-2">
        <p className="text-sm text-ink-2">იმპორტის შემდეგ მაღაზიის საკუთარი ტექსტები, დანამატები და მონახაზები შენარჩუნდება.</p>
        <button className={button}>იმპორტის გაშვება</button>
      </form>
    </details>}
    <form className="flex flex-wrap items-end gap-2">
      <label className="min-w-48 flex-1 text-sm">ძიება<input name="q" defaultValue={q} placeholder="სახელი, SKU ან მოდელი" className={field}/></label>
      <label className="text-sm">მდგომარეობა<select name="status" defaultValue={status} className={field}>
        <option value="">ყველა</option><option value="draft">მონახაზით</option><option value="visible">საიტზე ჩანს</option>
        <option value="hidden">დამალულია</option></select></label><button className={button}>ძებნა</button>
    </form>
    <div className="rounded-card border border-line bg-surface">
      <p className="border-b border-line px-4 py-2 text-sm text-ink-2">ნაპოვნია {rows.length} პროდუქტი</p>
      <ul className="divide-y divide-line">{rows.slice((page-1)*30, page*30).map(p => <li key={p.id}>
        <Link prefetch={false} href={"/admin/catalog/" + p.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-bg">
          <span><span className="block font-medium">{p.name}</span><span className="text-sm text-ink-2">{p.id} · {p.model}</span></span>
          <span className="text-sm">{priceText(p.price.promo ?? p.price.base)} · {edits.get(p.id)?.draft ? "მონახაზი" : p.visible ? "გამოქვეყნებულია" : "დამალულია"}</span>
        </Link></li>)}</ul>
    </div>
    {pages > 1 && <nav aria-label="კატალოგის გვერდები" className="flex items-center gap-4 text-sm">
      {page > 1 && <Link href={pageLink(page-1)} className={button}>წინა</Link>} {page} / {pages}
      {page < pages && <Link href={pageLink(page+1)} className={button}>შემდეგი</Link>}</nav>}
  </div>;
}
export default function Page(props: PageProps<"/admin/catalog">) {
  return <Suspense fallback={null}><CatalogList {...props} /></Suspense>;
}
