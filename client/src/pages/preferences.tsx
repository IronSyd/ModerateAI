import { useEffect } from "react";
import { useLocation } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";

const PreferencesPage = () => {
  const [, setLocation] = useLocation();
  
  // Redirect to settings page with notifications tab
  useEffect(() => {
    setLocation("/settings?tab=notifications");
  }, [setLocation]);
  
  return (
    <div className="space-y-3 py-10">
      <Skeleton className="h-5 w-64" />
      <Skeleton className="h-10 w-full max-w-md" />
    </div>
  );
};

export default PreferencesPage;
