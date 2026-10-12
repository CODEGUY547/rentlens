"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, CheckCircle2, Eye, EyeOff, MessageCircle, ReceiptText } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: "", businessName: "", email: "", password: "" });

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const supabase = createClient();
    if (!supabase) {
      toast.info("Supabase is not connected yet. Opening the safe preview.");
      router.push("/dashboard?demo=1");
      return;
    }
    setLoading(true);
    const result = mode === "signin"
      ? await supabase.auth.signInWithPassword({ email: form.email, password: form.password })
      : await supabase.auth.signUp({
          email: form.email,
          password: form.password,
          options: { data: { full_name: form.name, business_name: form.businessName }, emailRedirectTo: `${location.origin}/auth/callback` },
        });
    setLoading(false);
    if (result.error) return toast.error(result.error.message);
    if (mode === "signup" && !result.data.session) {
      toast.success("Account created. Check your email to confirm it.");
      setMode("signin");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="auth-page">
      <section className="auth-story">
        <div className="brand brand-light"><span className="brand-mark"><Building2 /></span><span>RentLens<small>RENT & TENANT MANAGER</small></span></div>
        <div className="auth-copy">
          <span className="eyebrow light">THE CALM WAY TO COLLECT RENT</span>
          <h1>Your rent records.<br />Ready when<br /><em>you are.</em></h1>
          <p>Know who has paid, follow up with care, and send professional receipts without chasing paperwork.</p>
          <div className="auth-benefits">
            <span><CheckCircle2 /> Live tenant balances</span>
            <span><MessageCircle /> Thoughtful WhatsApp reminders</span>
            <span><ReceiptText /> Instant numbered receipts</span>
          </div>
        </div>
        <p className="auth-quote">“Good records build good landlord–tenant relationships.”</p>
      </section>

      <section className="auth-form-wrap">
        <form className="auth-form" onSubmit={submit}>
          <div className="mobile-brand brand"><span className="brand-mark"><Building2 /></span><span>RentLens<small>RENT & TENANT MANAGER</small></span></div>
          <span className="eyebrow">LANDLORD PORTAL</span>
          <h2>{mode === "signin" ? "Welcome back" : "Set up your rent desk"}</h2>
          <p>{mode === "signin" ? "Continue with today’s collections, promises and receipts." : "Create your workspace. Your first tenant can be added in under a minute."}</p>
          {mode === "signup" && (
            <>
              <label>Full name<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Your full name" /></label>
              <label>Rental business name<input required value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} placeholder="e.g. Elias Estates" /></label>
            </>
          )}
          <label>Email address<input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" /></label>
          <label>Password
            <span className="password-field">
              <input type={showPassword ? "text" : "password"} required minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="At least 6 characters" />
              <button type="button" aria-label="Show password" onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff /> : <Eye />}</button>
            </span>
          </label>
          <button className="primary full" disabled={loading}>{loading ? "Please wait…" : mode === "signin" ? "Open my rent desk" : "Create my workspace"}</button>
          <p className="auth-switch">{mode === "signin" ? "New to RentLens?" : "Already have an account?"} <button type="button" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>{mode === "signin" ? "Create account" : "Sign in"}</button></p>
          <button className="demo-link" type="button" onClick={() => router.push("/dashboard?demo=1")}>Preview with sample data →</button>
        </form>
      </section>
    </main>
  );
}
