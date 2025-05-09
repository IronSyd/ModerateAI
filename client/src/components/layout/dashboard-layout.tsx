import React, { ReactNode } from "react";
import Sidebar from "./sidebar";
import Header from "./header";

interface DashboardLayoutProps {
  children: ReactNode;
}

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  return (
    <div className="min-h-screen flex bg-background font-sans">
      {/* Sidebar */}
      <Sidebar />
      
      {/* Main Content */}
      <div className="flex-1">
        <Header />
        
        <div className="p-4 md:p-6">
          {children}
        </div>
      </div>
    </div>
  );
};

export default DashboardLayout;