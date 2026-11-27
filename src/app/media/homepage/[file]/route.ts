import { readHomePhoto } from "@/lib/homepage/media";

export async function GET(_request: Request, { params }: RouteContext<"/media/homepage/[file]">) {
  const bytes = await readHomePhoto((await params).file);
  if (!bytes) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(bytes), { headers: {
    "Content-Type": "image/webp", "Cache-Control": "public, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
  } });
}
