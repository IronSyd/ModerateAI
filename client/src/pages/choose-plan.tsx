import { useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle } from "lucide-react";
import { getSupportTelegramUrl } from "@/lib/support";

type Plan = "free" | "standard" | "pro";

export default function ChoosePlanPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { user, isLoading } = useAuth();
  const supportUrl = getSupportTelegramUrl();

  const planSelectedAt = (user as any)?.planSelectedAt ?? null;
  const isAdmin = user?.role === "admin" || user?.role === "owner";
  const isWorkspaceMember = Boolean((user as any)?.workspaceOwnerId);

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/auth");
      return;
    }

    // If the user has already selected a plan, skip onboarding.
    if (!isLoading && user && (isAdmin || isWorkspaceMember || planSelectedAt)) {
      setLocation("/dashboard");
    }
  }, [isAdmin, isLoading, isWorkspaceMember, planSelectedAt, setLocation, user]);

  const selectPlanMutation = useMutation({
    mutationFn: async (plan: Plan) => {
      const res = await apiRequest("POST", "/api/billing/select-plan", { plan });
      return (await res.json()) as any;
    },
    onSuccess: (updatedUser) => {
      queryClient.setQueryData(["/api/user"], updatedUser);
      queryClient.invalidateQueries({ queryKey: ["/api/billing/status"] });
      toast({
        title: "Plan selected",
        description: "You're all set. Welcome to ModerateAI.",
      });
      setLocation("/dashboard");
    },
    onError: (error: Error) => {
      toast({
        title: "Could not select plan",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const isBusy = selectPlanMutation.isPending || isLoading;

  return (
    <div className="py-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold">Choose your plan</h1>
          <p className="text-muted-foreground mt-2">
            Free is self-serve and can start capturing leads immediately via the web widget. Standard and Pro are activated by support after payment.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <Card className="surface-glow lift-card glass-surface">
            <CardHeader>
              <CardTitle>Free</CardTitle>
              <CardDescription>$0/month</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>20 AI responses/day (600/month)</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Telegram, Discord, and web widget with lead capture</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>1 team seat</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Basic moderation presets</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>7-day conversation history</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>10MB knowledge base storage</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Community support (no SLA)</span>
                </li>
              </ul>

              <Button
                variant="outline"
                className="w-full glass-chip tactile-button"
                disabled={isBusy}
                onClick={() => selectPlanMutation.mutate("free")}
              >
                Continue on Free
              </Button>
            </CardContent>
          </Card>

          <Card className="border-2 border-primary surface-glow lift-card glass-surface">
            <CardHeader>
              <CardTitle>Standard</CardTitle>
              <CardDescription>$80/month (activation via support)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>2,500 AI responses/day (75,000/month)</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Telegram, Discord, and web widget with lead capture</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Up to 5 team seats</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Custom moderation rules</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Sentiment analysis</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>90-day conversation history</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>250MB knowledge base storage</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Standard analytics dashboard</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Email support (first response within 24h)</span>
                </li>
              </ul>

              <Button asChild className="w-full glass-chip tactile-button" disabled={isBusy}>
                <a href={supportUrl} target="_blank" rel="noreferrer">
                  Contact Support
                </a>
              </Button>
            </CardContent>
          </Card>

          <Card className="surface-glow lift-card glass-surface">
            <CardHeader>
              <CardTitle>Pro</CardTitle>
              <CardDescription>$150/month (activation via support)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>6,000 AI responses/day (180,000/month)</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Telegram, Discord, and web widget with lead capture</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Up to 20 team seats</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Advanced moderation automation</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Deep analytics, data export, and audit log</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>365-day conversation history</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>1,000MB knowledge base storage</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>24/7 priority support (first response within 2h)</span>
                </li>
              </ul>

              <Button asChild className="w-full glass-chip tactile-button" disabled={isBusy}>
                <a href={supportUrl} target="_blank" rel="noreferrer">
                  Contact Support
                </a>
              </Button>
            </CardContent>
          </Card>
        </div>

        {selectPlanMutation.isPending && (
          <p className="text-sm text-muted-foreground mt-6">Saving your plan selection...</p>
        )}
      </div>
    </div>
  );
}
