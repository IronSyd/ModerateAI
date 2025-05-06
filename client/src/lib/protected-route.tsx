import { useAuth } from "@/hooks/use-auth";
import { useAdminUser } from "@/hooks/use-admin-user";
import { Loader2 } from "lucide-react";
import { Redirect, Route } from "wouter";
import React from "react";

type ProtectedRouteProps = {
  path: string;
  component?: () => React.JSX.Element;
  children?: React.ReactNode;
};

export function ProtectedRoute({ path, component: Component, children }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();
  const { isAdminUser } = useAdminUser();

  return (
    <Route path={path}>
      {isLoading ? (
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-border" />
        </div>
      ) : user || isAdminUser ? (
        Component ? <Component /> : children
      ) : (
        <Redirect to="/auth" />
      )}
    </Route>
  );
}