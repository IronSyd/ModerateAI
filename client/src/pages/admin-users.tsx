import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, getQueryFn, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { FilterBarShell, PageHeroShell, PageSectionCard, StateBlock, TableShell } from "@/components/layout/page-shells";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Ban,
  CheckCircle2,
  Copy,
  KeyRound,
  MoreHorizontal,
  PauseCircle,
  Search,
  ShieldAlert,
  Trash2,
  UserCheck,
  UserX,
} from "lucide-react";

type AdminUserRow = {
  id: number;
  email: string;
  fullName: string;
  role: string;
  isActive: boolean;
  isBanned: boolean;
  bannedAt: string | null;
  banReason: string | null;
  requireTwoFactor: boolean;
  plan: "free" | "standard" | "pro" | string;
  planStatus: "active" | "trialing" | "past_due" | "canceled" | string;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  planSelectedAt: string | null;
  planUpdatedAt: string | null;
  paidThroughAt: string | null;
  billingSuspendedAt: string | null;
  billingSuspendedReason: string | null;
  billingSuspendedBy: number | null;
  workspaceOwnerId: number | null;
  workspaceRole: string | null;
  createdAt: string;
};

type AdminUsersResponse = {
  users: AdminUserRow[];
};

type DestinationUsageItem = {
  active: number;
  inactive: number;
  cap: number | null;
};

type WorkspaceIntegrationRow = {
  ownerUserId: number;
  ownerEmail: string;
  ownerFullName: string;
  role: string;
  plan: "free" | "standard" | "pro" | string;
  planStatus: "active" | "trialing" | "past_due" | "canceled" | string;
  destinationUsage: {
    telegram: DestinationUsageItem;
    discord: DestinationUsageItem;
    website: DestinationUsageItem;
  };
};

type WorkspaceIntegrationsResponse = {
  generatedAt: string;
  workspaces: WorkspaceIntegrationRow[];
};

function formatDate(value: string | null | undefined) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

function formatCap(value: number | null | undefined) {
  if (value == null) return "Unlimited";
  return Number(value).toLocaleString();
}

