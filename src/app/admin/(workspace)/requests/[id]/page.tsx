import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth/admin";
import { getAdminRequest } from "@/lib/requests/service";
import { DELIVERY_LABELS, REQUEST_LABELS, nextRequestStatuses, type RequestDelivery } from "@/lib/requests/model";
import { updateRequestAction } from "@/app/actions/requests";
import { formatTetri } from "@/lib/money";
import { formatPhone } from "@/lib/phone";
import { t } from "@/i18n";

export const metadata: Metadata = { title: "მოთხოვნის დამუშავება", robots: { index: false, follow: false } };
const dt = new Intl.DateTimeFormat("ka-GE", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Tbilisi" });
const panel = "space-y-3 rounded-card border border-line bg-surface p-4";

async function RequestDetail({ params, searchParams }: PageProps<"/admin/requests/[id]">) {
  await connection();
  if (!(await isAdmin())) redirect("/admin/login?next=/admin/requests");
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const request = await getAdminRequest(id);
  if (!request) return <p>მოთხოვნა ვერ მოიძებნა. <Link className="underline" href="/admin/requests">ყველა მოთხოვნა</Link></p>;
  const next = nextRequestStatuses(request.status);
  return <div className="space-y-4">
    <Link className="text-accent underline" href="/admin/requests">← მოთხოვნები</Link>
    <header className="space-y-1"><h1 className="text-2xl font-bold">მოთხოვნა — {REQUEST_LABELS[request.status]}</h1>
      <p className="break-all text-sm text-ink-2">{request.id} · {dt.format(request.createdAt)}</p>
      <p className="text-sm text-ink-2">ეს არ არის შეკვეთა. ნუ დაადასტურებთ მარაგს ან პირობებს გადამოწმების გარეშე.</p>
    </header>
    {sp.result === "saved" && <p role="status" className="rounded-card bg-accent-soft p-3">ცვლილება შენახულია.</p>}
    {sp.result === "conflict" && <p role="alert" className="rounded-card bg-warn-soft p-3">ჩანაწერი უკვე შეიცვალა. შეამოწმეთ მიმდინარე მდგომარეობა და სცადეთ ხელახლა.</p>}
    {sp.result === "invalid" && <p role="alert" className="rounded-card bg-warn-soft p-3">ცვლილება არ არის დასაშვები. პასუხის გამოქვეყნებას ტექსტი სჭირდება.</p>}
    <div className="grid gap-4 lg:grid-cols-2">
      <section className={panel}>
        <h2 className="text-lg font-semibold">მომხმარებელი და ამოცანა</h2>
        <p>{request.customerName} · <a className="underline" href={"tel:" + request.customerPhone}>{formatPhone(request.customerPhone)}</a></p>
        <p>მიღება: {DELIVERY_LABELS[request.deliveryMethod as RequestDelivery]}</p>
        {request.locality && <p>დასახლება: {request.locality}</p>}
        <p className="whitespace-pre-wrap break-words">{request.question ?? "დამატებითი კომენტარი არ არის."}</p>
        <h2 className="text-lg font-semibold">პროდუქტები</h2>
        <ul className="divide-y divide-line">{request.lines.map(p => <li key={p.productId} className="space-y-1 py-3">
          <Link href={"/admin/catalog/" + encodeURIComponent(p.productId)} className="text-accent underline">{p.name}</Link>
          <p>{p.productId} · {p.qty} ც. · {formatTetri(p.unitPrice) ?? "ფასი დასაზუსტებელია"} / ერთეული</p>
          <p className="text-xs text-ink-2">{t(`product.availability.${p.availability}`)}</p>
        </li>)}</ul>
        <p className="text-sm text-ink-2">ფაქტები მოთხოვნის გაგზავნის მომენტში. კატალოგის ვერსია: {request.catalogVersion}.</p>
      </section>
      <section className={panel}>
        <h2 className="text-lg font-semibold">დამუშავება</h2>
        {request.response && <div className="rounded-card border border-line p-3">
          <p className="font-semibold">მომხმარებლისთვის ხილული პასუხი</p>
          <p className="whitespace-pre-wrap break-words">{request.response}</p>
        </div>}
        {next.length > 0 ? <form action={updateRequestAction} className="space-y-3" key={request.revision}>
          <input type="hidden" name="id" value={request.id} /><input type="hidden" name="revision" value={request.revision} />
          <label className="block space-y-1"><span>შემდეგი სტატუსი</span>
            <select name="status" className="w-full rounded-card border border-line px-3 py-2">{next.map(s => <option key={s} value={s}>{REQUEST_LABELS[s]}</option>)}</select>
          </label>
          <label className="block space-y-1"><span>პასუხი (მომხმარებელი ხედავს)</span>
            <textarea name="response" defaultValue={request.response ?? ""} maxLength={2000} rows={6} className="w-full rounded-card border border-line px-3 py-2" />
          </label>
          <p className="text-sm text-ink-2">პასუხი არ არის სავალდებულო შეთავაზება. მომხმარებელი ხედავს შენახულ პასუხს პირადი ბმულით; ავტომატური SMS ან ელფოსტა ამ მოდულში ჯერ არ იგზავნება.</p>
          <button type="submit" className="rounded-card bg-accent px-4 py-2 font-semibold text-white" data-testid="save-request">შენახვა</button>
        </form> : <p className="text-sm text-ink-2">მოთხოვნა დახურულია.</p>}
        <h2 className="text-lg font-semibold">ისტორია</h2>
        <ol className="divide-y divide-line">{request.history.map((event, index) => <li key={index} className="space-y-1 py-2">
          <p>{REQUEST_LABELS[event.status]} · {dt.format(new Date(event.at))}</p>
          {event.response && <p className="whitespace-pre-wrap break-words text-sm text-ink-2">{event.response}</p>}
        </li>)}</ol>
      </section>
    </div>
  </div>;
}
export default function AdminRequest(props: PageProps<"/admin/requests/[id]">) {
  return <Suspense fallback={<p role="status">იტვირთება…</p>}><RequestDetail {...props} /></Suspense>;
}
