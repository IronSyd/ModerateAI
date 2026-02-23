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
      <div className="flex-1 md:ml-64 min-w-0">
        <Header />
        
        <div className="px-4 pb-4 pt-20 md:px-6 md:pb-6 md:pt-24">
          {children}
        </div>
      </div>
    </div>
  );
};

export default DashboardLayout;
