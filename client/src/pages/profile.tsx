import { useEffect } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";

const ProfilePage = () => {
  const [, setLocation] = useLocation();
  
  // Redirect to settings page with account tab
  useEffect(() => {
    setLocation("/settings?tab=account");
  }, [setLocation]);
  
  return (
    <div className="flex justify-center items-center h-96">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="ml-2">Redirecting to profile settings...</p>
    </div>
  );
};

export default ProfilePage;