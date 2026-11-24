"use client";

import Image from "next/image";
import { useState } from "react";

export function Gallery({ images, alt, emptyLabel }: { images: { src: string }[]; alt: string; emptyLabel: string }) {
  const [i, setI] = useState(0);
  if (!images.length) {
    return <div className="flex aspect-square items-center justify-center rounded-card border border-line bg-surface text-sm text-ink-2">{emptyLabel}</div>;
  }
  return (
    <div className="space-y-3">
      <div className="relative aspect-square overflow-hidden rounded-card border border-line bg-white">
        <Image src={images[i].src} alt={alt} fill priority sizes="(min-width:1024px) 50vw, 100vw" className="object-contain p-4" />
      </div>
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto">
          {images.map((im, k) => (
            <button key={im.src} onClick={() => setI(k)} aria-label={`${alt} ${k + 1}`}
                    className={`relative h-16 w-16 shrink-0 overflow-hidden rounded border bg-white ${k === i ? "border-accent" : "border-line"}`}>
              <Image src={im.src} alt="" fill sizes="64px" className="object-contain p-1" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
