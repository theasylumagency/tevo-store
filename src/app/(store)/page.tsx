import { Suspense } from "react";
import { HomeContent } from "@/components/homepage/HomeContent";
import { getActivatedHomePublication, getHomePublication, requestTime } from "@/lib/homepage/cache";
import { inWindow, localTime } from "@/lib/homepage/model";
import { resolveHomePublication } from "@/lib/homepage/runtime";
import { getCatalog } from "@/lib/catalog";
import { StorefrontLoading } from "@/components/storefront/StorefrontLoading";

async function PublishedHome() {
  let publication = await getHomePublication();
  const live = publication.published;
  // Only timed displays consult the request clock. The catalog and rendered blocks stay cached.
  const timed = publication.schedule || (live.layouts[live.preset].includes("offer") && (live.offer.start || live.offer.end));
  const now = timed ? await requestTime() : 0;
  if (publication.schedule && !publication.schedule.end && localTime(publication.schedule.start) <= now) {
    publication = await getActivatedHomePublication(publication.schedule.start);
  }
  const doc = publication.schedule
    ? resolveHomePublication(publication, await getCatalog(), now).document
    : publication.published;
  return <HomeContent doc={doc} offerOpen={inWindow(doc.offer.start, doc.offer.end, now)}/>;
}
export default function Home() {
  return <Suspense fallback={<StorefrontLoading />}><PublishedHome/></Suspense>;
}
