import Link from "next/link";
import { t } from "@/i18n";

export default function NotFound() {
  return (
    <div className="py-20 text-center">
      <h1 className="text-2xl font-bold">{t("notfound.title")}</h1>
      <Link href="/" className="mt-4 inline-block text-accent">{t("notfound.back")}</Link>
    </div>
  );
}
