import { useSearchParams } from "react-router-dom";
import { AuditTab, BrandsTab, CategoriesTab, CreatorsTab, OverviewTab, PaymentsTab, ProjectsTab, ReportsTab, UsersTab } from "./tabs";

const TABS = [["overview", "Overview"], ["users", "Users"], ["creators", "Creators"], ["brands", "Brands"], ["projects", "Projects"], ["payments", "Payments"], ["reports", "Reports"], ["categories", "Categories"], ["audit", "Audit log"]] as const;

export default function AdminPage() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.some(([k]) => k === params.get("tab")) ? params.get("tab")! : "overview";
  const go = (t: string) => setParams({ tab: t });
  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <h1 className="text-3xl font-bold">Admin</h1>
      <div role="tablist" aria-label="Admin sections" className="mt-6 flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => go(k)}
            className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium ${tab === k ? "border-brand text-brand" : "border-transparent text-muted hover:text-ink"}`}>{label}</button>
        ))}
      </div>
      <div role="tabpanel" className="mt-6">
        {tab === "overview" && <OverviewTab go={go} />}
        {tab === "users" && <UsersTab />}
        {tab === "creators" && <CreatorsTab />}
        {tab === "brands" && <BrandsTab />}
        {tab === "projects" && <ProjectsTab />}
        {tab === "payments" && <PaymentsTab />}
        {tab === "reports" && <ReportsTab />}
        {tab === "categories" && <CategoriesTab />}
        {tab === "audit" && <AuditTab />}
      </div>
    </div>
  );
}
