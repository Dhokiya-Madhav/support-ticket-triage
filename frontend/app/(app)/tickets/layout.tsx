import { RoleGuard } from "@/components/layout/role-guard";

export default function CustomerLayout({ children }: LayoutProps<"/tickets">) {
  return <RoleGuard roles={["customer"]}>{children}</RoleGuard>;
}
