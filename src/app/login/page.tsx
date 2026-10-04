import Image from "next/image";
import { redirect } from "next/navigation";
import { auth, googleSignInConfigured } from "@/auth";
import { safeReturnTo } from "@/lib/auth-navigation";
import { GoogleSignIn } from "@/components/google-sign-in";

export default async function Login({ searchParams }: { searchParams: Promise<{ callbackUrl?: string; error?: string }> }) {
  const params = await searchParams;
  const returnTo = safeReturnTo(params.callbackUrl);
  if (process.env.AUTH_SECRET && (await auth())?.user?.id) redirect(returnTo);
  const configured = googleSignInConfigured();
  return <main className="login-screen">
    <section className="login-card" aria-labelledby="login-title">
      <Image src="/images/healthmate-avatar.png" alt="Milo, your HealthMate companion" width={180} height={180} priority />
      <h1 id="login-title">Welcome to HealthMate</h1>
      <p>A little clarity. A little care.</p>
      <GoogleSignIn configured={configured} returnTo={returnTo} />
      {params.error && <p className="milo-error" role="alert">Google sign-in wasn&apos;t completed. Please try again.</p>}
      {!configured && <p className="login-note">Google sign-in is being set up. Please check back soon.</p>}
    </section>
  </main>;
}
