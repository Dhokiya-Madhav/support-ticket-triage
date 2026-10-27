"use client";

import {
  Inbox,
  LayoutDashboard,
  ListChecks,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  PlusCircle,
  Ticket,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { Badge, DropdownMenu, PageSpinner, ThemeToggle } from "@/components/ui";
import { homeFor, useAuth } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { titleCase } from "@/lib/format";
import type { Role, User } from "@/lib/types";
import { useLocalStorage } from "@/lib/use-local-storage";
import { Brand } from "./brand";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Also highlighted for nested routes such as /agent/12. */
  prefix?: boolean;
}

const NAV: Record<Role, NavItem[]> = {
  customer: [
    { href: "/tickets", label: "My requests", icon: Ticket, prefix: true },
    { href: "/tickets/new", label: "New request", icon: PlusCircle },
  ],
  agent: [{ href: "/agent", label: "Ticket queue", icon: Inbox, prefix: true }],
  manager: [
    { href: "/manager", label: "Dashboard", icon: LayoutDashboard },
    { href: "/manager/tickets", label: "All tickets", icon: ListChecks, prefix: true },
    { href: "/manager/agents", label: "Agents", icon: Users, prefix: true },
  ],
};

function isActive(item: NavItem, pathname: string, items: NavItem[]) {
  if (pathname === item.href) return true;
  if (!item.prefix || !pathname.startsWith(`${item.href}/`)) return false;
  // Don't highlight "My requests" while on the longer "New request" route.
  return !items.some(
    (other) =>
      other !== item && pathname.startsWith(other.href) && other.href.length > item.href.length,
  );
}

function Avatar({ name }: { name: string }) {
  return (
    <span
      aria-hidden
      className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

function AccountMenu({
  user,
  onSignOut,
  variant,
}: {
  user: User;
  onSignOut: () => void;
  /** "sidebar": full-width row (or just the avatar when collapsed) opening upward. */
  variant: "sidebar" | "compact" | "sidebar-collapsed";
}) {
  const header = (
    <div>
      <p className="truncate text-sm font-medium text-foreground">{user.name}</p>
      <p className="truncate text-xs text-muted">{user.email}</p>
      <Badge tone="info" className="mt-1.5">
        {titleCase(user.role)}
      </Badge>
    </div>
  );
  const items = [{ label: "Sign out", icon: <LogOut className="size-4" />, onSelect: onSignOut }];

  if (variant === "compact") {
    return (
      <DropdownMenu
        label="Account menu"
        header={header}
        items={items}
        trigger={<Avatar name={user.name} />}
      />
    );
  }

  const collapsed = variant === "sidebar-collapsed";
  return (
    <DropdownMenu
      label="Account menu"
      header={header}
      items={items}
      align="left"
      direction="up"
      className="w-full"
      triggerClassName={cn("w-full gap-2.5 p-2", collapsed && "justify-center")}
      trigger={
        <>
          <Avatar name={user.name} />
          {!collapsed && (
            <span className="min-w-0 text-left">
              <span className="block truncate text-sm font-medium text-foreground">
                {user.name}
              </span>
              <span className="block truncate text-xs text-muted">{titleCase(user.role)}</span>
            </span>
          )}
        </>
      }
    />
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [collapsedFlag, setCollapsedFlag] = useLocalStorage("sidebar-collapsed", "0");
  const collapsed = collapsedFlag === "1";

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading || !user) return <PageSpinner />;

  const items = NAV[user.role];

  function navLinks(compact: boolean, horizontal: boolean) {
    return (
      <nav aria-label="Main" className={cn("flex gap-1", !horizontal && "flex-col")}>
        {items.map((item) => {
          const active = isActive(item, pathname, items);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={compact ? item.label : undefined}
              aria-label={compact ? item.label : undefined}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
                compact && "justify-center px-0",
                active
                  ? "bg-primary-soft text-primary"
                  : "text-muted hover:bg-surface-muted hover:text-foreground",
              )}
            >
              <item.icon className="size-[18px] shrink-0" aria-hidden />
              {!compact && item.label}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <div className="min-h-screen lg:flex">
      {/* Sidebar: brand, navigation, then theme, profile and collapse. Always in view. */}
      <aside
        className={cn(
          "hidden shrink-0 flex-col border-r border-border bg-surface transition-[width] duration-200 lg:sticky lg:top-0 lg:flex lg:h-screen",
          collapsed ? "w-[4.5rem]" : "w-60",
        )}
      >
        <div className={cn("flex h-14 shrink-0 items-center", collapsed ? "justify-center" : "px-5")}>
          <Brand href={homeFor(user.role)} compact={collapsed} />
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-3">{navLinks(collapsed, false)}</div>
        <div className="flex shrink-0 flex-col gap-1 border-t border-border p-3">
          <ThemeToggle showLabel={!collapsed} fullWidth />
          <AccountMenu
            user={user}
            onSignOut={logout}
            variant={collapsed ? "sidebar-collapsed" : "sidebar"}
          />
          <button
            type="button"
            onClick={() => setCollapsedFlag(collapsed ? "0" : "1")}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cn(
              "flex h-10 w-full items-center gap-2.5 rounded-lg px-3 text-sm font-medium text-muted transition-colors hover:bg-surface-muted hover:text-foreground",
              collapsed && "justify-center px-0",
            )}
          >
            {collapsed ? (
              <PanelLeftOpen className="size-[18px]" aria-hidden />
            ) : (
              <>
                <PanelLeftClose className="size-[18px]" aria-hidden />
                Collapse
              </>
            )}
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Phones and tablets have no sidebar, so they keep a slim top bar with the same controls. */}
        <header className="sticky top-0 z-20 border-b border-border bg-surface/90 backdrop-blur lg:hidden">
          <div className="flex h-14 items-center justify-between gap-4 px-4 sm:px-6">
            <Brand href={homeFor(user.role)} />
            <div className="flex items-center gap-1">
              <ThemeToggle />
              <AccountMenu user={user} onSignOut={logout} variant="compact" />
            </div>
          </div>
          <div className="overflow-x-auto border-t border-border px-4 py-2">
            {navLinks(false, true)}
          </div>
        </header>
        <main className="mx-auto w-full max-w-[96rem] flex-1 px-4 py-6 sm:px-6 sm:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
