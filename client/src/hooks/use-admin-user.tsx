import { createContext, ReactNode, useContext } from "react";
import { User } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";

interface AdminUserContextType {
  isAdminUser: boolean;
  enableAdminUser: () => void;
  disableAdminUser: () => void;
  adminUser: User | null;
}

const AdminUserContext = createContext<AdminUserContextType | null>(null);

export function AdminUserProvider({ children }: { children: ReactNode }) {
  // Get current authenticated user
  const { data: currentUser } = useQuery<User | undefined, Error>({
    queryKey: ["/api/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const enableAdminUser = () => {
    // No-op: admin mode is derived from authenticated role.
  };

  const disableAdminUser = () => {
    // No-op: admin mode is derived from authenticated role.
  };

  const isAdminUser = currentUser?.role === "admin" || currentUser?.role === "owner";

  return (
    <AdminUserContext.Provider
      value={{
        isAdminUser,
        enableAdminUser,
        disableAdminUser,
        adminUser: isAdminUser ? currentUser ?? null : null
      }}
    >
      {children}
    </AdminUserContext.Provider>
  );
}

export function useAdminUser() {
  const context = useContext(AdminUserContext);
  if (!context) {
    throw new Error("useAdminUser must be used within an AdminUserProvider");
  }
  return context;
}
