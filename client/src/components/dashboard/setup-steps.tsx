import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { 
  Settings, 
  MessageSquareMore, 
  Globe, 
  Send, 
  Database, 
  CreditCard,
  CheckCircle2
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
    websiteIntegration: boolean;
    telegramIntegration: boolean;
    discordIntegration: boolean;
  };
}

const SetupSteps = ({ completedSteps }: SetupStepsProps) => {
  const setupSteps: SetupStep[] = [
    {
      id: 'website-integration',
      title: 'Website Integration',
      description: 'Add the AI chat widget to your website',
      link: '/integrations/website',
      icon: <Globe className="h-5 w-5" />,
      completed: completedSteps.websiteIntegration
    },
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

  ];

  return (
    <div>
      <div className="divide-y divide-border">
        {setupSteps.map((step) => (
          <div key={step.id} className="p-4 flex items-start">
            <div className={`rounded-full p-2 mr-4 flex-shrink-0 ${
              step.completed 
                ? 'bg-green-600/20 text-green-500 dark:text-green-400' 
                : 'bg-primary/10 text-primary'
            }`}>
              {step.completed ? <CheckCircle2 className="h-5 w-5" /> : step.icon}
            </div>
            <div className="flex-grow">
              <h4 className="font-medium text-foreground flex items-center">
                {step.title}
                {step.completed && (
                  <span className="ml-2 text-xs bg-green-600/20 text-green-500 dark:text-green-400 py-0.5 px-2 rounded-full">
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
                    className="mt-3"
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
                    className="mt-3"
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