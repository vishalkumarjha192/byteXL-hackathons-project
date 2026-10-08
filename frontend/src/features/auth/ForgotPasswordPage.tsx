import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "react-router-dom";
import { Button, Input, Label } from "@/components/ui";
import { api } from "@/lib/api";

const schema = z.object({ email: z.string().email("Enter a valid email") });

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<{ email: string }>({ resolver: zodResolver(schema) });
  const submit = handleSubmit(async (d) => {
    setError("");
    try { await api("/auth/forgot-password", { method: "POST", body: d }); setSent(true); } catch (e) { setError((e as Error).message); }
  });
  return (
    <div className="mx-auto max-w-md px-5 py-16">
      <h1 className="text-3xl font-bold">Reset your password</h1>
      {sent ? (
        <div role="status" className="mt-8 rounded-xl border border-line bg-mist p-5 text-sm">
          <p className="font-semibold">Check your email</p>
          <p className="mt-1 text-muted">If that address has an account, we have sent a link to choose a new password. It works for 30 minutes.</p>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="mt-8 space-y-5">
          <p className="text-sm text-muted">Enter your email and we will send you a link to choose a new password.</p>
          <div><Label htmlFor="email" error={errors.email?.message}>Email</Label><Input id="email" type="email" autoComplete="email" {...register("email")} /></div>
          {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <Button type="submit" className="w-full" loading={isSubmitting}>Send reset link</Button>
        </form>
      )}
      <p className="mt-6 text-sm text-muted"><Link to="/login" className="font-semibold text-brand">Back to log in</Link></p>
    </div>
  );
}
