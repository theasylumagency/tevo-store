import { Suspense } from "react";
import Link from "next/link";
import { randomUUID } from "node:crypto";
import { requireCatalogRole } from "@/lib/auth/admin";
import { voiceDashboard } from "@/lib/voice/service";
import { voiceEnabled } from "@/lib/voice/provider";
import { scopes } from "@/lib/voice/model";
import { profileAction } from "@/app/actions/voice";
import { dateText } from "../catalog/format";
import { field, button } from "../catalog/styles";
import { BatchForm } from "./BatchForm";

export const metadata = { title: "მაღაზიის ხმა" };
async function Dashboard({ searchParams }: PageProps<"/admin/voice">) {
  const role = await requireCatalogRole();
  const [{ profile, products, runs }, sp] = await Promise.all([voiceDashboard(), searchParams]);
  const admin = role === "admin";
  return <div className="mx-auto max-w-5xl space-y-5">
    <header><h1 className="text-2xl font-bold">მაღაზიის ხმა</h1><p className="mt-1 text-sm text-ink-2">პროდუქტის აღწერები როდოს ტონით · ქართული</p></header>
    {typeof sp.error === "string" && <p role="alert" className="text-warn">{sp.error}</p>}
    {sp.saved && <p role="status">ხმის პროფილი შენახულია.</p>}
    {admin && !voiceEnabled() && <p className="rounded-card bg-warn-soft p-3 text-sm">გენერაცია გამორთულია. სერვერის პარამეტრებში საჭიროა RODO_OPENAI_API_KEY და RODO_AI_MODEL.</p>}
    <div className="grid items-start gap-4 md:grid-cols-2">
      <section className="space-y-3 rounded-card border border-line bg-surface p-5">
        <h2 className="text-lg font-semibold">ხმის პროფილი</h2>
        <form action={profileAction} className="space-y-3"><input type="hidden" name="revision" value={profile.revision}/>
          {([["tone", "როგორ ვწერთ"], ["avoid", "რას ვერიდებით"], ["example", "სასურველი ტექსტის მაგალითი"]] as const).map(([key, label]) =>
            <label key={key} className="block text-sm">{label}<textarea name={key} readOnly={!admin} required={key === "tone"} maxLength={1500}
              defaultValue={profile.profile[key]} rows={key === "tone" ? 3 : 2} className={field}/></label>)}
          {admin && <button className={button}>პროფილის შენახვა</button>}
        </form>
      </section>
      {admin && <BatchForm products={products} run={randomUUID()} version={profile.revision} enabled={voiceEnabled()}/>}
    </div>
    <section><h2 className="mb-2 text-lg font-semibold">სამუშაო ჯგუფები</h2>
      {runs.length ? <ul className="divide-y divide-line rounded-card border border-line bg-surface">{runs.map(run =>
        <li key={run.id}><Link prefetch={false} className="flex flex-wrap justify-between gap-2 p-3 text-accent" href={"/admin/voice/" + run.id}>
          <span>{scopes[run.scope]}</span><span className="text-sm text-ink-2">{dateText(run.createdAt)} · პროფილი {run.profileVersion + 1}</span>
        </Link></li>)}</ul> : <p className="text-sm text-ink-2">სამუშაო ჯგუფები ჯერ არ შექმნილა.</p>}
    </section>
  </div>;
}
export default function Page(props: PageProps<"/admin/voice">) { return <Suspense><Dashboard {...props}/></Suspense>; }
