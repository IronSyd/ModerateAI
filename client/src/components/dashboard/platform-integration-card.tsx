import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Globe, Send, MessageSquareMore } from "lucide-react";

type PlatformType = "telegram" | "discord";
type PlatformStatus = "active" | "not_connected" | "setup_required";

type PlatformIntegrationCardProps = {
  type: PlatformType;
  name: string;
  description: string;
  status: PlatformStatus;
};

const PlatformIntegrationCard = ({
  type,
  name,
  description,
  status
}: PlatformIntegrationCardProps) => {
  // Get icon based on platform type
  const getPlatformIcon = () => {
    switch (type) {
      case "telegram":
        return <Send className="h-6 w-6 text-primary" />;
      case "discord":
        return <MessageSquareMore className="h-6 w-6 text-primary" />;
    }
  };
  
  // Get status badge color
  const getStatusBadgeClass = () => {
    switch (status) {
      case "active":
        return "bg-green-600/20 text-green-500";
      case "not_connected":
        return "bg-muted/80 text-muted-foreground";
      case "setup_required":
        return "bg-yellow-600/20 text-yellow-500";
    }
  };
  
  // Get status text
  const getStatusText = () => {
    switch (status) {
      case "active":
        return "Active";
      case "not_connected":
        return "Not Connected";
      case "setup_required":
        return "Setup Required";
    }
  };
  
  // Get action button based on status
  const getActionButton = () => {
    switch (status) {
      case "active":
        return (
          <div className="mt-4">
            <Link href={`/integrations/${type}`}>
              <Button variant="link" className="text-sm font-medium p-0">
                Configure
              </Button>
            </Link>
          </div>
        );
      case "not_connected":
        return (
          <div className="mt-4">
            <Link href={`/integrations/${type}`}>
              <Button>
                Connect {name.split(" ")[0]}
              </Button>
            </Link>
          </div>
        );
      case "setup_required":
        return (
          <div className="mt-4">
            <Link href={`/integrations/${type}`}>
              <Button>
                Complete Setup
              </Button>
            </Link>
          </div>
        );
    }
  };
  
  return (
    <div className="border-b border-border p-6 last:border-b-0">
      <div className="flex items-start justify-between">
        <div className="flex items-center">
          <div className="rounded-lg bg-primary/10 p-3 mr-4">
            {getPlatformIcon()}
          </div>
          <div>
            <h3 className="font-medium text-foreground">{name}</h3>
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          </div>
        </div>
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusBadgeClass()}`}>
          {getStatusText()}
        </span>
      </div>
      
      {getActionButton()}
    </div>
  );
};

export default PlatformIntegrationCard;
