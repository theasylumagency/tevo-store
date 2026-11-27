import { requestTime } from "@/lib/homepage/cache";
import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { catalogRole } from "@/lib/auth/admin";
import { getIndex } from "@/lib/catalog";
import { getAvailableMedia } from "@/lib/media";
import { readEditor } from "@/lib/homepage/service";
import { effectiveHome, localTime, presetNames } from "@/lib/homepage/model";
import { releaseHomeAction } from "@/app/actions/homepage";
import { HomeEditor } from "./HomeEditor";
import { button } from "../catalog/styles";

export const metadata = { title: "მთავარი გვერდი" };
const messages: Record<string, string> = { publish: "მთავარი გვერდი გამოქვეყნდა.", schedule: "გამოქვეყნება დაგეგმილია.", cancel: "განრიგი გაუქმდა." };

async function Editor({ searchParams }: PageProps<"/admin/homepage">) {
  const role = await catalogRole();
  if (!role) redirect("/admin/login?next=/admin/homepage");
  if (role !== "admin") redirect("/admin/catalog");
  const [row, { visible, catalog }, media, sp] = await Promise.all([readEditor(), getIndex(), getAvailableMedia(), searchParams]);
  const now = await requestTime();
  const live = effectiveHome(row, now);
  const schedule = row.schedule;
  const scheduled = schedule && (localTime(schedule.start) > now || schedule.end && localTime(schedule.end) > now);
  const mediaNames = new Map<string, string>();
  for (const p of visible) for (const image of p.media) mediaNames.set(image.file, p.name + " · " + image.position);
  const photos = media.filter(file => /\.(avif|webp|jpe?g|png)$/i.test(file))
    .map(value => ({ value, label: mediaNames.get(value) ?? value.replace(/^originals\//, "") })).sort((a,b) => a.label.localeCompare(b.label, "ka"));
  const types = new Set(visible.map(p => p.product_type));
  return <div className="mx-auto max-w-6xl space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold">მთავარი გვერდი</h1>
      <p className="mt-1 text-sm text-ink-2">გამოქვეყნებული განლაგება · {presetNames[live.preset]}</p></div>
      <Link className={button} href="/admin/homepage/preview">შენახული ვერსიის ნახვა</Link></header>
    {typeof sp.error === "string" && <p role="alert" className="text-warn">{sp.error}</p>}
    {(sp.saved || typeof sp.done === "string" && Object.hasOwn(messages, sp.done)) && <p role="status" className="text-accent">{sp.saved ? "მონახაზი შენახულია." : messages[String(sp.done)]}</p>}
    {scheduled && schedule && <section className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-surface p-4">
      <div><h2 className="font-semibold">{localTime(schedule.start) > now ? "დაგეგმილი გამოქვეყნება" : "მიმდინარე კამპანია"}</h2>
        <p>{presetNames[schedule.document.preset]} · {schedule.start.replace("T", " ")}{schedule.end && " — " + schedule.end.replace("T", " ")} · თბილისი</p></div>
      <form action={releaseHomeAction}><input type="hidden" name="revision" value={row.revision}/>
        <button name="intent" value="cancel" className={button}>{localTime(schedule.start) > now ? "განრიგის გაუქმება" : "კამპანიის დასრულება"}</button></form>
    </section>}
    <HomeEditor key={row.revision} draft={row.draft} revision={row.revision} photos={photos}
      types={catalog.product_types.filter(p => types.has(p.id)).map(p => ({ value: p.id, label: p.name_plural }))}
      products={visible.map(p => ({ value: p.id, label: p.name + " · " + p.id }))}/>
  </div>;
}
export default function Page(props: PageProps<"/admin/homepage">) {
  return <Suspense><Editor {...props}/></Suspense>;
}
