import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { Loader2, Check, CreditCard, Download, Info } from "lucide-react";

const BillingPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  const currentPlan = {
    name: "Pro",
    price: 79,
    billingCycle: "monthly",
    features: [
      "Unlimited Conversations",
      "5 Active Platforms",
      "Advanced AI Training",
      "24/7 Support",
      "Custom Knowledge Base",
      "Webhook Integration"
    ],
    currentPeriodEnd: "June 9, 2025"
  };

  const upgradePlan = () => {
    toast({
      title: "Upgrade initiated",
      description: "You will be redirected to the checkout page.",
    });
  };

  const cancelSubscription = () => {
    toast({
      title: "Cancellation request submitted",
      description: "Your subscription will remain active until the current period ends.",
    });
  };

  const downloadInvoice = (invoiceId: string) => {
    toast({
      title: "Invoice download started",
      description: `Invoice #${invoiceId} is being downloaded.`,
    });
  };

  if (!user) {
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="py-6 space-y-6">
        <h1 className="text-3xl font-bold">Billing & Subscription</h1>
        <p className="text-muted-foreground">
          Manage your subscription, payment methods, and billing history.
        </p>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="border-b rounded-none justify-start mb-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="payment-methods">Payment Methods</TabsTrigger>
            <TabsTrigger value="billing-history">Billing History</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle>Current Plan</CardTitle>
                      <CardDescription>
                        Your subscription plan details
                      </CardDescription>
                    </div>
                    <Badge>{currentPlan.name}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Price</span>
                    <span className="text-lg font-bold">${currentPlan.price}/mo</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Billing cycle</span>
                    <span className="text-sm capitalize">{currentPlan.billingCycle}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Next billing date</span>
                    <span className="text-sm">{currentPlan.currentPeriodEnd}</span>
                  </div>
                  
                  <div className="border-t pt-4 mt-4">
                    <h4 className="text-sm font-medium mb-3">Included features:</h4>
                    <ul className="space-y-2">
                      {currentPlan.features.map((feature, index) => (
                        <li key={index} className="flex items-center text-sm">
                          <Check className="h-4 w-4 mr-2 text-green-500" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between">
                  <Button variant="outline" onClick={cancelSubscription}>Cancel Plan</Button>
                  <Button onClick={upgradePlan}>Upgrade Plan</Button>
                </CardFooter>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Usage Overview</CardTitle>
                  <CardDescription>
                    Your current usage and limits
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label>API Calls</Label>
                      <span className="text-sm">13,245 / 50,000</span>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: "26%" }}></div>
                    </div>
                    <p className="text-xs text-muted-foreground">26% of monthly allowance used</p>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label>Storage</Label>
                      <span className="text-sm">2.4 GB / 10 GB</span>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: "24%" }}></div>
                    </div>
                    <p className="text-xs text-muted-foreground">24% of storage limit used</p>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label>Active Platforms</Label>
                      <span className="text-sm">2 / 5</span>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: "40%" }}></div>
                    </div>
                    <p className="text-xs text-muted-foreground">40% of platform limit used</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          <TabsContent value="payment-methods" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Payment Methods</CardTitle>
                <CardDescription>
                  Manage your payment methods and billing information.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="border rounded-md p-4 flex justify-between items-center">
                  <div className="flex items-center">
                    <CreditCard className="h-10 w-10 text-primary mr-4" />
                    <div>
                      <p className="font-medium">Visa ending in 4242</p>
                      <p className="text-sm text-muted-foreground">Expires 04/2026</p>
                    </div>
                  </div>
                  <Badge>Default</Badge>
                </div>
                
                <Button variant="outline" className="w-full">
                  Add Payment Method
                </Button>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Billing Information</CardTitle>
                <CardDescription>
                  Your billing address for invoices.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="company">Company Name</Label>
                    <Input id="company" placeholder="Your company name" defaultValue="Acme Inc." />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vat">VAT Number</Label>
                    <Input id="vat" placeholder="VAT number (optional)" />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Input id="address" placeholder="Your address" defaultValue="123 Main St" />
                </div>
                
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input id="city" placeholder="City" defaultValue="San Francisco" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state">State / Province</Label>
                    <Input id="state" placeholder="State / Province" defaultValue="CA" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="zip">Zip / Postal Code</Label>
                    <Input id="zip" placeholder="Zip / Postal code" defaultValue="94103" />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <Select defaultValue="us">
                    <SelectTrigger id="country">
                      <SelectValue placeholder="Select a country" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="us">United States</SelectItem>
                      <SelectItem value="ca">Canada</SelectItem>
                      <SelectItem value="uk">United Kingdom</SelectItem>
                      <SelectItem value="au">Australia</SelectItem>
                      <SelectItem value="de">Germany</SelectItem>
                      <SelectItem value="fr">France</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <Button>Save Billing Information</Button>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="billing-history" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Billing History</CardTitle>
                <CardDescription>
                  View and download your past invoices.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="border rounded-md divide-y">
                  {[
                    { id: "INV-001", date: "May 9, 2025", amount: 79.00, status: "Paid" },
                    { id: "INV-002", date: "Apr 9, 2025", amount: 79.00, status: "Paid" },
                    { id: "INV-003", date: "Mar 9, 2025", amount: 79.00, status: "Paid" },
                    { id: "INV-004", date: "Feb 9, 2025", amount: 79.00, status: "Paid" },
                  ].map((invoice) => (
                    <div key={invoice.id} className="flex items-center justify-between p-4">
                      <div>
                        <p className="font-medium">Invoice #{invoice.id}</p>
                        <p className="text-sm text-muted-foreground">{invoice.date}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">${invoice.amount.toFixed(2)}</p>
                        <Badge variant="outline" className="ml-2">{invoice.status}</Badge>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => downloadInvoice(invoice.id)}>
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default BillingPage;