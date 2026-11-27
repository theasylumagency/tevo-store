import { requestTime } from "@/lib/homepage/cache";
import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { catalogRole } from "@/lib/auth/admin";
import { readEditor } from "@/lib/homepage/service";
import { inWindow, localTime, presetNames } from "@/lib/homepage/model";
import { HomeContent } from "@/components/homepage/HomeContent";
import { releaseHomeAction } from "@/app/actions/homepage";
import { button, field, primary } from "../../catalog/styles";

export const metadata = { title: "მთავარი გვერდის წინასწარი ნახვა" };
const path = "/admin/homepage/preview";

async function Preview({ searchParams }: PageProps<"/admin/homepage/preview">) {
  const role = await catalogRole();
  if (!role) redirect("/admin/login?next=/admin/homepage/preview");
  if (role !== "admin") redirect("/admin/catalog");
  const [row, sp] = await Promise.all([readEditor(), searchParams]);
  const mobile = sp.screen === "mobile";
  const at = typeof sp.at === "string" && Number.isFinite(localTime(sp.at)) ? sp.at : "";
  const doc = row.draft;
  const now = await requestTime();
  const locked = row.schedule && localTime(row.schedule.start) <= now && row.schedule.end && localTime(row.schedule.end) > now;
  const hasSchedule = locked || row.schedule && localTime(row.schedule.start) > now;
  const revision = <input type="hidden" name="revision" value={row.revision}/>;
  return <div className="space-y-5">
    <Link href="/admin/homepage" className="text-sm text-accent underline">რედაქტირებაზე დაბრუნება</Link>
    <header><h1 className="text-2xl font-bold">წინასწარი ნახვა</h1><p className="mt-1 text-ink-2">{presetNames[doc.preset]}</p></header>
    {typeof sp.error === "string" && <p role="alert" className="text-warn">{sp.error}</p>}
    <section className="flex flex-wrap items-end gap-4 rounded-card border border-line bg-surface p-4">
      <form action={releaseHomeAction}>{revision}<button className={primary} disabled={!!locked} name="intent" value="publish">ახლავე გამოქვეყნება</button></form>
      {locked && <p className="text-sm">ახლავე გამოსაქვეყნებლად რედაქტირების გვერდიდან დაასრულე მიმდინარე კამპანია.</p>}
      {!hasSchedule && <details><summary className="cursor-pointer text-accent">გამოქვეყნების დაგეგმვა</summary>
        <form action={releaseHomeAction} className="mt-3 flex flex-wrap items-end gap-3">{revision}
          <label className="text-sm">დაწყება · თბილისი<input className={field} type="datetime-local" required name="start"/></label>
          <label className="text-sm">დასრულება · სურვილისამებრ<input className={field} type="datetime-local" name="end"/></label>
          <button className={button} name="intent" value="schedule">დაგეგმვა</button>
          <p className="w-full text-sm text-ink-2">დასრულების მითითებისას მაღაზია ამ დროს ძირითად ვერსიას დაუბრუნდება.</p>
        </form></details>}
    </section>
    <div className="flex flex-wrap items-end gap-3"><nav aria-label="წინასწარი ხედის ზომა" className="flex gap-2">
      {(["desktop", "mobile"] as const).map(screen => <Link key={screen} prefetch={false}
        aria-current={(screen === "mobile") === mobile ? "page" : undefined} className={button + ((screen === "mobile") === mobile ? " bg-accent-soft" : "")}
        href={path + "?" + new URLSearchParams({ screen, at })}>{screen === "mobile" ? "მობილური" : "დესკტოპი"}</Link>)}
    </nav><form className="flex flex-wrap items-end gap-2"><input type="hidden" name="screen" value={mobile ? "mobile" : "desktop"}/>
      <label className="text-sm">შეთავაზების შემოწმების დრო · თბილისი<input className={field} type="datetime-local" name="at" defaultValue={at}/></label>
      <button className={button}>ჩვენება</button></form></div>
    <div className="overflow-x-auto rounded-card border border-line bg-line/50 p-2">
      <div data-storefront-theme="" data-testid="homepage-preview" className="mx-auto bg-bg p-4 text-ink" style={{ width: mobile ? 390 : 1180 }}>
        <div><HomeContent doc={doc} offerOpen={inWindow(doc.offer.start, doc.offer.end, at ? localTime(at) : now)}/></div>
      </div>
    </div>
  </div>;
}
export default function Page(props: PageProps<"/admin/homepage/preview">) {
  return <Suspense><Preview {...props}/></Suspense>;
}
