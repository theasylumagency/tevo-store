import { Suspense } from "react";
import Link from "next/link";
import { randomUUID } from "node:crypto";
import { requireCatalogRole } from "@/lib/auth/admin";
import { voiceDashboard } from "@/lib/voice/service";
import { voiceEnabled } from "@/lib/voice/provider";
import { descriptionTotals } from "@/lib/voice/description-counts";
import { addressForms, defaultProfile, policyText, scopes } from "@/lib/voice/model";
import { getEmailSender } from "@/lib/messaging/email";
import { readSettingsForAdmin } from "@/lib/settings";
import { startVoiceAction } from "@/app/actions/voice";
import { dateText } from "../catalog/format";
import { primary } from "../catalog/styles";
import { Refresh } from "./[id]/Refresh";
import { BatchForm } from "./BatchForm";

export const metadata = { title: "მაღაზიის ხმა" };
async function Dashboard({ searchParams }: PageProps<"/admin/voice">) {
  const role = await requireCatalogRole();
  const [{ profile, active, products, runs, plan, suggested }, totals, sp] = await Promise.all([voiceDashboard(), descriptionTotals(), searchParams]);
  const admin = role === "admin";
  const canNotify = admin && getEmailSender()?.id === "smtp" && (await readSettingsForAdmin()).settings.staff.emails.length > 0;
  const blocked = products.filter(p => p.blocked);
  return <div className="mx-auto max-w-5xl space-y-5">
    <h1 className="text-2xl font-bold">მაღაზიის ხმა</h1>
    <details className="rounded-card border border-line bg-surface p-4"><summary className="cursor-pointer font-semibold">აღწერის საერთო წესი ყველა ხმისთვის</summary>
      <p className="mt-2 max-w-prose whitespace-pre-line text-sm">{policyText}</p></details>
    {typeof sp.error === "string" && <p role="alert" className="text-warn">{sp.error}</p>}
    {sp.approved && <p role="status">მაღაზიის ხმა დამტკიცებულია.</p>}
    {profile.activeRunId && !active && <p role="status">აღწერის საერთო წესი განახლდა. კატალოგისთვის ხმა სამ ნიმუშზე ხელახლა გამოცადე და დაამტკიცე.</p>}
    {admin && !voiceEnabled() && <p className="rounded-card bg-warn-soft p-3 text-sm">გენერაციისთვის საჭიროა RODO_OPENAI_API_KEY და RODO_AI_MODEL.</p>}
    {active && plan && <section className="space-y-3 rounded-card border border-accent bg-surface p-5">
      <h2 className="text-lg font-semibold">მოქმედი ხმა · ვერსია {active.profileVersion + 1}</h2>
      <p>{active.profile.tone}</p>{active.profile.address && <p className="text-sm text-ink-2">მიმართვა · {addressForms[active.profile.address].label}</p>}<Link className="text-accent underline" href={"/admin/voice/" + active.id}>დამტკიცებული ნიმუშები</Link>
      {admin && <form action={startVoiceAction} className="space-y-3">
        <input type="hidden" name="scope" value="catalog"/><input type="hidden" name="run" value={randomUUID()}/>
        <input type="hidden" name="plan" value={plan.token}/><input type="hidden" name="basis" value={active.id}/><input type="hidden" name="revision" value={active.profileVersion}/>
        {plan.ids.map(id => <input type="hidden" name="product" key={id} value={id}/>)}
        <p className="text-sm">მოსამზადებელი აღწერები · {plan.ids.length}. ხელახლა გამოსაყენებელი ნიმუშები · {plan.reused}. ფასიანი მოთხოვნები · {plan.requests}.</p>
        {canNotify && <label className="block text-sm"><input type="checkbox" name="notify"/> დასრულებისას ეცნობოს მაღაზიის თანამშრომლებს ელფოსტით</label>}
        <button className={primary} disabled={!voiceEnabled() || !plan.ids.length}>მოამზადე კატალოგის აღწერები ამ ხმით</button>
      </form>}
    </section>}
    {admin && <BatchForm key={profile.revision + "/" + (profile.activeRunId ?? "")} run={randomUUID()} basis={profile.activeRunId}
      version={profile.revision} initial={{ ...defaultProfile, ...profile.profile }} enabled={voiceEnabled()} {...{ products, suggested, canNotify }}/>}
    <section className="space-y-2 rounded-card border border-line bg-surface p-4">
      <h2 className="text-lg font-semibold">აღწერის ხილვადობა · ბოლო 30 დღე</h2>
      {totals.review && <p className="text-sm text-ink-2">საცდელი რეჟიმის მონაცემები</p>}
      {totals.openings > 0 ? <p>აღრიცხული {totals.openings} გახსნიდან აღწერის დასაწყისი ეკრანზე ზედიზედ 3 წამით გამოჩნდა {totals.exposures} შემთხვევაში ({Math.round(totals.exposures / totals.openings * 100)}%).</p> :
        <p>აღწერიანი პროდუქტის გვერდის გახსნა ჯერ არ აღრიცხულა.</p>}
      <p className="text-sm text-ink-2">ითვლება აღწერიანი გვერდის გახსნა აქტიურ ჩანართში. ერთ ადამიანს გვერდის რამდენჯერმე გახსნა შეუძლია.</p>
    </section>
    {blocked.length > 0 && <details className="text-sm"><summary>გამოტოვებული პროდუქტები · {blocked.length}</summary>
      <ul>{blocked.map(p => <li key={p.id}>{p.name} · {p.blocked}</li>)}</ul></details>}
    <section><h2 className="mb-2 text-lg font-semibold">სამუშაო ჯგუფები</h2>
      {runs.some(r => r.policy && !r.completedAt) && <Refresh automatic={true}/>}
      <ul className="divide-y divide-line rounded-card border border-line bg-surface">{runs.map(run =>
        <li key={run.id}><Link prefetch={false} className="flex flex-wrap justify-between gap-2 p-3 text-accent" href={"/admin/voice/" + run.id}>
          <span>{scopes[run.scope]}{run.completedAt && " · დასრულებულია"}</span><span className="text-sm text-ink-2">{dateText(run.createdAt)} · პროფილი {run.profileVersion + 1}</span>
        </Link></li>)}</ul>
    </section>
  </div>;
}
export default function Page(props: PageProps<"/admin/voice">) { return <Suspense><Dashboard {...props}/></Suspense>; }
