export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <nav aria-label="Progress">
      <p className="text-sm text-muted">Step {current + 1} of {steps.length}: <span className="font-semibold text-ink">{steps[current]}</span></p>
      <ol className="mt-3 flex gap-1.5">
        {steps.map((s, i) => (
          <li key={s} aria-current={i === current ? "step" : undefined} className={`h-1.5 flex-1 rounded-full ${i <= current ? "bg-brand" : "bg-line"}`}><span className="sr-only">{s}{i < current ? " (done)" : ""}</span></li>
        ))}
      </ol>
    </nav>
  );
}
