import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2, KeyRound } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface TwoFactorVerificationProps {
  userId: number;
  onSuccess: (userData: any) => void;
  onCancel: () => void;
}

export function TwoFactorVerification({ userId, onSuccess, onCancel }: TwoFactorVerificationProps) {
  const [verificationCode, setVerificationCode] = useState('');
  const [isBackupCode, setIsBackupCode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleVerify = async () => {
    if (!verificationCode) {
      toast({
        title: "Verification Code Required",
        description: "Please enter the verification code from your authenticator app.",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    
    try {
      const response = await fetch('/api/verify-2fa', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          token: verificationCode,
          useBackupCode: isBackupCode
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Verification failed');
      }

      onSuccess(data.user);
    } catch (error) {
      toast({
        title: "Verification Failed",
        description: error instanceof Error ? error.message : "Invalid verification code. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center">
          <KeyRound className="h-5 w-5 mr-2" />
          Two-Factor Authentication
        </CardTitle>
        <CardDescription>
          Enter the verification code from your authenticator app.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Input
            type="text"
            inputMode="numeric"
            maxLength={isBackupCode ? 9 : 6}
            placeholder={isBackupCode ? "XXXX-XXXX" : "123456"}
            value={verificationCode}
            onChange={(e) => {
              const value = e.target.value;
              if (isBackupCode) {
                // Allow digits and hyphens for backup codes
                setVerificationCode(value.replace(/[^0-9-]/g, ''));
              } else {
                // Allow only digits for 2FA codes
                setVerificationCode(value.replace(/\D/g, ''));
              }
            }}
            className="text-center text-lg tracking-wider"
          />
          
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="use-backup" 
              checked={isBackupCode}
              onCheckedChange={(checked) => {
                setIsBackupCode(checked === true);
                setVerificationCode(''); // Clear the input when switching modes
              }}
            />
            <Label htmlFor="use-backup" className="text-sm font-normal cursor-pointer">
              I want to use a backup code instead
            </Label>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button 
          variant="outline" 
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button 
          onClick={handleVerify}
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Verifying
            </>
          ) : (
            'Verify'
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}