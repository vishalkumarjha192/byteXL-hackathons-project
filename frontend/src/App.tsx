import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { RequireRole } from "@/components/Guard";
import { EmptyState, LinkButton, Skeleton } from "@/components/ui";
import Landing from "@/pages/Landing";
import { About, HowItWorks, Pricing } from "@/pages/Info";

const CreatorsPage = lazy(() => import("@/features/creators/CreatorsPage"));
const CreatorProfilePage = lazy(() => import("@/features/creators/CreatorProfilePage"));
const ProfileEditorPage = lazy(() => import("@/features/creators/ProfileEditorPage"));
const JobsPage = lazy(() => import("@/features/jobs/JobsPage"));
const JobDetailPage = lazy(() => import("@/features/jobs/JobDetailPage"));
const NewProjectPage = lazy(() => import("@/features/jobs/NewProjectPage"));
const BrandDashboard = lazy(() => import("@/features/projects/BrandDashboard"));
const CreatorDashboard = lazy(() => import("@/features/projects/CreatorDashboard"));
const ApplicationsPage = lazy(() => import("@/features/projects/ApplicationsPage"));
const WorkspacePage = lazy(() => import("@/features/projects/WorkspacePage"));
const NotificationsPage = lazy(() => import("@/features/comms/NotificationsPage"));
const PaymentsPage = lazy(() => import("@/features/payments/PaymentsPage"));
const BrandProfilePage = lazy(() => import("@/features/projects/BrandProfilePage"));
const AdminPage = lazy(() => import("@/features/admin/AdminPage"));
const OnboardingPage = lazy(() => import("@/features/creators/OnboardingPage"));
const ForgotPasswordPage = lazy(() => import("@/features/auth/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("@/features/auth/ResetPasswordPage"));
const LoginPage = lazy(() => import("@/features/auth/LoginPage"));
const RegisterPage = lazy(() => import("@/features/auth/RegisterPage"));

const NotFound = () => (
  <div className="mx-auto max-w-xl px-5 py-20"><EmptyState title="Page not found" hint="The page you are looking for does not exist." action={<LinkButton to="/">Go home</LinkButton>} /></div>
);

export default function App() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-3xl p-10"><Skeleton className="h-64" /></div>}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Landing />} />
          <Route path="creators" element={<CreatorsPage />} />
          <Route path="creators/:id" element={<CreatorProfilePage />} />
          <Route path="jobs" element={<JobsPage />} />
          <Route path="jobs/:id" element={<JobDetailPage />} />
          <Route path="how-it-works" element={<HowItWorks />} />
          <Route path="pricing" element={<Pricing />} />
          <Route path="about" element={<About />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
          <Route path="forgot-password" element={<ForgotPasswordPage />} />
          <Route path="reset-password" element={<ResetPasswordPage />} />
          <Route element={<RequireRole role="CREATOR" />}>
            <Route path="dashboard/creator" element={<CreatorDashboard />} />
            <Route path="dashboard/creator/onboarding" element={<OnboardingPage />} />
            <Route path="dashboard/creator/profile" element={<ProfileEditorPage />} />
          </Route>
          <Route element={<RequireRole role="BRAND" />}>
            <Route path="dashboard/brand" element={<BrandDashboard />} />
            <Route path="dashboard/brand/profile" element={<BrandProfilePage />} />
            <Route path="dashboard/brand/projects/new" element={<NewProjectPage />} />
            <Route path="dashboard/brand/projects/:id/applications" element={<ApplicationsPage />} />
          </Route>
          <Route element={<RequireRole role="ADMIN" />}>
            <Route path="dashboard/admin" element={<AdminPage />} />
          </Route>
          <Route element={<RequireRole />}>
            <Route path="projects/:id/workspace" element={<WorkspacePage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="dashboard/payments" element={<PaymentsPage />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
