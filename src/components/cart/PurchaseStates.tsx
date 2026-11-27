import Link from "next/link";
import { PackageIcon } from "@/components/StoreIcons";
import { t } from "@/i18n";
import ui from "@/components/storefront/foundation.module.css";
import styles from "./purchase.module.css";

export function EmptyCart() {
  return <section className={ui.state} aria-labelledby="empty-cart-title">
    <div className={styles.emptyIcon}><PackageIcon size={40} /></div>
    <h2 id="empty-cart-title" className={ui.stateTitle}>{t("cart.empty")}</h2>
    <p className={ui.stateCopy}>აირჩიეთ პროდუქტი კატალოგში და დაამატეთ კალათაში. შეკვეთის გაფორმება რეგისტრაციის გარეშე შეგიძლიათ.</p>
    <div className={ui.actions}><Link href="/search" className={ui.primaryAction}>{t("cart.continue")}</Link></div>
  </section>;
}

export function PurchaseLoading({ checkout = false }: { checkout?: boolean }) {
  return <div className={styles.cartBody} role="status" aria-live="polite">
    <p className={styles.loadingNote}>{checkout ? "შეკვეთის ფორმა იტვირთება…" : "კალათა იტვირთება…"}</p>
    <div className={styles.loadingGrid} aria-hidden="true">
      <div className={styles.loadingRows}>
        <div className={`${ui.skeleton} ${styles.loadingRow}`} />
        <div className={`${ui.skeleton} ${styles.loadingRow}`} />
      </div>
      <div className={`${ui.skeleton} ${styles.loadingSummary}`} />
    </div>
  </div>;
}
