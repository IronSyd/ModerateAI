import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";

const DiscordFix = () => {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  
  const handleFixDiscord = async () => {
    setLoading(true);
    setMessage("Fixing Discord integration...");
    
    try {
      // First disconnect any existing bots
      await apiRequest("PATCH", `/api/platforms/3`, {
        status: "not_connected",
        authToken: null
      });
      
      setMessage("Disconnected existing bot...");
      
      // Wait a moment
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Now reconnect with the environment token
      const result = await apiRequest("PATCH", `/api/platforms/3`, {
        status: "active",
        authToken: import.meta.env.VITE_DISCORD_BOT_TOKEN || "",
        config: {
          setupCompleted: true
        }
      });
      
      setMessage("Discord bot connected successfully!");
      setSuccess(true);
    } catch (error) {
      console.error("Error fixing Discord:", error);
      setMessage(`Error: ${error instanceof Error ? error.message : "Unknown error"}`);
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
          </div>
        )}
      </div>
    </div>
  );
};

export default DiscordFix;