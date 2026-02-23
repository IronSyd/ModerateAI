import { useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

const resetSchema = z
  .object({
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(8, "Please confirm your password"),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

function formatExpires(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString();
}

export default function ResetPasswordPage() {
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const form = useForm<z.infer<typeof resetSchema>>({
    resolver: zodResolver(resetSchema),
    defaultValues: {
      newPassword: "",
      confirmPassword: "",
    },
  });

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/auth");
    }
  }, [isLoading, setLocation, user]);

  useEffect(() => {
    if (!isLoading && user && !(user as any).mustChangePassword) {
      setLocation("/dashboard");
    }
  }, [isLoading, setLocation, user]);

  const resetMutation = useMutation({
    mutationFn: async (values: z.infer<typeof resetSchema>) => {
      const res = await apiRequest("POST", "/api/account/complete-password-reset", values);
      return (await res.json()) as any;
    },
    onSuccess: (payload) => {
      const fallbackUser = user
        ? {
            ...(user as any),
            mustChangePassword: false,
            temporaryPasswordExpiresAt: null,
          }
        : null;
      queryClient.setQueryData(["/api/user"], payload?.user ?? fallbackUser);
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({
        title: "Password updated",
        description: "Your password was reset successfully.",
      });
      setLocation("/dashboard");
    },
    onError: (error: Error) => {
      toast({
        title: "Password reset failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="max-w-xl py-8 space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
    );
  }

  return (
    <div className="max-w-xl py-8">
      <Card className="glass-surface">
        <CardHeader>
          <CardTitle>Set a New Password</CardTitle>
          <CardDescription>
            Your admin issued a temporary password. Create a new password to continue.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((values) => resetMutation.mutate(values))} className="space-y-4">
              <FormField
                control={form.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New password</FormLabel>
                    <FormControl>
                      <PasswordInput autoComplete="new-password" placeholder="Enter a new password" {...field} />
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
                      <PasswordInput autoComplete="new-password" placeholder="Confirm your new password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full tactile-button" disabled={resetMutation.isPending}>
                {resetMutation.isPending ? "Updating password..." : "Update Password"}
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="text-xs text-muted-foreground">
          {formatExpires((user as any)?.temporaryPasswordExpiresAt)
            ? `Temporary password expires at: ${formatExpires((user as any)?.temporaryPasswordExpiresAt)}`
            : "Temporary access may expire soon. Complete this step now."}
        </CardFooter>
      </Card>
    </div>
  );
}
