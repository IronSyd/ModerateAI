import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { 
  MessageSquareMore, 
 
  Send, 
  CheckCircle2,
  Globe,
} from "lucide-react";

type SetupStep = {
  id: string;
  title: string;
  description: string;
  link: string;
  icon: React.ReactNode;
  completed: boolean;
}

type SetupStepsProps = {
  completedSteps: {
    telegramIntegration: boolean;
    discordIntegration: boolean;
    websiteIntegration: boolean;
  };
}

const SetupSteps = ({ completedSteps }: SetupStepsProps) => {
  const setupSteps: SetupStep[] = [
    {
      id: 'telegram-integration',
      title: 'Telegram Integration',
      description: 'Connect to your Telegram groups and channels',
      link: '/integrations/telegram',
      icon: <Send className="h-5 w-5" />,
      completed: completedSteps.telegramIntegration
    },
    {
      id: 'discord-integration',
      title: 'Discord Integration',
      description: 'Add the bot to your Discord server',
      link: '/integrations/discord',
      icon: <MessageSquareMore className="h-5 w-5" />,
      completed: completedSteps.discordIntegration
    },
    {
      id: 'website-integration',
      title: 'Website Integration',
      description: 'Deploy the web widget and start capturing leads',
      link: '/integrations/website',
      icon: <Globe className="h-5 w-5" />,
      completed: completedSteps.websiteIntegration
    }
  ];

  return (
    <div>
      <div className="divide-y glass-divider">
        {setupSteps.map((step) => (
          <div key={step.id} className="p-4 flex items-start">
            <div className={`rounded-full p-2 mr-4 flex-shrink-0 ${
              step.completed 
                ? 'bg-green-600/20 text-green-500 dark:text-green-400 border border-white/10 glass-chip' 
                : 'bg-primary/10 text-primary border border-white/10 glass-chip'
            }`}>
              {step.completed ? <CheckCircle2 className="h-5 w-5" /> : step.icon}
            </div>
            <div className="flex-grow">
              <h4 className="font-medium text-foreground flex items-center">
                {step.title}
                {step.completed && (
                  <span className="ml-2 text-xs bg-green-600/20 text-green-500 dark:text-green-400 py-0.5 px-2 rounded-full glass-chip">
                    Completed
                  </span>
                )}
              </h4>
              <p className="text-sm text-muted-foreground mt-1">{step.description}</p>
              {!step.completed && (
                <Link href={step.link}>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-3 glass-chip"
                  >
                    Set Up Now
                  </Button>
                </Link>
              )}
              {step.completed && (
                <Link href={step.link}>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="mt-3 glass-chip"
                  >
                    Manage
                  </Button>
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SetupSteps;
