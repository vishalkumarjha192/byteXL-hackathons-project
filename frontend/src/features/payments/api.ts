import { api } from "@/lib/api";
import type { PaymentsMine, WorkspacePayment } from "@/lib/types";

export const paymentsApi = {
  mine: () => api<PaymentsMine>("/payments/mine"),
  fund: (projectId: string) => api<WorkspacePayment>(`/payments/project/${projectId}/fund`, { method: "POST" }),
  withdraw: (body: { amount: number; currency: string }) => api<{ id: string; available: number }>("/payments/withdraw", { method: "POST", body }),
};
