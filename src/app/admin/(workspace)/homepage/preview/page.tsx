import { requestTime, getTopSellers } from "@/lib/homepage/cache";
import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { catalogRole } from "@/lib/auth/admin";
import { getCatalog } from "@/lib/catalog";
import { getAvailableMedia } from "@/lib/media";
import { readEditor } from "@/lib/homepage/service";
import { inWindow, localTime, presetNames } from "@/lib/homepage/model";
import { assessHome, summarizeHomeChanges } from "@/lib/homepage/policy";
import { HomeContent } from "@/components/homepage/HomeContent";
import { releaseHomeAction } from "@/app/actions/homepage";
import { button, field, primary } from "../../catalog/styles";

export const metadata = { title: "მთავარი გვერდის წინასწარი ნახვა" };
const path = "/admin/homepage/preview";

async function Preview({ searchParams }: PageProps<"/admin/homepage/preview">) {
  const role = await catalogRole();
  if (!role) redirect("/admin/login?next=/admin/homepage/preview");
  if (role !== "admin") redirect("/admin/catalog");
  const [row, catalog, media, sales, sp] = await Promise.all([readEditor(), getCatalog(), getAvailableMedia(), getTopSellers(), searchParams]);
  const mobile = sp.screen === "mobile";
  const at = typeof sp.at === "string" && Number.isFinite(localTime(sp.at)) ? sp.at : "";
  const doc = row.draft;
  const now = await requestTime();
  const previewAt = at ? localTime(at) : now;
  const activeCampaign = row.schedule && row.schedule.end && inWindow(row.schedule.start, row.schedule.end, now);
  const hasSchedule = row.schedule && (localTime(row.schedule.start) > now || !row.schedule.end || localTime(row.schedule.end) > now);
  const check = assessHome(doc, catalog, { media, sales, now: previewAt });
  const currentCheck = at ? assessHome(doc, catalog, { media, sales, now }) : check;
  const changes = summarizeHomeChanges(row.published, doc);
  const revision = <input type="hidden" name="revision" value={row.revision}/>;
  return <div className="space-y-5">
    <Link href="/admin/homepage" className="text-sm text-accent underline">რედაქტირებაზე დაბრუნება</Link>
    <header><h1 className="text-2xl font-bold">წინასწარი ნახვა</h1><p className="mt-1 text-ink-2">{presetNames[doc.preset]} · მონახაზი {row.revision}</p>
      <p className="mt-1 text-sm text-ink-2">ვიზიტორებისთვის მონახაზი გამოჩნდება გამოქვეყნების შემდეგ. ფასები და ხელმისაწვდომობა შემოწმების მომენტს შეესაბამება.</p></header>
    {typeof sp.error === "string" && <p role="alert" className="rounded-card border border-warn/40 bg-warn-soft p-3 text-sm text-warn">{sp.error}</p>}
    <section className="space-y-3 rounded-card border border-line bg-surface p-4">
      <h2 className="font-semibold">გამოქვეყნების შეჯამება</h2>
      {changes.length ? <ul className="list-disc space-y-1 pl-5 text-sm">{changes.map(change => <li key={change}>{change}</li>)}</ul>
        : <p className="text-sm text-ink-2">მონახაზი ძირითად ვერსიას ემთხვევა.</p>}
      {check.errors.length > 0 && <div role="status" className="space-y-2 text-sm text-warn"><h3 className="font-semibold">გამოქვეყნებამდე შესასწორებელია</h3>
        <ul className="list-disc space-y-1 pl-5">{check.errors.map(issue => <li key={issue.code + issue.message}>{issue.message}</li>)}</ul></div>}
      {check.warnings.length > 0 && <details><summary className="cursor-pointer text-sm font-medium">შენიშვნები · {check.warnings.length}</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-2">{check.warnings.map(issue => <li key={issue.code + issue.message}>{issue.message}</li>)}</ul></details>}
      {activeCampaign && <p className="text-sm text-ink-2">ახლა გამოქვეყნება განაახლებს ძირითად ვერსიას. მიმდინარე კამპანია დასრულებამდე დარჩება და შემდეგ ეს ვერსია გამოჩნდება.</p>}
      <div className="flex flex-wrap items-end gap-4">
        <form action={releaseHomeAction}>{revision}<button className={primary} disabled={currentCheck.errors.length > 0} name="intent" value="publish">
          {activeCampaign ? "ძირითადი ვერსიის გამოქვეყნება" : "ახლავე გამოქვეყნება"}</button></form>
        {!hasSchedule && <details><summary className="cursor-pointer text-accent">გამოქვეყნების დაგეგმვა</summary>
          <form action={releaseHomeAction} className="mt-3 flex flex-wrap items-end gap-3">{revision}
            <label className="text-sm">დაწყება · თბილისი<input className={field} type="datetime-local" required name="start"/></label>
            <label className="text-sm">დასრულება · სურვილისამებრ<input className={field} type="datetime-local" name="end"/></label>
            <button className={button} name="intent" value="schedule">დაგეგმვა</button>
            <p className="w-full text-sm text-ink-2">დასრულების მითითებისას მაღაზია ძირითადი გვერდის ბოლო გამოქვეყნებულ ვერსიას დაუბრუნდება. ვადის გარეშე ეს გახდება ახალი ძირითადი ვერსია.</p>
            <p className="w-full text-xs text-ink-2">შეთავაზების პირობები დაგეგმვისას და კამპანიის მოქმედებისას მოწმდება.</p>
          </form></details>}
        {hasSchedule && <p className="text-sm text-ink-2">ახალი კამპანიის დასაგეგმად ჯერ გააუქმე არსებული განრიგი რედაქტირების გვერდიდან.</p>}
      </div>
    </section>
    <div className="flex flex-wrap items-end gap-3"><nav aria-label="წინასწარი ხედის ზომა" className="flex gap-2">
      {(["desktop", "mobile"] as const).map(screen => <Link key={screen} prefetch={false}
        aria-current={(screen === "mobile") === mobile ? "page" : undefined} className={button + ((screen === "mobile") === mobile ? " bg-accent-soft" : "")}
        href={path + "?" + new URLSearchParams({ screen, at, revision: String(row.revision) })}>{screen === "mobile" ? "მობილური" : "დესკტოპი"}</Link>)}
    </nav><form className="flex flex-wrap items-end gap-2"><input type="hidden" name="screen" value={mobile ? "mobile" : "desktop"}/>
      <label className="text-sm">შეთავაზების შემოწმების დრო · თბილისი<input className={field} type="datetime-local" name="at" defaultValue={at}/></label>
      <button className={button}>ჩვენება</button>{at && <Link className={button} href={path + "?screen=" + (mobile ? "mobile" : "desktop")}>მიმდინარე დრო</Link>}
    </form></div>
    <div className="overflow-x-auto rounded-card border border-line bg-line/50 p-2">
      <div data-storefront-theme="" data-testid="homepage-preview" className="mx-auto bg-bg p-4 text-ink" style={{ width: mobile ? 390 : 1180 }}>
        <HomeContent doc={doc} offerOpen={inWindow(doc.offer.start, doc.offer.end, previewAt)} previewScreen={mobile ? "mobile" : "desktop"}/>
      </div>
    </div>
  </div>;
}
export default function Page(props: PageProps<"/admin/homepage/preview">) { return <Suspense><Preview {...props}/></Suspense>; }
