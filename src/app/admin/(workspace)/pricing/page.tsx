import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { catalogRole } from "@/lib/auth/admin";
import { adminPricing } from "@/lib/catalog/editorial";
import { pricingImpact } from "@/lib/catalog/pricing";
import { CatalogInputError, parseRule, type PriceRule } from "@/lib/catalog/publication";
import { globalPriceAction } from "@/app/actions/catalog";
import { RuleFields } from "../catalog/controls";
import { button, primary } from "../catalog/styles";
import { dateText, ruleText } from "../catalog/format";
import { Price, PriceDifference } from "./Price";

export const metadata = { title: "ფასები" };
const filters = { changed: "იცვლება", exception: "ინდივიდუალური წესით", promotion: "აქციაში", all: "ყველა" } as const;

async function Pricing({ searchParams }: PageProps<"/admin/pricing">) {
  const role = await catalogRole();
  if (!role) redirect("/admin/login?next=/admin/pricing");
  if (role !== "admin") redirect("/admin/catalog");
  const [{ row, prices }, sp] = await Promise.all([adminPricing(), searchParams]);
  let proposed: PriceRule | null = row.globalRule;
  let error = typeof sp.error === "string" ? sp.error : "";
  let impact: ReturnType<typeof pricingImpact> | undefined;
  try {
    if (typeof sp.kind === "string") proposed = parseRule(sp.kind, typeof sp.amount === "string" ? sp.amount : "");
    impact = pricingImpact(row, proposed);
  } catch (e) {
    if (!(e instanceof CatalogInputError)) throw e;
    error = e.message;
  }
  const preview = !!impact && typeof sp.kind === "string" && !error;
  const newRule = proposed?.kind !== row.globalRule?.kind || proposed?.amount !== row.globalRule?.amount;
  const filter = typeof sp.filter === "string" && Object.hasOwn(filters, sp.filter)
    ? sp.filter as keyof typeof filters : preview ? "changed" : "all";
  const matches = impact?.filter(p => filter === "all" || p[filter]) ?? [];
  const pages = Math.max(1, Math.ceil(matches.length / 25));
  const page = Math.min(pages, Math.max(1, Math.floor(Number(sp.page)) || 1));
  function link(f: keyof typeof filters, n = 1) {
    const query = new URLSearchParams({ filter: f, page: String(n) });
    if (preview) {
      query.set("kind", proposed?.kind ?? "inherit");
      if (proposed) query.set("amount", String(proposed.amount / 100));
    }
    return "/admin/pricing?" + query;
  }
  return <div className="mx-auto max-w-6xl space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-bold">ფასები</h1>
      <Link href="/admin/pricing/history" className="text-sm text-accent underline">ფასების ისტორია</Link>
    </header>
    {error && <p role="alert" className="rounded-card bg-warn-soft p-3 text-warn">{error}</p>}
    {sp.updated && <p role="status" className="text-accent">ფასის საერთო წესი გამოქვეყნდა.</p>}
    <section className="space-y-3 rounded-card border border-line bg-surface p-5">
      <h2 className="font-semibold">მაღაზიის საერთო დანამატი</h2>
      <p className="text-sm text-ink-2">მოქმედი წესი · {ruleText(row.globalRule)}. ინდივიდუალური წესი იცვლება პროდუქტის ბარათიდან.</p>
      <form action="/admin/pricing" className="flex flex-wrap items-end gap-3">
        <RuleFields key={String(sp.kind) + "/" + String(sp.amount)} rule={proposed} inheritLabel="წყაროს ფასი" />
        <button className={button}>შედეგის წინასწარი ნახვა</button>
      </form>
    </section>
    {impact && <section className="space-y-3">
      <h2 className="text-lg font-semibold">{preview ? "წინასწარი შედარება · " + ruleText(proposed) : "გამოქვეყნებული ფასები"}</h2>
      {preview && <div className="space-y-3 rounded-card border border-line bg-surface p-4">
        <p data-testid="price-impact">ფასი ეცვლება {impact.filter(p => p.changed).length} პროდუქტს.
          მათგან საიტზე ჩანს {impact.filter(p => p.changed && p.visible).length}.</p>
        {newRule ? <form action={globalPriceAction}>
          <input type="hidden" name="publicationVersion" value={row.published.generated_at}/>
          <input type="hidden" name="kind" value={proposed?.kind ?? "inherit"}/>
          <input type="hidden" name="amount" value={proposed ? proposed.amount / 100 : ""}/>
          <button className={primary}>წესის გამოქვეყნება · {ruleText(proposed)}</button>
        </form> : <p className="text-sm text-ink-2">ეს წესი უკვე მოქმედებს.</p>}
      </div>}
      <nav className="flex flex-wrap gap-2" aria-label="ფასების ფილტრი">
        {(Object.keys(filters) as (keyof typeof filters)[]).filter(f => preview || f !== "changed").map(f =>
          <Link key={f} prefetch={false} href={link(f)} aria-current={f === filter ? "page" : undefined}
            className={button + (f === filter ? " bg-accent-soft font-semibold" : "")}>
            {filters[f]} · {f === "all" ? impact.length : impact.filter(p => p[f]).length}
          </Link>)}
      </nav>
      {matches.length ? <div className="overflow-x-auto rounded-card border border-line bg-surface">
        <table className="w-full text-left text-sm"><thead className="border-b border-line text-ink-2"><tr>
          <th className="p-3">პროდუქტი</th><th className="p-3">წყაროს ფასი</th><th className="p-3">მოქმედი ფასი</th>
          {preview && <th className="p-3">ახალი ფასი</th>}
        </tr></thead><tbody className="divide-y divide-line">{matches.slice((page - 1) * 25, page * 25).map(p =>
          <tr key={p.id}><td className="p-3"><Link prefetch={false} href={"/admin/catalog/" + p.id} className="font-medium text-accent underline">{p.name}</Link>
            <span className="block text-xs text-ink-2">{[p.id, p.exception && "ინდივიდუალური წესი", p.promotion && "აქცია", !p.visible && "დამალულია"].filter(Boolean).join(" · ")}</span></td>
            <td className="p-3"><Price value={p.source} /></td><td className="p-3"><Price value={p.before} /></td>
            {preview && <td className="p-3 font-semibold"><Price value={p.after}/><PriceDifference before={p.before} after={p.after}/></td>}</tr>
        )}</tbody></table></div> : <p className="text-sm text-ink-2">ამ ფილტრით პროდუქტი არ მოიძებნა.</p>}
      {pages > 1 && <nav aria-label="შედარების გვერდები" className="flex items-center gap-3 text-sm">
        {page > 1 && <Link href={link(filter, page - 1)} className={button}>წინა</Link>}
        {page} / {pages}
        {page < pages && <Link href={link(filter, page + 1)} className={button}>შემდეგი</Link>}
      </nav>}
    </section>}
    {prices.length > 0 && <details><summary>საერთო წესის ბოლო ცვლილებები</summary><ul className="mt-2 text-sm">
      {prices.map(h => <li key={h.id}>{dateText(h.createdAt)} · {ruleText(h.edits.rule)}</li>)}
    </ul></details>}
  </div>;
}

export default function Page(props: PageProps<"/admin/pricing">) {
  return <Suspense><Pricing {...props}/></Suspense>;
}
