import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useSearchParams } from "react-router-dom";
import { Button, Input, Label, LinkButton } from "@/components/ui";
import { api } from "@/lib/api";

const schema = z.object({ password: z.string().min(8, "At least 8 characters"), confirm: z.string() }).refine((d) => d.password === d.confirm, { path: ["confirm"], message: "Passwords do not match" });
type Form = z.infer<typeof schema>;

export default function ResetPasswordPage() {
  const token = useSearchParams()[0].get("token");
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({ resolver: zodResolver(schema) });
  const submit = handleSubmit(async (d) => {
    setError("");
    try { await api("/auth/reset-password", { method: "POST", body: { token, password: d.password } }); setDone(true); } catch (e) { setError((e as Error).message); }
  });

  if (!token) return <div className="mx-auto max-w-md px-5 py-16"><h1 className="text-3xl font-bold">Link not valid</h1><p className="mt-3 text-muted">This reset link is missing its code. <Link to="/forgot-password" className="font-semibold text-brand">Request a new one</Link>.</p></div>;
  return (
    <div className="mx-auto max-w-md px-5 py-16">
      <h1 className="text-3xl font-bold">Choose a new password</h1>
      {done ? (
        <div role="status" className="mt-8"><p className="rounded-xl bg-mist p-5 text-sm">Your password was updated. You can log in with it now.</p><LinkButton to="/login" variant="brand" className="mt-4">Log in</LinkButton></div>
      ) : (
        <form onSubmit={submit} noValidate className="mt-8 space-y-5">
          <div><Label htmlFor="password" error={errors.password?.message}>New password</Label><Input id="password" type="password" autoComplete="new-password" {...register("password")} /></div>
          <div><Label htmlFor="confirm" error={errors.confirm?.message}>Confirm password</Label><Input id="confirm" type="password" autoComplete="new-password" {...register("confirm")} /></div>
          {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error} <Link to="/forgot-password" className="font-semibold underline">Request a new link</Link></p>}
          <Button type="submit" variant="brand" className="w-full" loading={isSubmitting}>Update password</Button>
        </form>
      )}
    </div>
  );
}
