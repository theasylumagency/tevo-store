import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { catalogRole } from "@/lib/auth/admin";
import { readEditor, readHomeHistory } from "@/lib/homepage/service";
import { presetNames } from "@/lib/homepage/model";
import { restoreHomeAction } from "@/app/actions/homepage";
import { dateText } from "../../catalog/format";
import { button } from "../../catalog/styles";

export const metadata = { title: "მთავარი გვერდის ისტორია" };
const kinds: Record<string, string> = {
  baseline: "საწყისი ვერსია", publish: "გამოქვეყნდა", schedule: "დაიგეგმა", cancel: "განრიგი გაუქმდა", restore: "მონახაზში აღდგა",
  before_restore: "აღდგენამდე არსებული მონახაზი", activate: "დაგეგმილი ვერსია ამოქმედდა",
};

async function History({ searchParams }: PageProps<"/admin/homepage/history">) {
  const role = await catalogRole();
  if (!role) redirect("/admin/login?next=/admin/homepage/history");
  if (role !== "admin") redirect("/admin/catalog");
  const [history, row, sp] = await Promise.all([readHomeHistory(50), readEditor(), searchParams]);
  return <div className="mx-auto max-w-5xl space-y-5">
    <Link href="/admin/homepage" className="text-sm text-accent underline">მთავარი გვერდის მართვაზე დაბრუნება</Link>
    <header><h1 className="text-2xl font-bold">მთავარი გვერდის ისტორია</h1>
      <p className="mt-2 text-sm text-ink-2">აღდგენა ცვლის მონახაზს. საჯარო გვერდის შესაცვლელად შემდეგ შეამოწმე წინასწარი ხედი და გამოაქვეყნე.</p>
      <p className="mt-1 text-sm text-ink-2">პროდუქტების ფასები და ხელმისაწვდომობა ყოველთვის მოქმედი კატალოგიდან გამოჩნდება.</p></header>
    {typeof sp.error === "string" && <p role="alert" className="rounded-card border border-warn/40 bg-warn-soft p-3 text-sm text-warn">{sp.error}</p>}
    {history.length ? <ol className="space-y-3">{history.map(version => <li key={version.id} className="rounded-card border border-line bg-surface p-4" data-testid="home-history-entry">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold">{kinds[version.kind] ?? "ცვლილება"} · ვერსია {version.revision}</h2>
        <p className="mt-1 text-sm text-ink-2">{dateText(version.createdAt)} · თბილისი · {version.actor === "system" ? "სისტემა" : "ადმინისტრატორი"}</p>
        <p className="mt-1 text-sm">{presetNames[version.document.preset]}</p></div>
        <form action={restoreHomeAction}><input type="hidden" name="revision" value={row.revision}/><input type="hidden" name="id" value={version.id}/>
          <button className={button}>მონახაზში აღდგენა</button></form></div>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-ink-2">{version.summary.map((summary, index) => <li key={index}>{summary}</li>)}</ul>
    </li>)}</ol> : <p className="rounded-card border border-line bg-surface p-4 text-sm text-ink-2">გამოქვეყნების ისტორია ჯერ ცარიელია. პირველი ცვლილებისას საწყისი ვერსიაც შეინახება.</p>}
    {history.length === 50 && <p className="text-xs text-ink-2">ნაჩვენებია ბოლო 50 ჩანაწერი.</p>}
  </div>;
}
export default function Page(props: PageProps<"/admin/homepage/history">) { return <Suspense><History {...props}/></Suspense>; }
