import { createContext, ReactNode, useContext, useState, useEffect } from "react";
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

// Mock admin user data
const ADMIN_USER: User = {
  id: 0,
  username: "admin",
  email: "excelay@gmail.com",
  password: "",
  fullName: "Admin User",
  role: "admin",
  createdAt: new Date()
};

export function AdminUserProvider({ children }: { children: ReactNode }) {
  const [isAdminUser, setIsAdminUser] = useState<boolean>(false);
  
  // Get current authenticated user
  const { data: currentUser } = useQuery<User | undefined, Error>({
    queryKey: ["/api/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });
  
  // Check if admin user was previously enabled
  useEffect(() => {
    const storedValue = localStorage.getItem("isAdminUser");
    if (storedValue === "true") {
      setIsAdminUser(true);
    }
  }, []);

  // Automatically disable admin mode for non-admin users
  useEffect(() => {
    if (currentUser && currentUser.role !== "admin" && isAdminUser) {
      setIsAdminUser(false);
      localStorage.removeItem("isAdminUser");
    }
  }, [currentUser, isAdminUser]);

  const enableAdminUser = () => {
    setIsAdminUser(true);
    localStorage.setItem("isAdminUser", "true");
  };

  const disableAdminUser = () => {
    setIsAdminUser(false);
    localStorage.removeItem("isAdminUser");
  };

  return (
    <AdminUserContext.Provider
      value={{
        isAdminUser,
        enableAdminUser,
        disableAdminUser,
        adminUser: isAdminUser ? ADMIN_USER : null
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