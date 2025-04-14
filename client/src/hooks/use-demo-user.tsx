import { createContext, ReactNode, useContext, useState, useEffect } from "react";
import { User } from "@shared/schema";

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
  email: "admin@moderateai.com",
  password: "",
  fullName: "Admin User",
  role: "admin",
  createdAt: new Date()
};

export function DemoUserProvider({ children }: { children: ReactNode }) {
  const [isDemoUser, setIsDemoUser] = useState<boolean>(false);
  
  // Check if demo user was previously enabled
  useEffect(() => {
    const storedValue = localStorage.getItem("isDemoUser");
    if (storedValue === "true") {
      setIsDemoUser(true);
    }
  }, []);

  const enableDemoUser = () => {
    setIsDemoUser(true);
    localStorage.setItem("isDemoUser", "true");
  };

  const disableDemoUser = () => {
    setIsDemoUser(false);
    localStorage.removeItem("isDemoUser");
  };

  return (
    <DemoUserContext.Provider
      value={{
        isDemoUser,
        enableDemoUser,
        disableDemoUser,
        demoUser: isDemoUser ? DEMO_USER : null
      }}
    >
      {children}
    </DemoUserContext.Provider>
  );
}

export function useDemoUser() {
  const context = useContext(DemoUserContext);
  if (!context) {
    throw new Error("useDemoUser must be used within a DemoUserProvider");
  }
  return context;
}