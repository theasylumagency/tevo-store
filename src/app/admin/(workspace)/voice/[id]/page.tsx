import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireCatalogRole } from "@/lib/auth/admin";
import { readRun } from "@/lib/voice/service";
import { scopes, statuses } from "@/lib/voice/model";
import { publishVoiceAction, retryVoiceAction } from "@/app/actions/voice";
import { dateText } from "../../catalog/format";
import { button, primary } from "../../catalog/styles";
import { Comparison } from "./Comparison";
import { ReviewForm } from "./ReviewForm";
import { Refresh } from "./Refresh";

export const metadata = { title: "აღწერების განხილვა" };
async function Group({ params, searchParams }: PageProps<"/admin/voice/[id]">) {
  const role = await requireCatalogRole();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const [data, sp] = await Promise.all([readRun(id), searchParams]);
  if (!data) notFound();
  const { items, run, previous } = data;
  const path = "/admin/voice/" + id;
  const admin = role === "admin";
  const filter = typeof sp.filter === "string" && Object.hasOwn(statuses, sp.filter) ? sp.filter : "";
  const filtered = items.filter(i => !filter || i.status === filter);
  const pages = Math.max(1, Math.ceil(filtered.length / 10));
  const page = Math.min(pages, Math.max(1, Math.floor(Number(sp.page)) || 1));
  const approved = items.filter(i => i.status === "approved");
  const processing = items.filter(i => i.status === "queued" || i.status === "working").length;
  return <div className="mx-auto max-w-6xl space-y-4">
    <Link href="/admin/voice" className="text-sm text-accent underline">მაღაზიის ხმაზე დაბრუნება</Link>
    <header><h1 className="text-2xl font-bold">აღწერების განხილვა</h1><p className="mt-1 text-sm text-ink-2">{scopes[run.scope]} · {items.length} პროდუქტი · {dateText(run.createdAt)}</p></header>
    {typeof sp.error === "string" && <p role="alert" className="text-warn">{sp.error}</p>}
    {sp.published !== undefined && <p role="status">გამოქვეყნდა {sp.published}. ხელახალი განხილვა სჭირდება {sp.stale} აღწერას.</p>}
    <details className="rounded-card border border-line bg-surface p-3"><summary>გამოყენებული ხმის პროფილი და წყარო</summary>
      <div className="mt-2 space-y-1 text-sm"><p>{run.profile.tone}</p><p>{run.profile.avoid}</p><p>{run.profile.example}</p>
        <p className="break-all text-ink-2">{run.model} · პროფილი {run.profileVersion + 1} · წყარო {run.sourceVersion}</p></div></details>
    {processing > 0 && <div className="flex flex-wrap items-center gap-3"><p role="status">რიგში ან დამუშავებაშია {processing} აღწერა.</p><Refresh automatic={processing === items.length}/></div>}
    {admin && approved.length > 0 && <details className="rounded-card border border-line bg-surface p-4"><summary className="font-semibold">დამტკიცებული აღწერების გამოქვეყნება · {approved.length}</summary>
      <form action={publishVoiceAction} className="mt-3 space-y-2"><input type="hidden" name="run" value={id}/>
        <ul className="max-h-56 overflow-auto">{approved.map(i => <li key={i.id}><label className="flex gap-2 p-1 text-sm">
          <input type="checkbox" name="version" defaultChecked value={i.id + ":" + i.revision}/>{i.name}</label></li>)}</ul>
        <button className={primary}>მონიშნული აღწერების გამოქვეყნება</button></form></details>}
    <nav aria-label="განხილვის მდგომარეობა" className="flex flex-wrap gap-2 text-sm"><Link className={button} href={path}>ყველა · {items.length}</Link>
      {Object.entries(statuses).map(([key, label]) => { const n = items.filter(i => i.status === key).length; return n > 0 &&
        <Link key={key} aria-current={filter === key ? "page" : undefined} className={button} href={path + "?filter=" + key}>{label} · {n}</Link>; })}</nav>
    {filtered.slice((page - 1) * 10, page * 10).map(i => {
      const editable = i.status === "review" || i.status === "approved" || i.status === "rejected";
      const prior = previous.get(i.productId);
      const hidden = <><input type="hidden" name="run" value={id}/><input type="hidden" name="item" value={i.id}/>
        <input type="hidden" name="revision" value={i.revision}/><input type="hidden" name="page" value={page}/></>;
      return <article key={i.id + "/" + i.revision} id={"item-" + i.id} className="space-y-4 rounded-card border border-line bg-surface p-4">
        <header><h2 className="font-semibold">{i.name}</h2><p className="text-sm text-ink-2"><Link className="underline" href={"/admin/catalog/" + i.productId}>{i.productId}</Link> · {statuses[i.status]}</p></header>
        {i.error && <p role="alert" className="text-warn">{i.error}</p>}
        {i.status === "failed" && admin && <form action={retryVoiceAction}>{hidden}<button className={button} name="intent" value="retry">გენერაციის ხელახლა გაშვება</button></form>}
        {i.proposal !== null && <>
          <Comparison before={i.original} after={i.proposal}/>
          {prior && i.paragraphs && <details className="rounded-card border border-line bg-subtle p-3">
            <summary className="cursor-pointer text-sm font-semibold text-accent">შეადარე წინა AI ვარიანტს</summary>
            <p className="mb-3 mt-2 text-xs text-ink-2">ორივე ტექსტი AI-ის თავდაპირველი შედეგია; ხელით შესწორებები ამ შედარებას არ ცვლის.</p>
            <Comparison before={prior.text} after={i.paragraphs.map(p => p.text).join("\n\n")}
              beforeLabel="წინა AI ვარიანტი" afterLabel="ამ ჯგუფის AI ვარიანტი"/>
            <Link prefetch={false} className="mt-3 inline-block text-sm text-accent underline"
              href={"/admin/voice/" + prior.runId}>წინა სამუშაო ჯგუფის გახსნა</Link>
          </details>}
          <details><summary className="text-sm text-accent">საწყისი ფაქტები და AI-ის აბზაცები</summary>
            <ol className="my-2 list-decimal pl-6 text-sm">{i.facts.map((f, n) => <li key={n}>{f.label} · {f.value}</li>)}</ol>
            {i.paragraphs?.map((p, n) => <p key={n} className="mt-2 text-sm">{p.text} <span className="text-ink-2">(წყარო {p.sources.join(", ")})</span></p>)}</details>
          {i.flags.length > 0 && <ul className="rounded-card bg-warn-soft p-3 text-sm text-warn">{i.flags.map(s => <li key={s}>{s}</li>)}</ul>}
          {editable && <ReviewForm id={i.id} run={id} revision={i.revision} page={page} initial={i.proposal} flagged={i.flags.length > 0} admin={admin}/>}
          {i.reviewedAt && <p className="text-xs text-ink-2">განიხილა {i.reviewedBy} · {dateText(i.reviewedAt)}{i.publishedAt && " · გამოქვეყნდა " + dateText(i.publishedAt)}</p>}
        </>}
      </article>;
    })}
    {pages > 1 && <nav className="flex items-center gap-3">{page > 1 && <Link className={button} href={path + "?filter=" + filter + "&page=" + (page-1)}>წინა</Link>}{page} / {pages}
      {page < pages && <Link className={button} href={path + "?filter=" + filter + "&page=" + (page+1)}>შემდეგი</Link>}</nav>}
  </div>;
}
export default function Page(props: PageProps<"/admin/voice/[id]">) { return <Suspense><Group {...props}/></Suspense>; }
