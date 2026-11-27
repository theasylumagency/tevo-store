import { connection } from "next/server";
import { cacheLife, cacheTag } from "next/cache";
import { confirmedSales } from "./sales";
import { activatePermanentHome, readHomePublication } from "./service";

export async function getHomePublication() {
  "use cache";
  cacheLife("hours");
  cacheTag("homepage");
  return readHomePublication();
}

export async function getActivatedHomePublication(scheduleStart: string) {
  "use cache";
  // The start identifies this due release in the cache key. A newly scheduled future
  // release has a different start, including when it races an older public request.
  void scheduleStart;
  cacheLife("hours");
  cacheTag("homepage", "catalog");
  return activatePermanentHome();
}

export async function getTopSellers() {
  "use cache";
  cacheLife("minutes");
  cacheTag("home-sales");
  return confirmedSales();
}

export async function requestTime() {
  await connection();
  return Date.now();
}
