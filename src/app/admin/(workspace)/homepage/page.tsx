import { requestTime, getTopSellers } from "@/lib/homepage/cache";
import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { catalogRole } from "@/lib/auth/admin";
import { getIndex } from "@/lib/catalog";
import { getAvailableMedia } from "@/lib/media";
import { readEditor } from "@/lib/homepage/service";
import { presetNames } from "@/lib/homepage/model";
import { resolveHomePublication } from "@/lib/homepage/runtime";
import { HomeEditor } from "./HomeEditor";
import { button } from "../catalog/styles";
import { dateText } from "../catalog/format";

export const metadata = { title: "მთავარი გვერდი" };
const messages: Record<string, string> = {
  publish: "ძირითადი ვერსია გამოქვეყნდა.", schedule: "გამოქვეყნება დაგეგმილია.", cancel: "განრიგი გაუქმდა.",
  restore: "არჩეული ვერსია აღდგა მონახაზში. გამოქვეყნებამდე გადაამოწმე წინასწარი ხედი.",
};

async function Editor({ searchParams }: PageProps<"/admin/homepage">) {
  const role = await catalogRole();
  if (!role) redirect("/admin/login?next=/admin/homepage");
  if (role !== "admin") redirect("/admin/catalog");
  const [row, { visible, catalog }, media, sales, sp] = await Promise.all([readEditor(), getIndex(), getAvailableMedia(), getTopSellers(), searchParams]);
  const now = await requestTime();
  const live = resolveHomePublication(row, catalog, now);
  const mediaNames = new Map<string, string>();
  for (const product of visible) for (const image of product.media) mediaNames.set(image.file, product.name + " · " + image.position);
  const photos = media.filter(file => /\.(avif|webp|jpe?g|png)$/i.test(file)).map(value => ({
    value, label: mediaNames.get(value) ?? (value.startsWith("homepage/") ? "ატვირთული ფოტო · " : "") + value.replace(/^(originals|homepage)\//, ""),
  })).sort((a, b) => a.label.localeCompare(b.label, "ka"));
  const feature = typeof sp.feature === "string" && /^at-\d+$/.test(sp.feature) ? sp.feature : undefined;
  return <div className="mx-auto max-w-6xl space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold">მთავარი გვერდი</h1>
      <p className="mt-1 text-sm text-ink-2">ახლა ჩანს · {presetNames[live.document.preset]}{live.source === "campaign" ? " · კამპანია" : " · ძირითადი ვერსია"}</p>
      {row.publishedAt && <p className="mt-1 text-xs text-ink-2">ძირითადი ვერსია გამოქვეყნდა {dateText(row.publishedAt)} · თბილისი</p>}</div>
      <nav aria-label="მთავარი გვერდის მართვა" className="flex flex-wrap gap-2">
        <Link prefetch={false} className={button} href={"/admin/homepage/preview?revision=" + row.revision}>შენახული ვერსიის ნახვა</Link>
        <Link prefetch={false} className={button} href="/admin/homepage/history">ცვლილებების ისტორია</Link>
      </nav></header>
    {typeof sp.error === "string" && <p role="alert" className="rounded-card border border-warn/40 bg-warn-soft p-3 text-sm text-warn">{sp.error}</p>}
    {(sp.saved || typeof sp.done === "string" && Object.hasOwn(messages, sp.done)) && <p role="status" className="rounded-card bg-accent-soft p-3 text-sm text-accent">
      {sp.saved ? "მონახაზი შენახულია." : messages[String(sp.done)]}</p>}
    {live.blocked && <section role="status" className="space-y-2 rounded-card border border-warn/40 bg-warn-soft p-4 text-sm text-warn">
      <h2 className="font-semibold">კამპანიის ნაცვლად ძირითადი გვერდი ჩანს</h2>
      <p>დაგეგმილი შეთავაზების პირობები აღარ სრულდება. გაასწორე მონახაზი და ხელახლა დაგეგმე კამპანია.</p>
      <ul className="list-disc pl-5">{live.errors.map(issue => <li key={issue.code + issue.message}>{issue.message}</li>)}</ul>
    </section>}
    <HomeEditor key={String(sp.done ?? "edit") + ":" + String(sp.revision ?? "initial")} draft={row.draft} published={row.published} revision={row.revision}
      updatedAt={row.updatedAt?.toISOString() ?? null} photos={photos} catalog={catalog} sales={sales}
      schedule={row.schedule} now={now} suggestedProductId={feature}/>
  </div>;
}
export default function Page(props: PageProps<"/admin/homepage">) { return <Suspense><Editor {...props}/></Suspense>; }
