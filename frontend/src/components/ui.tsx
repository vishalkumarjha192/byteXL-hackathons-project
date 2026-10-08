import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { Link, type LinkProps } from "react-router-dom";
import { BadgeCheck, Loader2 } from "lucide-react";
import { initials } from "@/lib/format";

const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(" ");
const variants = {
  primary: "bg-ink text-white hover:bg-black",
  brand: "bg-brand text-white hover:bg-brand-dark",
  outline: "border border-line bg-white text-ink hover:bg-mist",
  ghost: "text-ink hover:bg-mist",
};
const base = "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 disabled:pointer-events-none";

export function Button({ variant = "primary", loading, className, children, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof variants; loading?: boolean }) {
  return (
    <button className={cx(base, variants[variant], className)} disabled={loading || p.disabled} {...p}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}
export function LinkButton({ variant = "primary", className, ...p }: LinkProps & { variant?: keyof typeof variants }) {
  return <Link className={cx(base, variants[variant], className)} {...p} />;
}

const field = "w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm placeholder:text-muted/70 focus:border-brand";
export const Label = ({ children, htmlFor, error }: { children: ReactNode; htmlFor?: string; error?: string }) => (
  <div className="mb-1.5 flex items-baseline justify-between">
    <label htmlFor={htmlFor} className="text-sm font-medium">{children}</label>
    {error && <span role="alert" className="text-xs text-red-600">{error}</span>}
  </div>
);
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...p }, ref) => (
  <input ref={ref} className={cx(field, className)} {...p} />
));
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...p }, ref) => (
  <textarea ref={ref} rows={4} className={cx(field, className)} {...p} />
));
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(({ className, ...p }, ref) => (
  <select ref={ref} className={cx(field, className)} {...p} />
));

export const Badge = ({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "brand" }) => (
  <span className={cx("inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium", tone === "brand" ? "bg-brand-soft text-brand" : "bg-mist text-muted")}>{children}</span>
);

export const VerifiedBadge = () => <BadgeCheck className="h-4 w-4 text-brand" aria-label="Verified creator" />;

export function Avatar({ name, src, size = 44 }: { name: string; src?: string | null; size?: number }) {
  return src ? (
    <img src={src} alt="" width={size} height={size} className="rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <span aria-hidden className="flex items-center justify-center rounded-full bg-brand-soft font-display font-bold text-brand" style={{ width: size, height: size, fontSize: size / 2.6 }}>
      {initials(name)}
    </span>
  );
}

export const Card = ({ children, className, hidden }: { children: ReactNode; className?: string; hidden?: boolean }) => (
  <div hidden={hidden} className={cx("rounded-xl border border-line bg-white", className)}>{children}</div>
);

export const Skeleton = ({ className }: { className?: string }) => <div className={cx("animate-pulse rounded-lg bg-mist", className)} />;

export function EmptyState({ title, hint, action }: { title: string; hint: string; action?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line px-6 py-14 text-center">
      <h3 className="text-lg font-bold">{title}</h3>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted">{hint}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export const ErrorState = ({ message, onRetry }: { message: string; onRetry?: () => void }) => (
  <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-6 py-8 text-center">
    <p className="font-semibold text-red-800">Could not load this page</p>
    <p className="mt-1 text-sm text-red-700">{message}</p>
    {onRetry && <Button variant="outline" className="mt-4" onClick={onRetry}>Try again</Button>}
  </div>
);

export const Pagination = ({ page, total, pageSize, onChange }: { page: number; total: number; pageSize: number; onChange: (p: number) => void }) => {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <nav className="mt-8 flex items-center justify-between" aria-label="Pagination">
      <Button variant="outline" disabled={page <= 1} onClick={() => onChange(page - 1)}>Previous</Button>
      <span className="text-sm text-muted">Page {page} of {pages}</span>
      <Button variant="outline" disabled={page >= pages} onClick={() => onChange(page + 1)}>Next</Button>
    </nav>
  );
};

const STATUS: Record<string, string> = {
  OPEN: "Open", IN_PROGRESS: "In progress", DRAFT_SUBMITTED: "Draft submitted", REVISION_REQUESTED: "Revision requested",
  FINAL_SUBMITTED: "Final submitted", APPROVED: "Approved", COMPLETED: "Completed", CANCELLED: "Cancelled",
  PENDING: "Pending", ACCEPTED: "Accepted", REJECTED: "Rejected", WITHDRAWN: "Withdrawn",
  HELD: "Held in escrow", RELEASED: "Released", REFUNDED: "Refunded",
};
const GOOD = ["OPEN", "ACCEPTED", "APPROVED", "COMPLETED", "RELEASED"];
export const StatusBadge = ({ status }: { status: string }) => (
  <Badge tone={GOOD.includes(status) ? "brand" : "neutral"}>{STATUS[status] ?? status}</Badge>
);

import { Star } from "lucide-react";
export const Stars = ({ value, size = 16 }: { value: number; size?: number }) => (
  <span className="inline-flex items-center gap-0.5" role="img" aria-label={`${value} out of 5 stars`}>
    {[1, 2, 3, 4, 5].map((i) => <Star key={i} width={size} height={size} className={i <= Math.round(value) ? "fill-amber-400 text-amber-400" : "text-line"} aria-hidden />)}
  </span>
);
