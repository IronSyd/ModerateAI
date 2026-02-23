import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { zodResolver } from "@hookform/resolvers/zod";
import { Logo } from "@/components/logo";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { motion, useReducedMotion } from "framer-motion";
import { AtmosphereOrbs } from "@/components/atmosphere-orbs";

const loginSchema = z.object({
  email: z.string().trim().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

const signupSchema = z.object({
  fullName: z.string().trim().min(2, "Full name is required"),
  email: z.string().trim().email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string().min(8, "Please confirm your password"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

const AuthPage = () => {
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const { user, loginMutation, signupMutation } = useAuth();
  const shouldReduceMotion = useReducedMotion();
  const [mode, setMode] = useState<"signin" | "signup">("signin");

  const fadeInUp = {
    initial: shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 18 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.2 },
    transition: { duration: 0.42, ease: "easeOut" as const },
  };

  const loginForm = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    mode: "onSubmit",
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const signupForm = useForm<z.infer<typeof signupSchema>>({
    resolver: zodResolver(signupSchema),
    mode: "onSubmit",
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });



  // Allow deep-linking to either form (/auth?mode=signup or /auth?mode=signin).
  useEffect(() => {
    const idx = location.indexOf("?");
    if (idx === -1) return;
    const params = new URLSearchParams(location.slice(idx + 1));
    const modeParam = params.get("mode");
    if (modeParam === "signup") setMode("signup");
    if (modeParam === "signin") setMode("signin");
  }, [location]);

  // Redirect if already logged in - using useEffect to avoid breaking hooks rules
  useEffect(() => {
    if (user) {
      setLocation("/dashboard");
    }
  }, [user, setLocation]);

  const onLoginSubmit = (values: z.infer<typeof loginSchema>) => {
    loginMutation.mutate({ ...values, email: values.email.trim() }, {
      onSuccess: () => {
        toast({
          title: "Login successful",
          description: "Welcome back!",
        });
        setLocation("/dashboard");
      },
    });
  };

  const onSignupSubmit = (values: z.infer<typeof signupSchema>) => {
    signupMutation.mutate(
      {
        fullName: values.fullName.trim(),
        email: values.email.trim(),
        password: values.password,
      },
        {
          onSuccess: () => {
            toast({
              title: "Account created",
              description: "Account created. Please sign in to continue.",
            });
            loginForm.reset({ email: values.email.trim(), password: "" });
            signupForm.reset();
            setMode("signin");
          },
        },
      );
  };



  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-x-clip">
      <header className="py-4 px-6 md:px-8 border-b glass-divider glass-chip">
        <div className="max-w-7xl mx-auto flex items-center">
          <Link href="/">
            <motion.div
              initial={shouldReduceMotion ? false : { opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
            >
              <Logo className="hover:opacity-90 transition-opacity" />
            </motion.div>
          </Link>
        </div>
      </header>

      <main className="py-8 px-6 md:px-8 relative">
        <AtmosphereOrbs className="z-0" />
        <div className="relative z-10 w-full max-w-7xl mx-auto">
          <div className="grid gap-8 md:grid-cols-2 items-center">
            {/* Auth Form */}
            <motion.div className="md:pl-6" {...fadeInUp}>
              <Card className="w-full max-w-md surface-glow lift-card glass-surface">
                <CardHeader>
                  <CardDescription className="kinetic-headline text-lg">
                    {mode === "signin" ? "Sign in to your ModerateAI account" : "Create your ModerateAI account"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {mode === "signin" ? (
                    <Form key="signin" {...loginForm}>
                      <form
                        key="signin-form"
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
                                  autoComplete="email"
                                  placeholder="Enter your email address"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={loginForm.control}
                          name="password"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Password</FormLabel>
                              <FormControl>
                                <PasswordInput
                                  autoComplete="current-password"
                                  placeholder="Enter your password"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <Button
                          type="submit"
                          className="w-full tactile-button"
                          disabled={loginMutation.isPending}
                        >
                          {loginMutation.isPending ? "Signing in..." : "Sign In"}
                        </Button>
                        <p className="text-xs text-muted-foreground text-center">
                          Forgot password? Contact your admin for a temporary password.
                        </p>
                      </form>
                    </Form>
                  ) : (
                    <Form key="signup" {...signupForm}>
                      <form
                        key="signup-form"
                        onSubmit={signupForm.handleSubmit(onSignupSubmit)}
                        className="space-y-4"
                      >
                        <FormField
                          control={signupForm.control}
                          name="fullName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Full name</FormLabel>
                              <FormControl>
                                <Input
                                  type="text"
                                  autoComplete="name"
                                  placeholder="Enter your full name"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={signupForm.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Email</FormLabel>
                              <FormControl>
                                <Input
                                  type="email"
                                  autoComplete="email"
                                  placeholder="Enter your email address"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={signupForm.control}
                          name="password"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Password</FormLabel>
                              <FormControl>
                                <PasswordInput
                                  autoComplete="new-password"
                                  placeholder="Create a password (8+ characters)"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={signupForm.control}
                          name="confirmPassword"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Confirm password</FormLabel>
                              <FormControl>
                                <PasswordInput
                                  autoComplete="new-password"
                                  placeholder="Confirm your password"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <Button
                          type="submit"
                          className="w-full tactile-button"
                          disabled={signupMutation.isPending}
                        >
                          {signupMutation.isPending ? "Creating account..." : "Create Account"}
                        </Button>
                      </form>
                    </Form>
                  )}

                  <div className="mt-4 flex items-center justify-center">
                    <button
                      type="button"
                      className="group text-sm text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => {
                        setMode((current) => (current === "signin" ? "signup" : "signin"));
                      }}
                    >
                      {mode === "signin" ? (
                        <>
                          <span>New here? </span>
                          <span className="inline-block border-b-2 border-primary/70 pb-0.5 font-medium text-foreground">
                            Create an account
                          </span>
                        </>
                      ) : (
                        <>
                          <span>Already have an account? </span>
                          <span className="inline-block border-b-2 border-primary/70 pb-0.5 font-medium text-foreground">
                            Sign in
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                </CardContent>
                <CardFooter className="flex flex-col space-y-4">
                  <div className="text-xs text-muted-foreground text-center">
                    Passwords must be at least 8 characters.
                  </div>
                </CardFooter>
              </Card>
            </motion.div>

            {/* Hero Section */}
            <motion.div className="hidden md:block" {...fadeInUp}>
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
                  <div className="flex items-start rounded-xl p-2 glass-chip">
                    <div className="rounded-full bg-primary/10 p-2 mr-3 border border-white/10">
                      <svg className="h-5 w-5 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div className="text-left">
                      <h3 className="font-medium">Multi-platform Integration</h3>
                      <p className="text-muted-foreground">Telegram, Discord, Web - all in one place</p>
                    </div>
                  </div>

                  <div className="flex items-start rounded-xl p-2 glass-chip">
                    <div className="rounded-full bg-primary/10 p-2 mr-3 border border-white/10">
                      <svg className="h-5 w-5 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div className="text-left">
                      <h3 className="font-medium">Intelligent Moderation</h3>
                      <p className="text-muted-foreground">Automatically filter inappropriate content</p>
                    </div>
                  </div>

                  <div className="flex items-start rounded-xl p-2 glass-chip">
                    <div className="rounded-full bg-primary/10 p-2 mr-3 border border-white/10">
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
            </motion.div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AuthPage;

