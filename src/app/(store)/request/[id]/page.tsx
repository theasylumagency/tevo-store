import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { connection } from "next/server";
import { getPublicRequest } from "@/lib/requests/service";
import { DELIVERY_LABELS, REQUEST_LABELS, type RequestDelivery } from "@/lib/requests/model";
import { formatTetri } from "@/lib/money";
import { t } from "@/i18n";
import ui from "@/components/storefront/foundation.module.css";

export const metadata: Metadata = { title: "მოთხოვნის მდგომარეობა", robots: { index: false, follow: false }, referrer: "no-referrer" };

async function Receipt({ params, searchParams }: PageProps<"/request/[id]">) {
  await connection();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const request = await getPublicRequest(id, typeof sp.t === "string" ? sp.t : undefined);
  if (!request) return <section className={ui.state}>
    <h1 className={ui.stateTitle}>მოთხოვნა ვერ მოიძებნა</h1>
    <p className={ui.stateCopy}>გახსენით მოთხოვნის მიღებისას ნაჩვენები სრული პირადი ბმული.</p>
    <Link href="/info/contact" className={ui.secondaryAction}>დაკავშირება</Link>
  </section>;
  return <div className="mx-auto max-w-3xl space-y-5" data-testid="purchase-request-receipt">
    <header className="space-y-2">
      <h1 className={ui.pageTitle}>მოთხოვნა {REQUEST_LABELS[request.status].toLowerCase()}</h1>
      <p className="text-sm text-ink-2 break-all">ნომერი: {request.id}</p>
      <p className={ui.lead}>შეინახეთ ეს პირადი ბმული და დაბრუნდით პასუხის სანახავად.</p>
      <p className={ui.notice}>შეკვეთა არ შექმნილა. თანხა არ არის გადახდილი; მარაგი და ფასი არ ჯავშნდება.</p>
    </header>
    <section className="space-y-3 rounded-card border border-line bg-surface p-4">
      <h2 className={ui.sectionTitle}>თქვენი მოთხოვნა</h2>
      <ul className="divide-y divide-line">
        {request.lines.map(p => <li key={p.productId} className="space-y-1 py-3">
          <Link href={"/p/" + p.slug} className="underline underline-offset-4">{p.name}</Link>
          <p>{p.qty} ც. · {formatTetri(p.unitPrice) ?? "ფასი დასაზუსტებელია"} / ერთეული</p>
          <p className="text-sm text-ink-2">{t(`product.availability.${p.availability}`)}</p>
        </li>)}
      </ul>
      <p className="text-sm text-ink-2">ფასი და მარაგი მოთხოვნის გაგზავნის მომენტს ასახავს და არ წარმოადგენს დადასტურებულ შეთავაზებას.</p>
      <p>მიღება: {DELIVERY_LABELS[request.deliveryMethod as RequestDelivery]}</p>
      {request.question && <p className="whitespace-pre-wrap break-words">{request.question}</p>}
    </section>
    <section className="space-y-3 rounded-card border border-line bg-surface p-4">
      <h2 className={ui.sectionTitle}>მაღაზიის პასუხი</h2>
      {request.response ? <p className="whitespace-pre-wrap break-words" data-testid="purchase-request-response">{request.response}</p>
        : <p className="text-ink-2">{request.status === "closed" ? "მოთხოვნა დახურულია." : "პასუხი ჯერ არ არის დამატებული."}</p>}
      <p className="text-sm text-ink-2">პასუხი არ არის შეკვეთა ან გადახდის მოთხოვნა.</p>
    </section>
    <div className={ui.actions}><Link href="/cart" className={ui.secondaryAction}>კალათა</Link><Link href="/search" className={ui.quietAction}>კატალოგი</Link></div>
  </div>;
}

export default function RequestReceipt(props: PageProps<"/request/[id]">) {
  return <Suspense fallback={<p role="status">მოთხოვნა იტვირთება…</p>}><Receipt {...props} /></Suspense>;
}
