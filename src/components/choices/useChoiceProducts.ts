"use client";

import { useCallback, useEffect, useState } from "react";
import { cleanChoiceIds, type ChoiceResult } from "@/lib/choices/types";

const EMPTY: ChoiceResult = { products: [], missingIds: [] };

export function useChoiceProducts(ids: readonly string[], initial?: ChoiceResult) {
  const signature = cleanChoiceIds(ids).join("|");
  const [initialSignature] = useState(initial ? signature : null);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ signature: string; attempt: number; result: ChoiceResult | null; error: boolean } | null>(null);
  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  const useInitial = Boolean(initial && initialSignature === signature && attempt === 0);

  useEffect(() => {
    if (!signature) return;
    let active = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      if (!active) return;
      active = false;
      controller.abort();
      setState({ signature, attempt, result: null, error: true });
    }, 20_000);
    const query = new URLSearchParams({ ids: signature.split("|").join(",") });
    fetch(`/api/storefront/choices?${query}`, { cache: "no-store", signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error("choice lookup failed");
      return await response.json() as ChoiceResult;
    }).then((result) => {
      window.clearTimeout(timeout);
      if (active) setState({ signature, attempt, result, error: false });
    }).catch(() => {
      window.clearTimeout(timeout);
      if (active) setState({ signature, attempt, result: null, error: true });
    });
    // Late responses cannot repopulate a selection after removal, navigation or retry.
    return () => { active = false; controller.abort(); window.clearTimeout(timeout); };
  }, [signature, attempt]);

  useEffect(() => {
    const refresh = () => { if (document.visibilityState === "visible") retry(); };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [retry]);

  const current = state?.signature === signature && state.attempt === attempt;
  // Removing a row can reuse the current facts for the remaining rows while
  // their lookup completes. A retry/focus refresh still clears stale facts.
  const previousIds = state?.signature.split("|") ?? [];
  const removalOnly = state?.attempt === attempt && state.result && signature.split("|").every((id) => previousIds.includes(id));
  const previous = removalOnly ? {
    products: signature.split("|").flatMap((id) => state.result!.products.filter((p) => p.id === id)),
    missingIds: state.result!.missingIds.filter((id) => signature.split("|").includes(id)),
  } : null;
  const result = !signature ? EMPTY : current ? state.result : useInitial ? initial! : previous;
  const error = Boolean(signature && current && state.error);
  return { result, error, loading: Boolean(signature && !result && !error), retry };
}
