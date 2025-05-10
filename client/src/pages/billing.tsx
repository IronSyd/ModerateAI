import { useEffect } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";

const BillingPage = () => {
  const [, setLocation] = useLocation();
  
  // Redirect to settings page with billing tab
  useEffect(() => {
    setLocation("/settings?tab=billing");
  }, [setLocation]);
  
  return (
    <div className="flex justify-center items-center h-96">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="ml-2">Redirecting to billing settings...</p>
    </div>
  );
};

export default BillingPage;