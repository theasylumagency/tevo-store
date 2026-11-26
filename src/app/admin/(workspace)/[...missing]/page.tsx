import { Suspense } from "react";
import { connection } from "next/server";
import { notFound } from "next/navigation";

async function UnknownRoute() {
  await connection();
  return notFound();
}

export default function MissingAdminPage() {
  return <Suspense><UnknownRoute /></Suspense>;
}
