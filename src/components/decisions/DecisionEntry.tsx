import Link from "next/link";
import { ChevronIcon, SearchIcon, GridIcon } from "@/components/StoreIcons";
import ui from "@/components/storefront/foundation.module.css";
import css from "./decisions.module.css";

/** Always present in each home composition, including the administrator preview. */
export function DecisionEntry() {
  const paths = [
    { href: "/search", title: "ვიცი, რას ვეძებ", text: "იპოვე კონკრეტული პროდუქტი, მოდელი ან კატეგორია.", icon: <SearchIcon size={24} /> },
    { href: "/choose", title: "ვიცი, რისი გაკეთება მინდა", text: "დაიწყე სამუშაოდან და იპოვე შესაბამისი ტექნიკის ჯგუფები.", icon: <GridIcon size={24} /> },
    { href: "/help", title: "მჭირდება დახმარება", text: "გაარკვიე, რა უნდა იცოდე არჩევანის გაკეთებამდე.", icon: <span aria-hidden="true" className={css.questionIcon}>?</span> },
  ];
  return <section className={css.entry} aria-labelledby="decision-entry-title" data-testid="decision-entry">
    <h2 id="decision-entry-title" className={ui.sectionTitle}>საიდან დავიწყოთ?</h2>
    <div className={css.entryGrid}>
      {paths.map(path => <Link key={path.href} href={path.href} className={css.entryCard}>
        <span className={css.icon}>{path.icon}</span>
        <span className={css.entryCopy}><strong>{path.title}</strong><span>{path.text}</span></span>
        <ChevronIcon size={19} className={css.chevron}/>
      </Link>)}
    </div>
  </section>;
}
