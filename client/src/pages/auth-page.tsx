import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useAdminUser } from "@/hooks/use-admin-user";
import { MessagesSquare, ShieldAlert } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Logo } from "@/components/logo";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

const AuthPage = () => {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { user, loginMutation } = useAuth();
  const { enableAdminUser } = useAdminUser();

  const loginForm = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    mode: "onSubmit",
    defaultValues: {
      email: "",
    },
  });



  // Redirect if already logged in - using useEffect to avoid breaking hooks rules
  useEffect(() => {
    if (user) {
      setLocation("/dashboard");
    }
  }, [user, setLocation]);

  const onLoginSubmit = (values: z.infer<typeof loginSchema>) => {
    loginMutation.mutate(values, {
      onSuccess: () => {
        toast({
          title: "Login successful",
          description: "Welcome back!",
        });
        setLocation("/dashboard");
      },
    });
  };



  return (
    <div className="min-h-screen bg-background flex items-center">
      <div className="container max-w-7xl mx-auto px-4 py-8">
        <div className="grid gap-8 md:grid-cols-2 items-center">
          {/* Auth Form */}
          <div>
            <div className="mb-8">
              <Logo />
            </div>

            <Card className="w-full max-w-md mx-auto">
              <CardHeader>
                <CardDescription className="text-lg">
                  Sign in to your ModerateAI account
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...loginForm}>
                  <form
                    onSubmit={loginForm.handleSubmit(onLoginSubmit)}
                    className="space-y-4"
                  >
                    <FormField
                      control={loginForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input
                              type="email"
                              placeholder="Enter your email address"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={loginMutation.isPending}
                    >
                      {loginMutation.isPending ? "Signing in..." : "Sign In"}
                    </Button>
                  </form>
                </Form>
                
                <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground text-center">
                    Access restricted to authorized email addresses only
                  </p>
                </div>
              </CardContent>
              <CardFooter className="flex flex-col space-y-4">
                <div className="text-sm text-muted-foreground text-center">
                  New users must be invited by an administrator
                </div>
                <div className="text-center">
                  <Button
                    variant="outline"
                    onClick={enableAdminUser}
                    className="text-xs"
                  >
                    <ShieldAlert className="h-3 w-3 mr-1" />
                    Enable Admin User
                  </Button>
                </div>
              </CardFooter>
            </Card>
          </div>

          {/* Hero Section */}
          <div className="hidden md:block">
            <div className="text-center md:text-left">
              <h1 className="text-4xl font-bold mb-6">
                AI-Powered 
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-600 ml-2">
                  Customer Support
                </span>
              </h1>
              <p className="text-xl text-muted-foreground mb-8 max-w-md">
                Join ModerateAI to streamline your customer support and community moderation with intelligent AI responses across all your platforms.
              </p>
              <div className="space-y-6">
                <div className="flex items-start">
                  <div className="rounded-full bg-primary/10 p-2 mr-3">
                    <svg className="h-5 w-5 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <h3 className="font-medium">Multi-platform Integration</h3>
                    <p className="text-muted-foreground">Website, Telegram, Discord - all in one place</p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <div className="rounded-full bg-primary/10 p-2 mr-3">
                    <svg className="h-5 w-5 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <h3 className="font-medium">Intelligent Moderation</h3>
                    <p className="text-muted-foreground">Automatically filter inappropriate content</p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <div className="rounded-full bg-primary/10 p-2 mr-3">
                    <svg className="h-5 w-5 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <h3 className="font-medium">Custom AI Configurations</h3>
                    <p className="text-muted-foreground">Tailor AI responses to match your brand</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;