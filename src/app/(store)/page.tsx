import { Suspense } from "react";
import { HomeContent } from "@/components/homepage/HomeContent";
import { getHomePublication, requestTime } from "@/lib/homepage/cache";
import { effectiveHome, inWindow } from "@/lib/homepage/model";

async function PublishedHome() {
  const publication = await getHomePublication();
  const live = publication.published;
  // Only timed displays consult the request clock. The catalog and rendered blocks stay cached.
  const timed = publication.schedule || (live.layouts[live.preset].includes("offer") && (live.offer.start || live.offer.end));
  const now = timed ? await requestTime() : 0;
  const doc = effectiveHome(publication, now);
  return <HomeContent doc={doc} offerOpen={inWindow(doc.offer.start, doc.offer.end, now)}/>;
}
export default function Home() {
  return <Suspense><PublishedHome/></Suspense>;
}
