import ui from "./foundation.module.css";

/** Server-rendered fallback keeps the page legible while its content streams in. */
export function StorefrontLoading({ product = false }: { product?: boolean }) {
  return <div className={ui.loading} role="status" aria-live="polite" aria-busy="true">
    <p className={ui.eyebrow}>{product ? "პროდუქტი იტვირთება…" : "მაღაზია იტვირთება…"}</p>
    <div className={ui.loadingGrid} aria-hidden="true">
      <div className={`${ui.skeleton} ${ui.loadingMedia}`} />
      <div className={ui.loadingContent}>
        <div className={`${ui.skeleton} ${ui.loadingTitle}`} />
        <div className={`${ui.skeleton} ${ui.loadingLine}`} />
        <div className={`${ui.skeleton} ${ui.loadingLine}`} />
        <div className={`${ui.skeleton} ${ui.loadingAction}`} />
      </div>
    </div>
  </div>;
}
