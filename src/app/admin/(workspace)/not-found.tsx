import Link from "next/link";

export default function AdminNotFound() {
  return <div className="space-y-3">
    <h1 className="text-xl font-semibold">გვერდი ვერ მოიძებნა</h1>
    <Link href="/admin/catalog" className="text-accent underline">კატალოგზე დაბრუნება</Link>
  </div>;
}
