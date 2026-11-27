import "server-only";
import { getIndex } from "@/lib/catalog";
import { getAvailableMedia } from "@/lib/media";
import { resolveChoiceProducts } from "./presentation";

export async function getChoiceProducts(ids: unknown) {
  const [{ catalog }, media] = await Promise.all([getIndex(), getAvailableMedia()]);
  return resolveChoiceProducts(ids, catalog, new Set(media));
}
