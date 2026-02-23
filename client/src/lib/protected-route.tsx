import { useAuth } from "@/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";
import { Redirect, Route } from "wouter";
import React from "react";

type ProtectedRouteProps = {
  path: string;
  component?: () => React.JSX.Element;
  children?: React.ReactNode;
};

export function ProtectedRoute({ path, component: Component, children }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();
  const planSelectedAt = (user as any)?.planSelectedAt ?? null;
  const mustChangePassword = Boolean((user as any)?.mustChangePassword);
  const isResetPath = path === "/reset-password";
  const needsPasswordReset = Boolean(user) && mustChangePassword;
  const isAdmin = user?.role === "admin" || user?.role === "owner";
  const isWorkspaceMember = Boolean((user as any)?.workspaceOwnerId);
  const needsPlanSelection = Boolean(user) && !isAdmin && !isWorkspaceMember && !planSelectedAt && path !== "/choose-plan";

  return (
    <Route path={path}>
      {isLoading ? (
        <div className="space-y-5 py-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-20 w-full rounded-xl" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-28 w-full rounded-xl" />
          </div>
          <Skeleton className="h-72 w-full rounded-xl" />
        </div>
      ) : user && needsPasswordReset && !isResetPath ? (
        <Redirect to="/reset-password" />
      ) : user && !needsPasswordReset && isResetPath ? (
        <Redirect to="/dashboard" />
      ) : user && needsPlanSelection ? (
        <Redirect to="/choose-plan" />
      ) : user ? (
        Component ? <Component /> : children
      ) : (
        <Redirect to="/auth" />
      )}
    </Route>
  );
}
