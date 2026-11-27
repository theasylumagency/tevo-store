"use client";

import Image from "next/image";
import { useId, useLayoutEffect, useState, type KeyboardEvent } from "react";
import { OverlayDialog } from "./OverlayDialog";
import { ChevronIcon, CloseIcon, PackageIcon } from "./StoreIcons";
import { productCopy } from "@/i18n/product";
import ui from "./storefront/foundation.module.css";
import styles from "./product.module.css";

export function Gallery({ images, alt, emptyLabel }: { images: { src: string }[]; alt: string; emptyLabel: string }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState<string[]>([]);
  const [attempt, setAttempt] = useState(0);
  const labelId = useId();
  const current = images.find((image) => image.src === selected) ?? images[0];
  const index = current ? images.indexOf(current) : 0;
  const failedImage = !!current && failed.includes(current.src);

  useLayoutEffect(() => () => setOpen(false), []);

  const changeImage = (next: number) => {
    setSelected(images[(next + images.length) % images.length].src);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (images.length < 2 || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return;
    event.preventDefault();
    changeImage(index + (event.key === "ArrowRight" ? 1 : -1));
  };
  const imageFailed = () => setFailed((previous) => current && !previous.includes(current.src) ? [...previous, current.src] : previous);
  const retry = () => {
    setFailed((previous) => previous.filter((src) => src !== current.src));
    setAttempt((value) => value + 1);
  };

  if (!current) return <div className={styles.imageEmpty}>
    <PackageIcon size={44} /><p>{emptyLabel}</p><span>{productCopy.galleryMissing}</span>
  </div>;

  const fallback = <div className={styles.imageError} role="status">
    <PackageIcon size={36} /><p>{productCopy.galleryFailed}</p>
    <button type="button" className={ui.secondaryAction} onClick={retry}>{productCopy.galleryRetry}</button>
  </div>;

  return (
    <div className={styles.gallery} role="group" aria-label={productCopy.gallery}>
      <div className={styles.imageFrame}>
        {failedImage ? fallback : <button type="button" className={styles.imageButton} aria-haspopup="dialog"
          aria-label={`${productCopy.galleryOpen}: ${alt}`} onClick={(event) => { event.currentTarget.focus(); setOpen(true); }}>
          <Image key={`${current.src}-${attempt}`} src={current.src} alt={alt} fill loading="eager" fetchPriority={index === 0 ? "high" : "auto"}
            sizes="(min-width:1280px) 620px, (min-width:1024px) 50vw, 100vw" className={styles.image} onError={imageFailed} />
          <span className={styles.enlargeLabel} aria-hidden="true"><span>＋</span>{productCopy.galleryOpen}</span>
        </button>}
      </div>
      {images.length > 1 && <div className={styles.thumbnails} role="group" aria-label={productCopy.gallery}>
        {images.map((image, imageIndex) => <button key={image.src} type="button" onClick={() => setSelected(image.src)}
          aria-label={`${productCopy.galleryPhoto} ${imageIndex + 1}: ${alt}`} aria-pressed={imageIndex === index}
          className={styles.thumbnail}>
          {failed.includes(image.src) ? <PackageIcon size={24} /> : <Image src={image.src} alt="" fill sizes="72px" className={styles.thumbnailImage} />}
          <span className={styles.thumbnailNumber} aria-hidden="true">{imageIndex + 1}</span>
        </button>)}
      </div>}
      <OverlayDialog open={open} onClose={() => setOpen(false)} labelledBy={labelId} className={styles.lightbox}>
        <div className={styles.lightboxContent} onKeyDown={onKeyDown}>
          <header className={styles.lightboxHeader}>
            <p id={labelId}>{alt}</p>
            <button type="button" onClick={() => setOpen(false)} data-dialog-autofocus className={styles.galleryControl} aria-label={productCopy.galleryClose}><CloseIcon /></button>
          </header>
          <div className={styles.lightboxImage}>
            {failedImage ? fallback : <Image key={`${current.src}-${attempt}`} src={current.src} alt={`${alt} — ${index + 1}`}
              fill sizes="(min-width:1200px) 1100px, 100vw" loading="eager" className={styles.image} onError={imageFailed} />}
          </div>
          <footer className={styles.lightboxFooter}>
            {images.length > 1 && <button type="button" onClick={() => changeImage(index - 1)} className={styles.galleryControl} aria-label={productCopy.galleryPrevious}><ChevronIcon className={styles.previousIcon} /></button>}
            <p aria-live="polite" aria-atomic="true">{index + 1} / {images.length}</p>
            {images.length > 1 && <button type="button" onClick={() => changeImage(index + 1)} className={styles.galleryControl} aria-label={productCopy.galleryNext}><ChevronIcon /></button>}
          </footer>
        </div>
      </OverlayDialog>
    </div>
  );
}
