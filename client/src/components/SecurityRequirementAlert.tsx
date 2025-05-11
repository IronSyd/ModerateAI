import React, { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ShieldAlert } from "lucide-react";
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/use-auth';

export function SecurityRequirementAlert() {
  const [show2FAAlert, setShow2FAAlert] = useState(false);
  const { user } = useAuth();
  
  useEffect(() => {
    // If there's no user, don't do anything
    if (!user) return;
    
    // If user already has 2FA enabled, don't show the alert
    if (user.twoFactorEnabled) {
      setShow2FAAlert(false);
      return;
    }
    
    // Check if 2FA is required for this user
    const check2FARequirement = async () => {
      try {
        const response = await apiRequest('GET', '/api/user/2fa/required');
        const data = await response.json();
        
        if (data.required) {
          setShow2FAAlert(true);
        } else {
          setShow2FAAlert(false);
        }
      } catch (error) {
        console.error('Error checking 2FA requirement:', error);
      }
    };
    
    check2FARequirement();
  }, [user]);
  
  if (!show2FAAlert) {
    return null;
  }
  
  return (
    <Alert variant="destructive" className="mb-6">
      <div className="flex items-start gap-4">
        <ShieldAlert className="h-5 w-5 mt-0.5" />
        <div className="flex-1">
          <AlertTitle>Security Action Required</AlertTitle>
          <AlertDescription className="mt-1">
            Your team requires two-factor authentication. Please set it up to secure your account.
          </AlertDescription>
        </div>
        <Button variant="destructive" size="sm" asChild>
          <Link href="/profile">
            Set Up 2FA
          </Link>
        </Button>
      </div>
    </Alert>
  );
}