import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getIndex } from "@/lib/catalog";
import { DECISION_TASKS, getDecisionTask, taskScope } from "@/lib/decisions/tasks";
import { Breadcrumbs } from "@/components/Header";
import { Listing, ListingSkeleton } from "@/components/Listing";
import { DecisionSignals } from "@/components/analytics/DecisionSignals";
import { DecisionFeedback } from "@/components/analytics/DecisionFeedback";
import ui from "@/components/storefront/foundation.module.css";
import css from "@/components/decisions/decisions.module.css";

export function generateStaticParams() { return DECISION_TASKS.map(task => ({ task: task.id })); }
export async function generateMetadata({ params }: PageProps<"/choose/[task]">): Promise<Metadata> {
  const task = getDecisionTask((await params).task);
  return task ? { title: task.title + " — ტექნიკის არჩევა", description: task.intro, alternates: { canonical: "/choose/" + task.id } } : {};
}
async function TaskContent({ params, searchParams }: PageProps<"/choose/[task]">) {
  const task = getDecisionTask((await params).task);
  if (!task) notFound();
  const { catalog } = await getIndex();
  const { products, groups } = taskScope(task, catalog);
  const path = "/choose/" + task.id;
  return <>
    <Breadcrumbs items={[{ href: "/", label: "მთავარი" }, { href: "/choose", label: "არჩევა სამუშაოს მიხედვით" }, { label: task.title }]} />
    <div className={css.page}>
      <DecisionSignals key={task.id} events={[task.event]} />
      <header className={css.heading}>
        <h1 className={ui.pageTitle}>{task.title}</h1><p className={ui.lead}>{task.intro}</p>
        <div className={ui.actions}><a href="#task-products" className={ui.primaryAction}>პროდუქტების ნახვა</a><Link href="/choose" className={ui.quietAction}>სხვა სამუშაო</Link></div>
      </header>
      <section className={ui.panel} aria-labelledby="task-checks">
        <div className={css.support}>
          <h2 id="task-checks" className={ui.sectionTitle}>არჩევამდე გაარკვიე სამი საკითხი</h2>
          <div className={css.questionGrid}>
            {task.questions.map((question, i) => <div className={css.question} key={question.title}>
              <p aria-hidden="true" className="font-semibold">{String(i + 1).padStart(2, "0")}</p><h3>{question.title}</h3><p>{question.detail}</p>
            </div>)}
          </div>
          <p className={ui.notice}>{task.caution}</p>
          <div className={ui.actions}><Link href="/help" className={ui.quietAction}>არჩევანის საერთო წესები</Link><Link href="/info/contact" className={ui.quietAction}>მაღაზიასთან დაკავშირება</Link></div>
        </div>
      </section>
      <section className={css.support} id="task-products" aria-labelledby="task-products-title" data-testid="task-products">
        <h2 id="task-products-title" className={ui.sectionTitle}>რა შეგიძლია განიხილო</h2>
        <p className={ui.lead}>ეს არის ამ სამუშაოსთვის შესაბამისი კატალოგის ჯგუფები და არა კონკრეტული მოდელების რეკომენდაცია. გამოიყენე არსებული ფასებისა და მახასიათებლების ფილტრები; უცნობი ინფორმაცია უცნობად რჩება.</p>
        {groups.length > 0 ? <>
          {groups.length > 1 && <nav className={css.groups} aria-label="სამუშაოს შესაბამისი ჯგუფები">
            <Link href={path + "#task-products"} className={ui.secondaryAction}>ყველა ჯგუფი · {products.length}</Link>
            {groups.map(({ type, count }) => <Link key={type.id} href={path + "?" + new URLSearchParams({ type: type.id }) + "#task-products"} className={ui.secondaryAction}>{type.name_plural} · {count}</Link>)}
          </nav>}
          <Suspense fallback={<ListingSkeleton />}><Listing base={products} types={groups.map(g => g.type)} pathname={path} searchParams={searchParams} /></Suspense>
          <p className={ui.lead}>შეინახე ვარიანტები, რომლებიც გაინტერესებს. ერთი ტიპის პროდუქტები შეგიძლია შეადარო მათ გამოქვეყნებულ მონაცემებზე დაყრდნობით.</p>
          <div className={ui.actions}><Link href="/compare" className={ui.secondaryAction}>შედარების ნახვა</Link><Link href="/saved" className={ui.quietAction}>შენახული პროდუქტები</Link></div>
        </> : <div className={ui.state}><p className={ui.stateTitle}>ამ ჯგუფის პროდუქტები ჯერ არ ჩანს</p><p className={ui.stateCopy}>ეს არ ნიშნავს, რომ სამუშაოს შესრულება შეუძლებელია. სხვა არჩევანისთვის გამოიყენე კატალოგი ან დაუკავშირდი მაღაზიას.</p><Link href="/search" className={ui.secondaryAction}>სრული კატალოგი</Link></div>}
      </section>
      <DecisionFeedback key={task.id} area="task" />
    </div>
  </>;
}
export default function TaskPage(props: PageProps<"/choose/[task]">) {
  return <Suspense fallback={<ListingSkeleton />}><TaskContent {...props}/></Suspense>;
}
