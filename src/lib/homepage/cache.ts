import { connection } from "next/server";
import { cacheLife, cacheTag } from "next/cache";
import { confirmedSales } from "./sales";
import { readHomePublication } from "./service";

export async function getHomePublication() {
  "use cache";
  cacheLife("hours");
  cacheTag("homepage");
  return readHomePublication();
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
