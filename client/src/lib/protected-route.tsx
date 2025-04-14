import { useAuth } from "@/hooks/use-auth";
import { useAdminUser } from "@/hooks/use-admin-user";
import { Loader2 } from "lucide-react";
import { Redirect, Route } from "wouter";

export function ProtectedRoute({
  path,
  component: Component,
}: {
  path: string;
  component: () => React.JSX.Element;
}) {
  const { user, isLoading } = useAuth();
  const { isAdminUser, adminUser } = useAdminUser();

  return (
    <Route path={path}>
      {isLoading ? (
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-border" />
        </div>
      ) : user || isAdminUser ? (
        <Component />
      ) : (
        <Redirect to="/auth" />
      )}
    </Route>
  );
}