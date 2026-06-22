"use client"

import { Suspense, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { googleOAuthCallbackAction } from "@/app/_actions/auth"
import { Loader2 } from "lucide-react"

function OAuthCallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const accessToken = searchParams.get("access_token")
    const refreshToken = searchParams.get("refresh_token")

    if (!accessToken || !refreshToken) {
      router.replace("/login?error=oauth_failed")
      return
    }

    const formData = new FormData()
    formData.set("access_token", accessToken)
    formData.set("refresh_token", refreshToken)
    googleOAuthCallbackAction(null, formData)
  }, [])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3">
      <Loader2 size={28} className="animate-spin text-[#2563EB]" />
      <p className="text-sm text-[#64748B]">Completing sign in…</p>
    </div>
  )
}

export default function OAuthCallbackPage() {
  return <Suspense><OAuthCallbackContent /></Suspense>
}
