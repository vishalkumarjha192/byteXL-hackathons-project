import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button, Input, Label } from "@/components/ui";
import { useAuth } from "@/lib/auth";

const schema = z.object({ email: z.string().email("Enter a valid email"), password: z.string().min(1, "Enter your password") });
type Form = z.infer<typeof schema>;

export const dashboardFor = (role: string) => (role === "BRAND" ? "/dashboard/brand" : role === "CREATOR" ? "/dashboard/creator" : role === "ADMIN" ? "/dashboard/admin" : "/");

export default function LoginPage() {
  const { login } = useAuth();
  const nav = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from;
  const [error, setError] = useState("");
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({ resolver: zodResolver(schema) });

  const submit = handleSubmit(async (d) => {
    setError("");
    try { const u = await login(d.email, d.password); nav(from ?? dashboardFor(u.role), { replace: true }); }
    catch (e) { setError((e as Error).message); }
  });

  return (
    <div className="mx-auto max-w-md px-5 py-16">
      <h1 className="text-3xl font-bold">Log in</h1>
      <form onSubmit={submit} className="mt-8 space-y-5" noValidate>
        <div><Label htmlFor="email" error={errors.email?.message}>Email</Label><Input id="email" type="email" autoComplete="email" {...register("email")} /></div>
        <div><Label htmlFor="password" error={errors.password?.message}>Password</Label><Input id="password" type="password" autoComplete="current-password" {...register("password")} /><Link to="/forgot-password" className="mt-1.5 inline-block text-sm font-medium text-brand">Forgot your password?</Link></div>
        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <Button type="submit" className="w-full" loading={isSubmitting}>Log in</Button>
        <Button type="button" variant="outline" className="w-full" disabled aria-describedby="g-note">Continue with Google</Button>
        <p id="g-note" className="-mt-2 text-center text-xs text-muted">Google sign-in is not enabled yet.</p>
      </form>
      <p className="mt-6 text-sm text-muted">New here? <Link to="/register" className="font-semibold text-brand">Create an account</Link></p>
    </div>
  );
}
