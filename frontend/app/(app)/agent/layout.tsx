import { RoleGuard } from "@/components/layout/role-guard";

// Managers can open individual tickets here too (linked from their all-tickets view).
export default function AgentLayout({ children }: LayoutProps<"/agent">) {
  return <RoleGuard roles={["agent", "manager"]}>{children}</RoleGuard>;
}
