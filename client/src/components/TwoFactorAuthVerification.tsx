import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/use-auth";
import { Loader2, ShieldCheck } from "lucide-react";

interface TwoFactorAuthVerificationProps {
  onCancel: () => void;
}

export function TwoFactorAuthVerification({ onCancel }: TwoFactorAuthVerificationProps) {
  const [token, setToken] = useState('');
  const [useBackupCode, setUseBackupCode] = useState(false);
  const { pendingUserId, verify2FAMutation, setPendingUserId } = useAuth();
  
  const handleVerify = () => {
    if (!token || !pendingUserId) return;
    
    verify2FAMutation.mutate({
      userId: pendingUserId,
      token,
      useBackupCode
    });
  };
  
  const handleCancel = () => {
    setPendingUserId(null);
    onCancel();
  };
  
  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="space-y-1">
        <div className="flex items-center">
          <ShieldCheck className="h-6 w-6 mr-2 text-primary" />
          <CardTitle className="text-2xl">Two-Factor Verification</CardTitle>
        </div>
        <CardDescription>
          Enter the verification code from your authenticator app
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="code">
            {useBackupCode ? 'Backup Code' : 'Verification Code'}
          </Label>
          <Input
            id="code"
            type="text"
            placeholder={useBackupCode ? "XXXX-XXXX" : "123456"}
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="text-lg tracking-wider text-center"
          />
        </div>
        
        <div className="flex items-center space-x-2">
          <Checkbox 
            id="backup-code" 
            checked={useBackupCode}
            onCheckedChange={(checked) => {
              setUseBackupCode(checked === true);
              setToken('');
            }}
          />
          <Label htmlFor="backup-code" className="text-sm cursor-pointer">
            Use backup code instead
          </Label>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button 
          variant="outline" 
          onClick={handleCancel}
        >
          Cancel
        </Button>
        <Button 
          onClick={handleVerify}
          disabled={!token || verify2FAMutation.isPending}
        >
          {verify2FAMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Verifying...
            </>
          ) : (
            'Verify & Sign in'
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}