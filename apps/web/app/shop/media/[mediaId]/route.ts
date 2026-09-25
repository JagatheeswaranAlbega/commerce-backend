import { NextResponse } from "next/server"

import { getStorefrontPublishableKey } from "@/lib/api"

export async function GET(
  _request: Request,
  context: { params: Promise<{ mediaId: string }> }
) {
  const { mediaId } = await context.params
  const baseUrl = process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/$/, "")
  const key = getStorefrontPublishableKey()

  if (!baseUrl || !key || !mediaId) {
    return new NextResponse("Media is not configured.", { status: 404 })
  }

  const upstream = await fetch(
    `${baseUrl}/api/v1/store/media/${encodeURIComponent(mediaId)}`,
    {
      headers: { "x-publishable-key": key },
      cache: "force-cache",
    }
  )

  if (!upstream.ok) {
    return new NextResponse("Media not found.", { status: upstream.status })
  }

  const body = await upstream.arrayBuffer()
  return new NextResponse(body, {
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") ?? "image/jpeg",
      "Cache-Control": "public, max-age=3600",
    },
  })
}
