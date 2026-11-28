import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth/admin";
import { getStore } from "@/config/store";
import { businessSummary, decisionSummary, type ReportingDays } from "@/lib/analytics/service";
import { feedbackCounts, type Counts, type DecisionEvent, type FeedbackArea } from "@/lib/analytics/model";

export const metadata: Metadata = { title: "გადაწყვეტილების ანალიტიკა", robots: { index: false, follow: false } };
const panel = "space-y-3 rounded-card border border-line bg-surface p-4";
const number = new Intl.NumberFormat("ka-GE");
const fmt = (n: number) => number.format(n);
const searchTotal = (c: Counts) => c.search_results + c.search_no_results + c.search_filtered_empty;
const friction = (c: Counts) => c.cart_stock_unknown + c.cart_price_unknown + c.cart_unavailable +
  c.cart_price_changed + c.cart_qty_adjusted + c.cart_quote_failed + c.checkout_delivery_unknown +
  c.checkout_method_unavailable + c.checkout_validation_error + c.checkout_server_error;
const feedbackTotal = (c: Counts) => (["search", "compare", "product"] as const).reduce((sum, a) => sum + feedbackCounts(c, a).total, 0);
type Metric = [DecisionEvent, string];
const groups: { title: string; description: string; metrics: Metric[] }[] = [
  { title: "ძიება და ფილტრები", description: "რამდენად ხშირად აჩვენა ძიებამ შედეგი და სად გახდა აუცილებელი არჩევანის შეცვლა.",
    metrics: [
      ["search_results", "ძიების გვერდი შედეგებით"], ["search_no_results", "ძიება შედეგის გარეშე"],
      ["search_filtered_empty", "ძიებაში ფილტრების შემდეგ ცარიელი შედეგი"], ["search_corrected", "ნაჩვენები შესწორება"],
      ["search_reformulated", "საძიებო ფრაზის შეცვლით ძიების ხელახლა გაშვება"],
      ["search_suggestion_product", "ძიების შეთავაზებიდან პროდუქტზე გადასვლა"],
      ["search_suggestion_category", "ძიების შეთავაზებიდან კატეგორიაზე გადასვლა"],
      ["catalog_filtered_empty", "კატალოგის ფილტრებით ცარიელი შედეგი"],
    ] },
  { title: "პროდუქტზე ინფორმაცია", description: "ხილული პროდუქტის გვერდები და დაუზუსტებელი კომერციული ფაქტები; არა მომხმარებლის განზრახვა.",
    metrics: [
      ["product_view", "პროდუქტის გვერდის ნახვა"], ["product_stock_unknown", "მარაგი დასაზუსტებელია"],
      ["product_price_unknown", "ფასი დასაზუსტებელია"], ["product_out_of_stock", "ამოწურული პროდუქტი"],
    ] },
  { title: "არჩევანის ინსტრუმენტები", description: "შენახვისა და შედარების გამოყენება, მათ შორის შეზღუდვები და შეცდომები.",
    metrics: [
      ["saved_add", "შენახულში დამატება"], ["compare_add", "შედარებაში დამატება"],
      ["compare_ready", "მინიმუმ ორი თავსებადი პროდუქტის შედარების ხედი"],
      ["compare_differences", "მხოლოდ განსხვავებების ჩართვა"],
      ["compare_block_type", "შედარების შეზღუდვა — განსხვავებული ტიპი"],
      ["compare_block_limit", "შედარების შეზღუდვა — რაოდენობა"],
      ["compare_block_unknown", "შედარების შეზღუდვა — უცნობი პროდუქტი"],
      ["compare_lookup_failed", "შედარების მონაცემების ჩატვირთვის პრობლემა"],
    ] },
  { title: "შეძენამდე დაბრკოლებები", description: "კალათისა და შეკვეთის ხედებში დაფიქსირებული მდგომარეობები; ერთ ხედში რამდენიმე მიზეზი შეიძლება არსებობდეს.",
    metrics: [
      ["cart_add", "კალათაში დამატების მოქმედება"], ["cart_stock_unknown", "კალათაში დაუდასტურებელი მარაგი"],
      ["cart_price_unknown", "კალათაში დაუდასტურებელი ფასი"], ["cart_unavailable", "აღარ ხელმისაწვდომი პროდუქტი"],
      ["cart_price_changed", "ფასის ცვლილება"], ["cart_qty_adjusted", "რაოდენობის ცვლილება"],
      ["cart_quote_failed", "კალათის გადამოწმების შეცდომა"],
      ["checkout_view", "შეკვეთის ფორმის ხედი"], ["checkout_delivery_unknown", "მიწოდების უცნობი საფასური"],
      ["checkout_method_unavailable", "გადახდის ან მიღების წესი მიუწვდომელია"],
      ["checkout_submit", "შეკვეთის ფორმის გაგზავნის მცდელობა"],
      ["checkout_validation_error", "ფორმის ველების შეცდომიანი ხედი"],
      ["checkout_server_error", "შეკვეთის სერვერული უარის ხედი"],
    ] },
  { title: "პირობების დაზუსტება", description: "ფორმის გამოყენება; რეალურად შექმნილი მოთხოვნები ცალკე, ოპერაციულ ნაწილშია.",
    metrics: [
      ["request_form_view", "მოთხოვნის ფორმის ხედი"], ["request_submit", "მოთხოვნის გაგზავნის მცდელობა"],
      ["request_error", "მოთხოვნის ფორმის შეცდომიანი ხედი"],
    ] },
];
function MetricRows({ counts, metrics }: { counts: Counts; metrics: Metric[] }) {
  return <dl className="divide-y divide-line">{metrics.map(([key, title]) => <div className="flex items-start justify-between gap-3 py-2 text-sm" key={key}>
    <dt>{title}</dt><dd className="shrink-0 font-semibold tabular-nums" data-testid={"metric-" + key}>{fmt(counts[key])}</dd>
  </div>)}</dl>;
}
const areas: { area: FeedbackArea; title: string }[] = [
  { area: "search", title: "ძიება — ინფორმაციის პოვნა" },
  { area: "product", title: "პროდუქტი — ინფორმაციის საკმარისობა" },
  { area: "compare", title: "შედარება — არჩევანის გაკეთება" },
];
function Feedback({ counts, area, title }: { counts: Counts; area: FeedbackArea; title: string }) {
  const { yes, partly, no, total } = feedbackCounts(counts, area);
  const values = [{ label: "კი", n: yes, className: "bg-accent" }, { label: "ნაწილობრივ", n: partly, className: "bg-ink-2" }, { label: "არა", n: no, className: "bg-warn" }];
  return <div className="space-y-2 rounded-card border border-line p-3">
    <h3 className="font-medium">{title}</h3>
    <p className="text-sm text-ink-2">{total ? fmt(total) + " პასუხი" : "ჯერ პასუხი არ გვაქვს"}</p>
    {total > 0 && <div className="flex h-2 overflow-hidden rounded-full bg-line" aria-hidden="true">
      {values.map(v => <span key={v.label} className={v.className} style={{ width: 100 * v.n / total + "%" }} />)}
    </div>}
    <dl className="grid grid-cols-3 gap-2 text-sm">
      {values.map((v, i) => <div key={v.label}><dt className="text-ink-2">{v.label}</dt>
        <dd className="font-semibold tabular-nums" data-testid={"metric-" + area + "_feedback_" + (["yes", "partly", "no"][i])}>{fmt(v.n)}</dd></div>)}
    </dl>
  </div>;
}
async function Dashboard({ searchParams }: PageProps<"/admin/analytics">) {
  await connection();
  if (!(await isAdmin())) redirect("/admin/login?next=/admin/analytics");
  const sp = await searchParams;
  const days: ReportingDays = sp.days === "7" ? 7 : 30;
  const review = sp.mode === "review" ? true : sp.mode === "public" ? false : getStore().showReview;
  const [{ totals, days: daily }, business] = await Promise.all([decisionSummary(days, review), businessSummary(days)]);
  const search = searchTotal(totals);
  const href = (d: ReportingDays, r: boolean) => "/admin/analytics?days=" + d + "&mode=" + (r ? "review" : "public");
  const tab = (label: string, url: string, active: boolean) => <Link key={url} href={url} aria-current={active ? "page" : undefined}
    className={`rounded-full border px-3 py-1.5 text-sm ${active ? "border-accent bg-accent-soft" : "border-line bg-surface"}`}>{label}</Link>;
  return <div className="mx-auto max-w-6xl space-y-5">
    <header className="space-y-2">
      <h1 className="text-2xl font-bold">გადაწყვეტილების ანალიტიკა</h1>
      <p className="text-sm text-ink-2">ვამოწმებთ, რამდენად ეხმარება მაღაზია ადამიანს საჭირო ინფორმაციის მოძიებასა და არჩევანში — არა მხოლოდ გაყიდვაში.</p>
    </header>
    <div className="flex flex-wrap items-center gap-2">
      {tab("7 დღე", href(7, review), days === 7)}{tab("30 დღე", href(30, review), days === 30)}
    </div>
    <div className="flex flex-wrap items-center gap-2">
      {tab("საჯარო რეჟიმი", href(days, false), !review)}{tab("საცდელი რეჟიმი", href(days, true), review)}
    </div>
    <p className="rounded-card border border-line bg-surface p-3 text-sm" data-testid="analytics-mode">{review ? "საცდელი" : "საჯარო"} რეჟიმის დღიური ჯამები · საქართველოს დრო · ბოლო {days} კალენდარული დღე, მიმდინარე დღის ჩათვლით.</p>
    {!daily.length && <p className="text-sm text-ink-2" data-testid="analytics-empty">ამ პერიოდში და რეჟიმში ანალიტიკის ჩანაწერები ჯერ არ გვაქვს. ნულოვანი მაჩვენებელი არ ნიშნავს ნულოვან ვიზიტს.</p>}
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[{ label: "ძიების ხედები", n: search }, { label: "უშედეგო ძიების ხედები", n: totals.search_no_results },
        { label: "შედარების ხედები", n: totals.compare_ready }, { label: "ნებაყოფლობითი პასუხები", n: feedbackTotal(totals) }].map(v =>
        <div key={v.label} className={panel}><p className="text-sm text-ink-2">{v.label}</p><p className="text-2xl font-semibold tabular-nums">{fmt(v.n)}</p></div>)}
    </div>
    <section className={panel}>
      <h2 className="text-lg font-semibold">მომხმარებლის მიერ შეფასებული სარგებლიანობა</h2>
      <p className="text-sm text-ink-2">ეს პასუხები ნებაყოფლობითია და არ წარმოადგენს ყველა მომხმარებლის შეფასებას. „კი“ არ ნიშნავს, რომ ადამიანმა აუცილებლად შეიძინა პროდუქტი ან რომ არჩევანი ობიექტურად საუკეთესო იყო.</p>
      <div className="grid gap-3 lg:grid-cols-3">{areas.map(a => <Feedback key={a.area} counts={totals} {...a} />)}</div>
    </section>
    <div className="grid gap-4 lg:grid-cols-2">{groups.map(g => <section className={panel} key={g.title}>
      <h2 className="text-lg font-semibold">{g.title}</h2><p className="text-sm text-ink-2">{g.description}</p>
      <MetricRows counts={totals} metrics={g.metrics} />
    </section>)}</div>
    <section className={panel}>
      <h2 className="text-lg font-semibold">დღიური დინამიკა</h2>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm" data-testid="analytics-daily">
        <thead className="border-b border-line text-xs text-ink-2"><tr>{["თარიღი", "ძიება", "უშედეგო", "შედარება", "დაბრკოლებები*", "პასუხები"].map(h => <th key={h} className="px-2 py-2">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-line">{daily.map(({ day, counts }) => <tr key={day}>
          <td className="whitespace-nowrap px-2 py-2">{day}</td>{[searchTotal(counts), counts.search_no_results, counts.compare_ready, friction(counts), feedbackTotal(counts)].map((n, i) => <td key={i} className="px-2 py-2 tabular-nums">{fmt(n)}</td>)}
        </tr>)}</tbody>
      </table></div>
      <p className="text-xs text-ink-2">* სხვადასხვა დაბრკოლების ჯამი; არა უნიკალური ვიზიტების რაოდენობა. დღეები ჩანაწერის გარეშე არ არის ნაჩვენები.</p>
    </section>
    <section className={panel} data-testid="analytics-business">
      <h2 className="text-lg font-semibold">ოპერაციული შედეგები — ყველა რეჟიმი ერთად</h2>
      <p className="text-sm text-ink-2">შეკვეთებისა და მოთხოვნების რეალური ჩანაწერები, ბოლო {days} დღეში შექმნილი ჩანაწერების ამჟამინდელი სტატუსით. მათ შეიძლება საცდელი ჩანაწერებიც შეიცავდეთ. რეჟიმის ფილტრი აქ არ მოქმედებს.</p>
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[["შექმნილი შეკვეთები", business.orders], ["გადახდილი, გაუქმებულის გარეშე", business.paid], ["დასრულებული", business.completed], ["გაუქმებული", business.cancelled],
          ["შექმნილი მოთხოვნები", business.requests], ["დასამუშავებელი", business.awaiting], ["პასუხი მზადაა", business.answered], ["შეკვეთად გარდაქმნილი მოთხოვნები", business.converted]].map(([label, n]) =>
          <div key={label} className="rounded-card border border-line p-3"><dt className="text-sm text-ink-2">{label}</dt><dd className="font-semibold tabular-nums">{fmt(Number(n))}</dd></div>)}
      </dl>
    </section>
    <section className={panel}>
      <h2 className="text-lg font-semibold">როგორ წავიკითხოთ მონაცემები</h2>
      <p className="text-sm text-ink-2">დათვლილია მოვლენები და ხილული ხედები, არა ადამიანები ან სესიები. ერთი ვიზიტი შეიძლება რამდენიმე ჩანაწერს შეიცავდეს. დათვლა არ აკავშირებს მოვლენებს ერთმანეთთან; ამიტომ ანონიმური სიგნალებიდან კონვერსიის ან მიტოვების მაჩვენებელი არ გამოითვლება. დაბრკოლება შესწავლის მიზეზია, არა მტკიცებულება. ბრაუზერის გამორთული სტატისტიკა, ბოტები და ტექნიკური შეფერხება შედეგებზე გავლენას ახდენს.</p>
      <Link href="/admin/voice" className="text-sm text-accent underline">პროდუქტის აღწერის ხილვადობა — მაღაზიის ხმა</Link>
    </section>
  </div>;
}
export default function AnalyticsPage(props: PageProps<"/admin/analytics">) {
  return <Suspense fallback={<p role="status">ანალიტიკა იტვირთება…</p>}><Dashboard {...props} /></Suspense>;
}
