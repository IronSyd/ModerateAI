import { useState } from "react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp } from "lucide-react";
import SetupSteps from "./setup-steps";

type WelcomeBannerProps = {
  completedSteps: number;
  totalSteps: number;
  title: string;
  description: string;
  setupProgress: {
    telegramIntegration: boolean;
    discordIntegration: boolean;
    websiteIntegration: boolean;
  };
};

const WelcomeBanner = ({ 
  completedSteps, 
  totalSteps, 
  title, 
  description,
  setupProgress
}: WelcomeBannerProps) => {
  const [showSetupSteps, setShowSetupSteps] = useState(false);
  const percentage = (completedSteps / totalSteps) * 100;
  
  return (
    <div className="rounded-2xl shadow-sm mb-6 surface-glow glass-surface overflow-hidden">
      <div className="px-6 py-5 flex flex-col md:flex-row items-start md:items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="mt-4 md:mt-0 flex-shrink-0">
          <Button 
            variant="ghost" 
            className="px-3 py-1 h-auto rounded-full bg-yellow-600/20 hover:bg-yellow-600/30 text-sm font-medium text-yellow-500 flex items-center gap-1 glass-chip"
            onClick={() => setShowSetupSteps(!showSetupSteps)}
          >
            {completedSteps}/{totalSteps} Setup Steps Completed
            {showSetupSteps ? (
              <ChevronUp className="h-4 w-4 ml-1" />
            ) : (
              <ChevronDown className="h-4 w-4 ml-1" />
            )}
          </Button>
        </div>
      </div>
      
      {/* Progress Bar */}
      <Progress value={percentage} className="h-2 rounded-none bg-border border-t-0 glass-divider" />
      
      {/* Setup Steps */}
      {showSetupSteps && completedSteps < totalSteps && (
        <div className="border-t glass-divider">
          <SetupSteps completedSteps={setupProgress} />
        </div>
      )}
    </div>
  );
};

export default WelcomeBanner;
