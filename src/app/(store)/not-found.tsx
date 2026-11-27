import Link from "next/link";
import { t } from "@/i18n";
import ui from "@/components/storefront/foundation.module.css";

export default function NotFound() {
  return (
    <div className={ui.state}>
      <h1 className={ui.pageTitle}>{t("notfound.title")}</h1>
      <p className={ui.stateCopy}>გვერდის მისამართი შესაძლოა შეიცვალა. სასურველი პროდუქტი ძიებით ან კატეგორიებიდან მოძებნე.</p>
      <div className={ui.actions}>
        <Link href="/search" className={ui.primaryAction}>კატალოგის ნახვა</Link>
        <Link href="/" className={ui.quietAction}>მთავარზე დაბრუნება</Link>
      </div>
    </div>
  );
}
