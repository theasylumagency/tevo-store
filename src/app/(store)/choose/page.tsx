import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { getIndex } from "@/lib/catalog";
import { availableTasks } from "@/lib/decisions/tasks";
import { Breadcrumbs } from "@/components/Header";
import { CategoryIcon, ChevronIcon } from "@/components/StoreIcons";
import { DecisionSignals } from "@/components/analytics/DecisionSignals";
import ui from "@/components/storefront/foundation.module.css";
import css from "@/components/decisions/decisions.module.css";

export const metadata: Metadata = { title: "ტექნიკის არჩევა სამუშაოს მიხედვით", alternates: { canonical: "/choose" } };

async function TaskDirectory() {
  const { catalog } = await getIndex();
  const tasks = availableTasks(catalog);
  return <div className={css.page}>
    <DecisionSignals events={["task_directory_view"]} />
    <header className={css.heading}><h1 className={ui.pageTitle}>რა სამუშაოს გეგმავ?</h1>
      <p className={ui.lead}>აირჩიე საქმე, რომელსაც აკეთებ. გაჩვენებთ, რა უნდა გაითვალისწინო და რა ჯგუფის პროდუქტები შეგიძლია განიხილო. კონკრეტული მოდელის შესაფერისობა ცალკე გადაამოწმე.</p>
    </header>
    {tasks.length > 0 ? <div className={css.taskGrid} data-testid="task-directory">
      {tasks.map(({ task, count }) => <Link key={task.id} href={"/choose/" + task.id} className={css.taskCard} data-task-id={task.id}>
        <span className={css.icon}><CategoryIcon category={task.icon} size={26} /></span>
        <h2>{task.title}</h2><p>{task.intro}</p>
        <span className={css.taskFoot}><span>{count} პროდუქტი კატალოგში</span><ChevronIcon size={18}/></span>
      </Link>)}
    </div> : <div className={ui.notice}>სამუშაოს მიხედვით შერჩევისთვის შესაბამისი პროდუქტები ჯერ არ არის გამოქვეყნებული.</div>}
    <section className={ui.panel}><div className={css.support}>
      <h2 className={ui.sectionTitle}>სხვა სამუშაო გაქვს ან ჯერ არ იცი, რა გჭირდება?</h2>
      <p className={ui.lead}>შეგიძლია პირდაპირ კატალოგში მოძებნო პროდუქტი ან გაეცნო არჩევანის საერთო წესებს.</p>
      <div className={ui.actions}><Link href="/help" className={ui.secondaryAction}>დახმარება არჩევაში</Link><Link href="/search" className={ui.quietAction}>სრული კატალოგი</Link></div>
    </div></section>
  </div>;
}
export default function ChoosePage() {
  return <><Breadcrumbs items={[{ href: "/", label: "მთავარი" }, { label: "არჩევა სამუშაოს მიხედვით" }]} />
    <Suspense fallback={<p role="status">იტვირთება…</p>}><TaskDirectory /></Suspense></>;
}
