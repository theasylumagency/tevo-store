"use client";
import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { button } from "../../catalog/styles";
export function Refresh({ automatic }: { automatic: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  useEffect(() => {
    if (automatic) {
      const timer = setInterval(() => start(() => router.refresh()), 5000);
      return () => clearInterval(timer);
    }
  }, [automatic, router]);
  return <button type="button" disabled={pending} className={button} onClick={() => start(() => router.refresh())}>მდგომარეობის განახლება</button>;
}
