import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button, Input, Label } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { dashboardFor } from "./LoginPage";

const schema = z.object({
  role: z.enum(["BRAND", "CREATOR"]),
  name: z.string().min(2, "At least 2 characters"),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "At least 8 characters"),
});
type Form = z.infer<typeof schema>;

export default function RegisterPage() {
  const { register: signUp } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [error, setError] = useState("");
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { role: params.get("role") === "creator" ? "CREATOR" : "BRAND" },
  });
  const role = watch("role");

  const submit = handleSubmit(async (d) => {
    setError("");
    try { const u = await signUp(d); nav(u.role === "CREATOR" ? "/dashboard/creator/onboarding" : dashboardFor(u.role), { replace: true }); }
    catch (e) { setError((e as Error).message); }
  });

  return (
    <div className="mx-auto max-w-md px-5 py-16">
      <h1 className="text-3xl font-bold">Create your account</h1>
      <form onSubmit={submit} className="mt-8 space-y-5" noValidate>
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium">I want to</legend>
          <div className="grid grid-cols-2 gap-3">
            {([["BRAND", "Join as a brand", "Hire creators"], ["CREATOR", "Join as a creator", "Get hired"]] as const).map(([v, t, s]) => (
              <label key={v} className={`cursor-pointer rounded-xl border p-4 ${role === v ? "border-brand bg-brand-soft" : "border-line"}`}>
                <input type="radio" value={v} className="sr-only" {...register("role")} />
                <span className="block font-semibold">{t}</span><span className="text-sm text-muted">{s}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div><Label htmlFor="name" error={errors.name?.message}>{role === "BRAND" ? "Company name" : "Display name"}</Label><Input id="name" {...register("name")} /></div>
        <div><Label htmlFor="email" error={errors.email?.message}>Email</Label><Input id="email" type="email" autoComplete="email" {...register("email")} /></div>
        <div><Label htmlFor="password" error={errors.password?.message}>Password</Label><Input id="password" type="password" autoComplete="new-password" {...register("password")} /></div>
        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <Button type="submit" variant="brand" className="w-full" loading={isSubmitting}>Create account</Button>
      </form>
      <p className="mt-6 text-sm text-muted">Already have an account? <Link to="/login" className="font-semibold text-brand">Log in</Link></p>
    </div>
  );
}
