import Link from "next/link";
import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/Header";
import { DecisionSignals } from "@/components/analytics/DecisionSignals";
import ui from "@/components/storefront/foundation.module.css";
import css from "@/components/decisions/decisions.module.css";

export const metadata: Metadata = { title: "დახმარება არჩევაში", alternates: { canonical: "/help" } };
const steps = [
  { title: "დაიწყე სამუშაოდან", text: "ჩამოაყალიბე, რას აკეთებ, სად და რა პირობებში. სამუშაოს ზომა და საჭირო შედეგი უფრო მნიშვნელოვანია, ვიდრე უბრალოდ ძვირი ან მძლავრი მოდელი.", href: "/choose", action: "სამუშაოს მიხედვით არჩევა" },
  { title: "შეადარე მხოლოდ საჭირო მახასიათებლები", text: "აირჩიე ერთი ტიპის ვარიანტები. შეადარე ფასი, კომპლექტაცია, ზომები და შენი სამუშაოსთვის მნიშვნელოვანი მონაცემები. შეუვსებელი ველი არ ნიშნავს ცუდ ან კარგ მახასიათებელს.", href: "/compare", action: "ჩემი შედარება" },
  { title: "არ დაკარგო არჩევანი", text: "შეინახე საინტერესო პროდუქტები და მოგვიანებით დაუბრუნდი. არ არის აუცილებელი გადაწყვეტილება პირველივე ვიზიტზე მიიღო.", href: "/saved", action: "შენახული პროდუქტები" },
  { title: "გაიგე სრული ღირებულება და პირობები", text: "პროდუქტის ფასს შეიძლება დაემატოს მიწოდება ან საჭირო აქსესუარი. თუ ფასი, მარაგი, თავსებადობა ან მიწოდება დასაზუსტებელია, პროდუქტის გვერდიდან მოითხოვე სრული პირობები.", href: "/request", action: "ჩემი კალათის პირობების დაზუსტება" },
];
export default function HelpPage() {
  return <>
    <Breadcrumbs items={[{ href: "/", label: "მთავარი" }, { label: "დახმარება არჩევაში" }]} />
    <div className={css.page}>
      <DecisionSignals events={["decision_help_view"]} />
      <header className={css.heading}><h1 className={ui.pageTitle}>როგორ გავაკეთო სწორი არჩევანი?</h1>
        <p className={ui.lead}>მთავარია, ტექნიკა შენს სამუშაოს და პირობებს შეესაბამებოდეს. ეს გვერდი დაგეხმარება საჭირო ინფორმაციის შეკრებაში, არა შეძენის დაჩქარებაში.</p></header>
      <div className={css.taskGrid} data-testid="decision-help">
        {steps.map((step, i) => <section className={ui.panel + " " + css.support} key={step.href}>
          <p aria-hidden="true" className={ui.eyebrow}>{String(i + 1).padStart(2, "0")}</p><h2 className={ui.sectionTitle}>{step.title}</h2><p className={ui.lead}>{step.text}</p>
          <Link href={step.href} className={ui.quietAction}>{step.action}</Link>
        </section>)}
      </div>
      <section className={ui.panel + " " + css.support}>
        <h2 className={ui.sectionTitle}>ჯერ კიდევ გაურკვეველია?</h2>
        <p className={ui.lead}>თუ პროდუქტის სპეციფიკაცია ან თავსებადობა ვერ ადასტურებს შენს მოთხოვნას, არ გამოიცნო. შეგიძლია შეკითხვა გაუგზავნო მაღაზიას ან მოგვიანებით დაბრუნდე. არ არის საჭირო აუცილებლად ახლა იყიდო.</p>
        <div className={ui.actions}><Link href="/info/contact" className={ui.secondaryAction}>მაღაზიასთან დაკავშირება</Link><Link href="/search" className={ui.quietAction}>კატალოგი და ძიება</Link></div>
      </section>
    </div>
  </>;
}
