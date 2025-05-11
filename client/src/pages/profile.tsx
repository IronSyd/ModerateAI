import React, { useState } from 'react';
import { PageContainer } from '../components/PageContainer';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { TwoFactorSetup } from '../components/TwoFactorSetup';
import { Shield, ShieldAlert, ShieldCheck, User, Lock, KeyRound } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState("account");
  const [showTwoFactorSetup, setShowTwoFactorSetup] = useState(false);
  const { toast } = useToast();

  // Get user data including 2FA status
  const { data: userData, isLoading, refetch } = useQuery({
    queryKey: ['/api/user'],
    queryFn: async () => {
      const response = await fetch('/api/user');
      if (!response.ok) {
        if (response.status === 401) {
          window.location.href = '/login';
          return null;
        }
        throw new Error('Failed to fetch user data');
      }
      return response.json();
    }
  });

  const handleDisable2FA = async () => {
    // This is a placeholder - actual implementation would require a verification step
    toast({
      title: "Not Implemented",
      description: "Disabling 2FA requires verification and is only available in the full implementation.",
      variant: "default"
    });
  };

  if (isLoading) {
    return (
      <PageContainer>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
        </div>
      </PageContainer>
    );
  }

  if (showTwoFactorSetup) {
    return (
      <PageContainer>
        <div className="mb-6">
          <Button 
            variant="ghost" 
            onClick={() => setShowTwoFactorSetup(false)}
            className="px-0 text-muted-foreground"
          >
            ← Back to Profile
          </Button>
          <h1 className="text-2xl font-bold mt-2">Two-Factor Authentication Setup</h1>
        </div>
        
        <TwoFactorSetup />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">User Profile</h1>
        <p className="text-muted-foreground">
          Manage your account settings and security preferences
        </p>
      </div>

      <Tabs defaultValue={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="account">
            <User className="h-4 w-4 mr-2" />
            Account
          </TabsTrigger>
          <TabsTrigger value="security">
            <Shield className="h-4 w-4 mr-2" />
            Security
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="account" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Account Information</CardTitle>
              <CardDescription>
                View and update your personal information
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Username</label>
                    <div className="font-medium">{userData?.username}</div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Full Name</label>
                    <div className="font-medium">{userData?.fullName}</div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Email</label>
                    <div className="font-medium">{userData?.email}</div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Role</label>
                    <div className="font-medium capitalize">{userData?.role}</div>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button variant="outline" disabled>Edit Profile</Button>
            </CardFooter>
          </Card>
        </TabsContent>
        
        <TabsContent value="security" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Lock className="h-5 w-5 mr-2" />
                Security Settings
              </CardTitle>
              <CardDescription>
                Manage your account's security and authentication settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* 2FA Status Card */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center">
                      <KeyRound className="h-4 w-4 mr-2" />
                      Two-Factor Authentication
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        {userData?.twoFactorEnabled ? (
                          <ShieldCheck className="h-5 w-5 text-green-500 mr-2" />
                        ) : (
                          <ShieldAlert className="h-5 w-5 text-amber-500 mr-2" />
                        )}
                        <div>
                          <div className="font-medium">
                            {userData?.twoFactorEnabled 
                              ? 'Enabled' 
                              : 'Not Enabled'}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {userData?.twoFactorEnabled 
                              ? 'Your account is protected with two-factor authentication.' 
                              : 'Add an extra layer of security to your account.'}
                          </p>
                        </div>
                      </div>
                      
                      {userData?.twoFactorEnabled ? (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={handleDisable2FA}
                        >
                          Disable
                        </Button>
                      ) : (
                        <Button 
                          size="sm"
                          onClick={() => setShowTwoFactorSetup(true)}
                        >
                          Enable
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
                
                {/* Password Card - Placeholder */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Password</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">Change Password</div>
                        <p className="text-sm text-muted-foreground">
                          It's a good idea to use a strong password that you don't use elsewhere
                        </p>
                      </div>
                      <Button variant="outline" size="sm" disabled>
                        Update
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}