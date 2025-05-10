import { useEffect } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";

const PreferencesPage = () => {
  const [, setLocation] = useLocation();
  
  // Redirect to settings page with notifications tab
  useEffect(() => {
    setLocation("/settings?tab=notifications");
  }, [setLocation]);
  
  return (
    <div className="flex justify-center items-center h-96">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="ml-2">Redirecting to preferences settings...</p>
    </div>
  );
};

export default PreferencesPage;