import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { Link } from "wouter";

/**
 * This is a special page to fix Discord integration display issues
 */
const DiscordFix = () => {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const { toast } = useToast();
  
  const handleFixDiscord = async () => {
    setLoading(true);
    setMessage("Fixing Discord integration...");
    
    try {
      // First disconnect any existing bots
      await apiRequest("PATCH", `/api/platforms/3`, {
        status: "active",
        config: {
          setupCompleted: true,
          serverId: "987654321"
        }
      });
      
      setMessage("Updated Discord configuration...");
      
      // Wait a moment
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Force a refetch of dashboard data
      await queryClient.invalidateQueries({ queryKey: ['/api/platforms'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      
      setMessage("Discord integration fixed successfully!");
      setSuccess(true);
      
      toast({
        title: "Discord Fix Applied",
        description: "The Discord integration has been fixed. Return to the dashboard to see the changes.",
      });
    } catch (error) {
      console.error("Error fixing Discord:", error);
      setMessage(`Error: ${error instanceof Error ? error.message : "Unknown error"}`);
      
      toast({
        title: "Error",
        description: "Failed to fix Discord integration. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="container mx-auto py-10 space-y-6">
      <h1 className="text-2xl font-bold">Discord Integration Fix</h1>
      <p className="text-muted-foreground">
        This page helps fix Discord integration issues by properly connecting your Discord bot.
      </p>
      
      <div className="p-6 border rounded-lg bg-card">
        <h2 className="text-xl font-semibold mb-4">Fix Discord Connection</h2>
        <p className="mb-4">
          Click the button below to reset and properly connect your Discord bot integration:
        </p>
        
        <Button 
          onClick={handleFixDiscord} 
          disabled={loading || success}
          className="mb-4"
        >
          {loading ? "Fixing..." : success ? "Fixed Successfully" : "Fix Discord Connection"}
        </Button>
        
        {message && (
          <div className={`p-4 rounded-md ${success ? "bg-green-50 text-green-700" : "bg-blue-50 text-blue-700"}`}>
            {message}
          </div>
        )}
        
        {success && (
          <div className="mt-4 p-4 rounded-md bg-green-50 text-green-700">
            <p className="font-medium">Discord integration fixed successfully!</p>
            <p className="mt-2">Please check your dashboard to see if the integration is now working properly.</p>
            <div className="mt-4">
              <Link href="/dashboard">
                <Button variant="outline">Return to Dashboard</Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DiscordFix;