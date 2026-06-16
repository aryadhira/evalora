"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function login(formData: FormData) {
  const payload = {
    email:    formData.get("email") as string,
    password: formData.get("password") as string,
  };

  // Validate with Zod before hitting API
  const parsed = LoginSchema.safeParse(payload);
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const response = await fetch(`${process.env.API_URL}/api/v1/auth/login`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(parsed.data),
    // credentials not needed server-to-server; Go sets Set-Cookie in response
  });

  if (!response.ok) {
    const error = await response.json();
    return { error: error.error.message };
  }

  // Forward Set-Cookie headers from Go to the browser
  response.headers.getSetCookie().forEach(cookie => {
    // Parse and forward via Next.js cookies() API
    cookies().set(parseCookieString(cookie));
  });

  const data = await response.json();
  if (data.requires_2fa) redirect("/auth/2fa-challenge");

  redirect("/dashboard");
}