import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Loader2, AlertCircle, CheckCircle, Copy, Download } from "lucide-react";

// Make a simple apiRequest function since we don't have access to the queryClient
const apiRequest = async (url: string, options: RequestInit = {}) => {
  options.headers = {
    ...options.headers,
    'Content-Type': 'application/json'
  };
  return fetch(url, options);
};

export function TwoFactorSetup() {
  const [verificationCode, setVerificationCode] = useState('');
  const [setupStep, setSetupStep] = useState<'initial' | 'verify' | 'completed'>('initial');
  const [recoveryToken, setRecoveryToken] = useState<string | null>(null);
  const { toast } = useToast();

  // Get the 2FA setup data (QR code and secret)
  const { 
    data: setupData,
    isLoading: isSetupLoading,
    isError: isSetupError,
    error: setupError
  } = useQuery({
    queryKey: ['/api/user/2fa/setup'],
    enabled: setupStep === 'initial',
    queryFn: async () => {
      const response = await apiRequest('/api/user/2fa/setup', {
        method: 'POST'
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to setup 2FA');
      }
      
      return response.json();
    }
  });

  // Verify and enable 2FA
  const { 
    mutate: verifyCode,
    isPending: isVerifying
  } = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('/api/user/2fa/verify', {
        method: 'POST',
        body: JSON.stringify({ token: verificationCode })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to verify 2FA code');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      setRecoveryToken(data.recoveryToken);
      setSetupStep('completed');
      toast({
        title: "Two-Factor Authentication Enabled",
        description: "2FA has been successfully set up for your account.",
        variant: "default"
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Verification Failed",
        description: error.message || "Invalid verification code. Please try again.",
        variant: "destructive"
      });
    }
  });

  const handleVerify = () => {
    if (!verificationCode) {
      toast({
        title: "Verification Code Required",
        description: "Please enter the verification code from your authenticator app.",
        variant: "destructive"
      });
      return;
    }
    
    verifyCode();
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied to clipboard",
      duration: 2000
    });
  };

  const downloadBackupCodes = (codes: string[]) => {
    const codesText = codes.join('\n');
    const element = document.createElement("a");
    const file = new Blob([codesText], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = "2fa-backup-codes.txt";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  if (isSetupLoading) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="py-6 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (isSetupError) {
    return (
      <Alert variant="destructive" className="mb-4">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          {setupError instanceof Error ? setupError.message : 'Failed to setup 2FA'}
        </AlertDescription>
      </Alert>
    );
  }

  if (setupStep === 'completed' && recoveryToken) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="text-center text-green-600">
            <CheckCircle className="h-8 w-8 mx-auto mb-2" />
            Two-Factor Authentication Enabled
          </CardTitle>
          <CardDescription className="text-center">
            Your account is now protected with two-factor authentication.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert className="mb-4 bg-amber-50 border-amber-200">
            <AlertTitle>Recovery Token</AlertTitle>
            <AlertDescription>
              Save this recovery token in a safe place. You'll need it if you lose access to your authenticator app.
            </AlertDescription>
          </Alert>
          
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-md border mb-4">
            <code className="text-sm font-mono break-all">
              {recoveryToken}
            </code>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => copyToClipboard(recoveryToken)}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          
          {setupData?.backupCodes && (
            <>
              <Separator className="my-4" />
              <div className="mt-4">
                <h4 className="font-medium mb-2">Backup Codes</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  You can use these backup codes to sign in if you lose access to your authenticator app.
                  Each code can only be used once.
                </p>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {setupData.backupCodes.map((code: string, index: number) => (
                    <div key={index} className="p-2 bg-slate-50 rounded border text-sm font-mono">
                      {code}
                    </div>
                  ))}
                </div>
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => downloadBackupCodes(setupData.backupCodes)}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Backup Codes
                </Button>
              </div>
            </>
          )}
        </CardContent>
        <CardFooter>
          <Button className="w-full" onClick={() => window.location.href = '/'}>
            Return to Dashboard
          </Button>
        </CardFooter>
      </Card>
    );
  }

  if (setupStep === 'initial' && setupData) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Set Up Two-Factor Authentication</CardTitle>
          <CardDescription>
            Secure your account with 2FA to add an extra layer of protection.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-center mb-4">
              <img 
                src={setupData.qrCode} 
                alt="QR Code for 2FA setup" 
                className="border border-slate-200 rounded-md" 
              />
            </div>
            
            <div>
              <h4 className="font-medium mb-1">1. Scan QR Code</h4>
              <p className="text-sm text-muted-foreground">
                Scan this QR code with your authenticator app (like Google Authenticator or Authy).
              </p>
            </div>
            
            <div>
              <h4 className="font-medium mb-1">2. Manual Setup</h4>
              <p className="text-sm text-muted-foreground mb-2">
                If you can't scan the QR code, enter this code manually in your authenticator app:
              </p>
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-md border">
                <code className="text-sm font-mono">
                  {setupData.secret}
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => copyToClipboard(setupData.secret)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <Button 
              className="w-full mt-2" 
              onClick={() => setSetupStep('verify')}
            >
              Next
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Verify Two-Factor Authentication</CardTitle>
        <CardDescription>
          Enter the 6-digit code from your authenticator app to verify and enable 2FA.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Input
            type="text"
            inputMode="numeric"
            maxLength={6}
            placeholder="Enter 6-digit code"
            value={verificationCode}
            onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
            className="text-center text-lg tracking-wider"
          />
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button 
          variant="outline" 
          onClick={() => setSetupStep('initial')}
        >
          Back
        </Button>
        <Button 
          onClick={handleVerify}
          disabled={isVerifying}
        >
          {isVerifying ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Verifying
            </>
          ) : (
            'Verify & Enable'
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}