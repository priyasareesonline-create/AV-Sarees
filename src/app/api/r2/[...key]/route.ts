import { getAwsClient, objectUrlForPublicRead } from "@/lib/s3";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Only product/category uploads — never expose arbitrary bucket paths. */
function sanitizePublicUploadKey(parts: string[]): string | null {
  if (!parts.length) return null;
  const key = parts
    .map((p) => {
      try {
        return decodeURIComponent(p);
      } catch {
        return p;
      }
    })
    .join("/");
  if (!key.startsWith("uploads/")) return null;
  if (key.includes("..") || key.includes("\\") || key.includes("\0")) {
    return null;
  }
  // nanoid / upload keys: letters, digits, _ . - and nested /
  if (!/^uploads\/[A-Za-z0-9._\-/]+$/.test(key)) return null;
  return key;
}

async function serveUpload(keyParts: string[]) {
  const key = sanitizePublicUploadKey(keyParts);
  if (!key) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const res = await getAwsClient().fetch(objectUrlForPublicRead(key), {
    method: "GET",
  });

  if (!res.ok || !res.body) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const contentType =
    res.headers.get("content-type") || "application/octet-stream";
  const contentLength = res.headers.get("content-length");
  const headers = new Headers({
    "Content-Type": contentType,
    "Cache-Control": "public, max-age=31536000, immutable",
  });
  if (contentLength) headers.set("Content-Length", contentLength);

  return new NextResponse(res.body, { status: 200, headers });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ key: string[] }> },
) {
  const { key } = await context.params;
  return serveUpload(key);
}

export async function HEAD(
  _request: Request,
  context: { params: Promise<{ key: string[] }> },
) {
  const { key } = await context.params;
  const response = await serveUpload(key);
  return new NextResponse(null, {
    status: response.status,
    headers: response.headers,
  });
}
