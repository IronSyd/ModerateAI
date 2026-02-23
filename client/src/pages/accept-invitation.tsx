import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion, useReducedMotion } from "framer-motion";

import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { AtmosphereOrbs } from "@/components/atmosphere-orbs";

const acceptSchema = z
  .object({
    fullName: z.string().trim().min(2, "Full name is required"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(8, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type InvitationDetails = {
  email: string;
  role: string;
};

export default function AcceptInvitationPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const shouldReduceMotion = useReducedMotion();

  const token = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("token");
  }, []);

  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [isLoadingInvite, setIsLoadingInvite] = useState(true);

  const form = useForm<z.infer<typeof acceptSchema>>({
    resolver: zodResolver(acceptSchema),
    mode: "onSubmit",
    defaultValues: {
      fullName: "",
      password: "",
      confirmPassword: "",
    },
  });

  useEffect(() => {
    let cancelled = false;

    async function loadInvite() {
      if (!token) {
        setIsLoadingInvite(false);
        return;
      }

      try {
        const res = await fetch(`/api/team/accept-invitation/${encodeURIComponent(token)}`);
        const data = await res.json().catch(() => ({} as any));
        if (!res.ok) {
          throw new Error(data?.message || "Failed to load invitation");
        }
        if (!cancelled) {
          setInvitation({ email: data.email, role: data.role });
        }
      } catch (error: any) {
        if (!cancelled) {
          toast({
            title: "Invalid invitation",
            description: error?.message || "This invitation link is invalid or has expired.",
            variant: "destructive",
          });
        }
      } finally {
        if (!cancelled) {
          setIsLoadingInvite(false);
        }
      }
    }

    loadInvite();
    return () => {
      cancelled = true;
    };
  }, [toast, token]);

  const onSubmit = async (values: z.infer<typeof acceptSchema>) => {
    if (!token) {
      toast({
        title: "Missing token",
        description: "This invitation link is missing a token.",
        variant: "destructive",
      });
      return;
    }

    try {
      const res = await apiRequest("POST", `/api/team/accept-invitation/${encodeURIComponent(token)}`, {
        fullName: values.fullName.trim(),
        password: values.password,
        confirmPassword: values.confirmPassword,
      });

      const data = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        throw new Error(data?.message || "Failed to accept invitation");
      }

      toast({
        title: "Invitation accepted",
        description: "Account created. Please sign in to continue.",
      });

      setLocation("/auth");
    } catch (error: any) {
      toast({
        title: "Could not accept invitation",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    }
  };

  const fadeInUp = {
    initial: shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 18 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.2 },
    transition: { duration: 0.42, ease: "easeOut" as const },
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

      <main className="py-10 px-6 md:px-8 relative">
        <AtmosphereOrbs className="z-0" />

        <div className="relative z-10 w-full max-w-7xl mx-auto">
          <div className="grid gap-8 md:grid-cols-2 items-center">
            <motion.div className="md:pl-6" {...fadeInUp}>
              <Card className="w-full max-w-md surface-glow lift-card glass-surface">
                <CardHeader>
                  <CardDescription className="text-lg">Accept team invitation</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  {isLoadingInvite ? (
                    <div className="text-sm text-muted-foreground">Loading invitation…</div>
                  ) : !token ? (
                    <div className="text-sm text-muted-foreground">
                      This invitation link is missing a token. Ask your admin to resend it.
                    </div>
                  ) : !invitation ? (
                    <div className="text-sm text-muted-foreground">
                      This invitation link is invalid or has expired. Ask your admin to resend it.
                    </div>
                  ) : (
                    <>
                      <div className="space-y-3">
                        <div>
                          <div className="text-xs font-medium text-muted-foreground">Invited email</div>
                          <div className="text-sm font-medium">{invitation.email}</div>
                        </div>
                        <div>
                          <div className="text-xs font-medium text-muted-foreground">Role</div>
                          <div className="text-sm font-medium capitalize">{invitation.role}</div>
                        </div>
                      </div>

                      <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                          <FormField
                            control={form.control}
                            name="fullName"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Full name</FormLabel>
                                <FormControl>
                                  <Input type="text" autoComplete="name" placeholder="Enter your full name" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
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
                            control={form.control}
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

                          <Button type="submit" className="w-full tactile-button" disabled={form.formState.isSubmitting}>
                            {form.formState.isSubmitting ? "Creating account..." : "Create Account"}
                          </Button>
                        </form>
                      </Form>
                    </>
                  )}
                </CardContent>

                <CardFooter className="flex flex-col space-y-3">
                  <div className="text-xs text-muted-foreground text-center">Passwords must be at least 8 characters.</div>
                  <div className="text-xs text-muted-foreground text-center">
                    Already have an account?{" "}
                    <Link href="/auth" className="underline underline-offset-4 text-foreground">
                      Sign in
                    </Link>
                  </div>
                </CardFooter>
              </Card>
            </motion.div>

            <motion.div className="hidden md:block" {...fadeInUp}>
              <div className="text-center md:text-left">
                <h1 className="text-4xl font-bold mb-6">Join your team on ModerateAI</h1>
                <p className="text-xl text-muted-foreground mb-8 max-w-md">
                  You&apos;ll be added as a team member under your inviter&apos;s subscription. You won&apos;t need to choose a tier.
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </main>
    </div>
  );
}
