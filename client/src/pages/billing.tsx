import { useEffect } from "react";
import { useLocation } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";

const BillingPage = () => {
  const [, setLocation] = useLocation();
  
  // Redirect to settings page with billing tab
  useEffect(() => {
    setLocation("/settings?tab=billing");
  }, [setLocation]);
  
  return (
    <div className="space-y-3 py-10">
      <Skeleton className="h-5 w-56" />
      <Skeleton className="h-10 w-full max-w-md" />
    </div>
  );
};

export default BillingPage;