export default function AdminUsersPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [tempPasswordData, setTempPasswordData] = useState<{
    email: string;
    temporaryPassword: string;
    expiresAt: string | null;
  } | null>(null);

  const isAdmin = user?.role === "admin" || user?.role === "owner";
  const isOwner = user?.role === "owner";

  const { data, isLoading, isFetching, error, refetch } = useQuery<AdminUsersResponse, Error>({
    queryKey: ["/api/admin/users"],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: Boolean(isAdmin),
  });
  const {
    data: workspaceIntegrationsData,
    isLoading: isLoadingWorkspaceIntegrations,
    isFetching: isFetchingWorkspaceIntegrations,
    error: workspaceIntegrationsError,
    refetch: refetchWorkspaceIntegrations,
  } = useQuery<WorkspaceIntegrationsResponse, Error>({
    queryKey: ["/api/admin/workspaces/integrations"],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: Boolean(isAdmin),
  });

  const users = data?.users ?? [];
  const workspaceIntegrations = workspaceIntegrationsData?.workspaces ?? [];

  const canManageTarget = (target: AdminUserRow) => {
    if (!user) return false;
    if (target.id === user.id) return false;
    if (target.role === "owner") return false;
    if (target.role === "admin" && !isOwner) return false;
    return true;
  };

  const canManageBillingTarget = (target: AdminUserRow) => {
    if (!canManageTarget(target)) return false;
    // Billing is workspace-level; only apply it to workspace owners (customers), not their invited members.
    if (target.workspaceOwnerId) return false;
    if (target.role !== "user") return false;
    return true;
  };

  const userActionMutation = useMutation({
    mutationFn: async (action: {
      type:
        | "activate"
        | "deactivate"
        | "ban"
        | "unban"
        | "delete"
        | "suspendBilling"
        | "allowBilling"
        | "activatePlan"
        | "downgradeToFree"
        | "resetTempPassword";
      userId: number;
      reason?: string;
      durationDays?: number;
      plan?: "standard" | "pro";
    }) => {
      if (action.type === "delete") {
        const res = await apiRequest("DELETE", `/api/admin/users/${action.userId}`);
        return await res.json();
      }

      if (action.type === "suspendBilling") {
        const res = await apiRequest("POST", `/api/admin/users/${action.userId}/suspend-billing`, {
          reason: action.reason,
        });
        return await res.json();
      }

      if (action.type === "allowBilling") {
        const res = await apiRequest("POST", `/api/admin/users/${action.userId}/allow-billing`, {
          durationDays: action.durationDays,
        });
        return await res.json();
      }

      if (action.type === "activatePlan") {
        const res = await apiRequest("POST", `/api/admin/users/${action.userId}/activate-plan`, {
          plan: action.plan,
          durationDays: action.durationDays,
        });
        return await res.json();
      }

      if (action.type === "downgradeToFree") {
        const res = await apiRequest("POST", `/api/admin/users/${action.userId}/downgrade-to-free`);
        return await res.json();
      }

      if (action.type === "resetTempPassword") {
        const res = await apiRequest("POST", `/api/admin/users/${action.userId}/reset-temp-password`);
        return await res.json();
      }

      const body = action.type === "ban" && action.reason ? { reason: action.reason } : undefined;
      const res = await apiRequest("POST", `/api/admin/users/${action.userId}/${action.type}`, body);
      return await res.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      if (variables.type === "resetTempPassword") {
        const response = data as any;
        const temporaryPassword = String(response?.temporaryPassword ?? "");
        if (temporaryPassword) {
          setTempPasswordData({
            email: String(response?.email ?? ""),
            temporaryPassword,
            expiresAt: response?.expiresAt ?? null,
          });
        }
      }
      const label =
        variables.type === "activate"
          ? "Activate"
          : variables.type === "deactivate"
            ? "Deactivate"
            : variables.type === "ban"
              ? "Ban"
              : variables.type === "unban"
                ? "Unban"
                : variables.type === "delete"
                  ? "Delete"
                  : variables.type === "suspendBilling"
                    ? "Suspend (Non-payment)"
                    : variables.type === "allowBilling"
                      ? "Allow (Mark Paid)"
                      : variables.type === "activatePlan"
                        ? "Activate plan (Mark Paid)"
                        : variables.type === "downgradeToFree"
                          ? "Downgrade to Free"
                          : variables.type === "resetTempPassword"
                            ? "Reset password (temp)"
                          : variables.type;
      toast({
        title: "Updated",
        description: `${label} applied successfully.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Action failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      return (
        u.email.toLowerCase().includes(q) ||
        u.fullName.toLowerCase().includes(q) ||
        String(u.id).includes(q)
      );
    });
  }, [query, users]);

  const filteredWorkspaceIntegrations = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return workspaceIntegrations;
    return workspaceIntegrations.filter((workspace) => {
      return (
        workspace.ownerEmail.toLowerCase().includes(q) ||
        workspace.ownerFullName.toLowerCase().includes(q) ||
        String(workspace.ownerUserId).includes(q)
      );
    });
  }, [query, workspaceIntegrations]);

  const getUserStatusMeta = (u: AdminUserRow) => {
    if (u.isBanned) {
      return {
        label: "Banned",
        title: u.banReason || "Banned",
        className: "glass-chip border-red-500/30 text-red-300",
      };
    }

    if (!u.isActive) {
      return {
        label: "Deactivated",
        title: "Deactivated",
        className: "glass-chip border-yellow-500/30 text-yellow-200",
      };
    }

    if (u.billingSuspendedAt) {
      return {
        label: "Suspended",
        title: `Billing suspended${u.billingSuspendedReason ? `: ${u.billingSuspendedReason}` : ""}`,
        className: "glass-chip border-orange-500/30 text-orange-200",
      };
    }

    return {
      label: "Active",
      title: "Active",
      className: "glass-chip",
    };
  };

  const renderUserActions = (u: AdminUserRow, mode: "icon" | "button" = "icon") => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={mode === "button" ? "glass-chip w-full justify-between" : "glass-chip"}
        >
          {mode === "button" ? (
            <>
              Actions
              <MoreHorizontal className="h-4 w-4" />
            </>
          ) : (
            <MoreHorizontal className="h-4 w-4" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="glass-surface">
        <DropdownMenuItem
          disabled={userActionMutation.isPending || !canManageTarget(u) || u.isBanned}
          onClick={() => userActionMutation.mutate({ type: u.isActive ? "deactivate" : "activate", userId: u.id })}
        >
          {u.isActive ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
          {u.isActive ? "Deactivate" : "Activate"}
        </DropdownMenuItem>

        <DropdownMenuItem
          disabled={userActionMutation.isPending || !canManageTarget(u)}
          onClick={() => {
            if (u.isBanned) {
              userActionMutation.mutate({ type: "unban", userId: u.id });
              return;
            }

            const confirmed = window.confirm(`Ban ${u.email}? They will be signed out and blocked from logging in.`);
            if (!confirmed) return;
            const reason = window.prompt("Ban reason (optional):") || undefined;
            userActionMutation.mutate({ type: "ban", userId: u.id, reason });
          }}
        >
          <Ban className="h-4 w-4" />
          {u.isBanned ? "Unban" : "Ban"}
        </DropdownMenuItem>

        <DropdownMenuItem
          disabled={userActionMutation.isPending || !canManageTarget(u)}
          onClick={() => {
            const confirmed = window.confirm(
              `Issue a temporary password for ${u.email}? This will invalidate existing sessions and require immediate password change on next login.`,
            );
            if (!confirmed) return;
            userActionMutation.mutate({ type: "resetTempPassword", userId: u.id });
          }}
        >
          <KeyRound className="h-4 w-4" />
          Reset Password (Temp)
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          disabled={userActionMutation.isPending || !canManageBillingTarget(u) || u.isBanned || !u.isActive}
          onClick={() => {
            const raw = window.prompt(
              "Activate Standard for how many days? (Extends from now or the current paid-through date.)",
              "30",
            );
            if (!raw) return;
            const days = Number(raw);
            if (!Number.isFinite(days) || days <= 0) {
              toast({
                title: "Invalid duration",
                description: "Enter a positive number of days (e.g. 30).",
                variant: "destructive",
              });
              return;
            }
            userActionMutation.mutate({
              type: "activatePlan",
              userId: u.id,
              plan: "standard",
              durationDays: Math.floor(days),
            });
          }}
        >
          <ArrowUpCircle className="h-4 w-4" />
          Activate Standard (Mark Paid)
        </DropdownMenuItem>

        <DropdownMenuItem
          disabled={userActionMutation.isPending || !canManageBillingTarget(u) || u.isBanned || !u.isActive}
          onClick={() => {
            const raw = window.prompt(
              "Activate Pro for how many days? (Extends from now or the current paid-through date.)",
              "30",
            );
            if (!raw) return;
            const days = Number(raw);
            if (!Number.isFinite(days) || days <= 0) {
              toast({
                title: "Invalid duration",
                description: "Enter a positive number of days (e.g. 30).",
                variant: "destructive",
              });
              return;
            }
            userActionMutation.mutate({
              type: "activatePlan",
              userId: u.id,
              plan: "pro",
              durationDays: Math.floor(days),
            });
          }}
        >
          <ArrowUpCircle className="h-4 w-4" />
          Activate Pro (Mark Paid)
        </DropdownMenuItem>

        <DropdownMenuItem
          disabled={userActionMutation.isPending || !canManageBillingTarget(u) || u.isBanned || u.plan === "free"}
          onClick={() => {
            const confirmed = window.confirm(
              `Downgrade ${u.email} to Free? This clears paid-through access and removes billing suspension.`,
            );
            if (!confirmed) return;
            userActionMutation.mutate({ type: "downgradeToFree", userId: u.id });
          }}
        >
          <ArrowDownCircle className="h-4 w-4" />
          Downgrade to Free
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          disabled={
            userActionMutation.isPending ||
            !canManageBillingTarget(u) ||
            u.isBanned ||
            !u.isActive ||
            Boolean(u.billingSuspendedAt)
          }
          onClick={() => {
            const confirmed = window.confirm(
              `Suspend billing for ${u.email}? They will be blocked from logging in until you allow billing again.`,
            );
            if (!confirmed) return;
            const reason = window.prompt("Reason (optional):") || undefined;
            userActionMutation.mutate({ type: "suspendBilling", userId: u.id, reason });
          }}
        >
          <PauseCircle className="h-4 w-4" />
          Suspend (Non-payment)
        </DropdownMenuItem>

        <DropdownMenuItem
          disabled={
            userActionMutation.isPending ||
            !canManageBillingTarget(u) ||
            u.isBanned ||
            !u.isActive ||
            u.plan === "free"
          }
          onClick={() => {
            const raw = window.prompt(
              "How many days should this subscription remain active? (Extends from now or the current paid-through date.)",
              "30",
            );
            if (!raw) return;
            const days = Number(raw);
            if (!Number.isFinite(days) || days <= 0) {
              toast({
                title: "Invalid duration",
                description: "Enter a positive number of days (e.g. 30).",
                variant: "destructive",
              });
              return;
            }
            userActionMutation.mutate({
              type: "allowBilling",
              userId: u.id,
              durationDays: Math.floor(days),
            });
          }}
        >
          <CheckCircle2 className="h-4 w-4" />
          Allow (Mark Paid)
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          disabled={userActionMutation.isPending || !canManageTarget(u)}
          onClick={() => {
            const confirmed = window.confirm(
              `Delete ${u.email}? This permanently removes the user and their data. This cannot be undone.`,
            );
            if (!confirmed) return;
            userActionMutation.mutate({ type: "delete", userId: u.id });
          }}
        >
          <Trash2 className="h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  if (!isAdmin) {
    return (
      <StateBlock
        title="Admin Only"
        description="You do not have permission to view this page."
        icon={<ShieldAlert className="h-5 w-5 text-red-500" />}
      />
    );
  }

  return (
    <div className="space-y-6 wave-v2-page wave-v2-admin-users">
      <PageHeroShell>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-semibold text-foreground">User Management</h1>
            <p className="text-sm text-muted-foreground">
              Manage account access, billing state, plans, and workspace destination usage.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="glass-chip">
              {filtered.length} users
            </Badge>
            <Badge variant="outline" className="glass-chip">
              {filteredWorkspaceIntegrations.length} workspaces
            </Badge>
          </div>
        </div>
      </PageHeroShell>

      <Dialog
        open={Boolean(tempPasswordData)}
        onOpenChange={(open) => {
          if (!open) setTempPasswordData(null);
        }}
      >
        <DialogContent className="glass-surface sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Temporary Password Created</DialogTitle>
            <DialogDescription>
              Share this temporary password securely with the user. It is shown once and expires in 60 minutes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              Account: <span className="font-medium text-foreground">{tempPasswordData?.email || "--"}</span>
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium">Temporary password</div>
              <div className="flex items-center gap-2">
                <Input readOnly value={tempPasswordData?.temporaryPassword ?? ""} className="font-mono" />
                <Button
                  type="button"
                  variant="outline"
                  className="glass-chip"
                  onClick={async () => {
                    if (!tempPasswordData?.temporaryPassword) return;
                    try {
                      await navigator.clipboard.writeText(tempPasswordData.temporaryPassword);
                      toast({ title: "Copied", description: "Temporary password copied to clipboard." });
                    } catch {
                      toast({
                        title: "Copy failed",
                        description: "Could not copy to clipboard. Copy it manually.",
                        variant: "destructive",
                      });
                    }
                  }}
                >
                  <Copy className="h-4 w-4" />
                  Copy
                </Button>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              Expires: {formatDate(tempPasswordData?.expiresAt)}
            </div>
            <div className="text-xs text-yellow-200/90">
              Warning: This password can sign in until it expires. Ask the user to change it immediately after login.
            </div>
          </div>
          <DialogFooter>
            <Button type="button" onClick={() => setTempPasswordData(null)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PageSectionCard className="glass-surface">
        <CardHeader>
          <CardTitle className="ui-static-heading">All Users</CardTitle>
          <CardDescription>View every signed-up user account (admin only).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FilterBarShell>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative w-full sm:max-w-md">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by name, email, or ID..."
                  className="pl-8"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="glass-chip w-full sm:w-auto"
                disabled={isFetching}
                onClick={async () => {
                  const result = await refetch();
                  if (result.isError) {
                    toast({
                      title: "Refresh failed",
                      description: result.error?.message || "Could not refresh users",
                      variant: "destructive",
                    });
                    return;
                  }
                  toast({ title: "Refreshed", description: "User list updated." });
                }}
              >
                {isFetching ? "Refreshing..." : "Refresh"}
              </Button>
            </div>
          </FilterBarShell>

          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : error ? (
            <div className="text-sm text-red-400">{error.message}</div>
          ) : (
            <>
              <div className="grid gap-3 xl:hidden">
                {filtered.map((u) => (
                  <div key={u.id} className="rounded-xl border border-border/70 bg-card/55 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-foreground">{u.fullName}</p>
                          <Badge variant="outline" className="glass-chip">
                            {u.role}
                          </Badge>
                        </div>
                        <p className="break-all text-xs text-muted-foreground">{u.email}</p>
                        <p className="font-mono text-[11px] text-muted-foreground">ID {u.id}</p>
                      </div>
                      <div className="w-[124px] shrink-0">{renderUserActions(u, "button")}</div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge variant="outline" title={getUserStatusMeta(u).title} className={getUserStatusMeta(u).className}>
                        {getUserStatusMeta(u).label}
                      </Badge>
                      <Badge variant="outline" className="glass-chip">
                        {u.plan}
                      </Badge>
                      <Badge variant="outline" className="glass-chip">
                        {u.planStatus}
                      </Badge>
                    </div>

                    <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                      <div>
                        <dt className="text-muted-foreground">Created</dt>
                        <dd className="text-foreground">{formatDate(u.createdAt)}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Paid Through</dt>
                        <dd className="text-foreground">{formatDate(u.paidThroughAt)}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Trial Ends</dt>
                        <dd className="text-foreground">{formatDate(u.trialEndsAt)}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Plan Selected</dt>
                        <dd className="text-foreground">{formatDate(u.planSelectedAt)}</dd>
                      </div>
                    </dl>
                  </div>
                ))}
              </div>

              <TableShell className="hidden xl:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Plan Status</TableHead>
                    <TableHead>Trial Started</TableHead>
                    <TableHead>Trial Ends</TableHead>
                    <TableHead>Paid Through</TableHead>
                    <TableHead>Plan Selected</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-mono text-xs">{u.id}</TableCell>
                      <TableCell className="font-medium">{u.fullName}</TableCell>
                      <TableCell className="text-muted-foreground">{u.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="glass-chip">
                          {u.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          title={getUserStatusMeta(u).title}
                          className={getUserStatusMeta(u).className}
                        >
                          {getUserStatusMeta(u).label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="glass-chip">
                          {u.plan}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="glass-chip">
                          {u.planStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{formatDate(u.trialStartedAt)}</TableCell>
                      <TableCell className="text-xs">{formatDate(u.trialEndsAt)}</TableCell>
                      <TableCell className="text-xs">{formatDate(u.paidThroughAt)}</TableCell>
                      <TableCell className="text-xs">{formatDate(u.planSelectedAt)}</TableCell>
                      <TableCell className="text-xs">{formatDate(u.createdAt)}</TableCell>
                      <TableCell className="text-right">{renderUserActions(u)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableShell>
            </>
          )}
        </CardContent>
      </PageSectionCard>

      <PageSectionCard className="glass-surface">
        <CardHeader>
          <CardTitle>Workspace Integrations</CardTitle>
          <CardDescription>
            Active/inactive destinations and destination caps for each workspace owner.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FilterBarShell>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="glass-chip w-full sm:w-auto"
                disabled={isFetchingWorkspaceIntegrations}
                onClick={async () => {
                  const result = await refetchWorkspaceIntegrations();
                  if (result.isError) {
                    toast({
                      title: "Refresh failed",
                      description: result.error?.message || "Could not refresh workspace integrations",
                      variant: "destructive",
                    });
                    return;
                  }
                  toast({ title: "Refreshed", description: "Workspace integrations updated." });
                }}
              >
                {isFetchingWorkspaceIntegrations ? "Refreshing..." : "Refresh"}
              </Button>
            </div>
          </FilterBarShell>

          {isLoadingWorkspaceIntegrations ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : workspaceIntegrationsError ? (
            <div className="text-sm text-red-400">{workspaceIntegrationsError.message}</div>
          ) : (
            <TableShell>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Owner</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Telegram</TableHead>
                    <TableHead>Discord</TableHead>
                    <TableHead>Website</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredWorkspaceIntegrations.map((workspace) => (
                    <TableRow key={workspace.ownerUserId}>
                      <TableCell>
                        <div className="font-medium">{workspace.ownerFullName}</div>
                        <div className="text-xs text-muted-foreground">{workspace.ownerEmail}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="glass-chip">
                          {workspace.plan}
                        </Badge>
                        <div className="text-xs text-muted-foreground mt-1">{workspace.planStatus}</div>
                      </TableCell>
                      <TableCell className="text-xs">
                        <div>Active: {workspace.destinationUsage.telegram.active}</div>
                        <div>Inactive: {workspace.destinationUsage.telegram.inactive}</div>
                        <div className="text-muted-foreground">Cap: {formatCap(workspace.destinationUsage.telegram.cap)}</div>
                      </TableCell>
                      <TableCell className="text-xs">
                        <div>Active: {workspace.destinationUsage.discord.active}</div>
                        <div>Inactive: {workspace.destinationUsage.discord.inactive}</div>
                        <div className="text-muted-foreground">Cap: {formatCap(workspace.destinationUsage.discord.cap)}</div>
                      </TableCell>
                      <TableCell className="text-xs">
                        <div>Active: {workspace.destinationUsage.website.active}</div>
                        <div>Inactive: {workspace.destinationUsage.website.inactive}</div>
                        <div className="text-muted-foreground">Cap: {formatCap(workspace.destinationUsage.website.cap)}</div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableShell>
          )}
        </CardContent>
      </PageSectionCard>
    </div>
  );
}
