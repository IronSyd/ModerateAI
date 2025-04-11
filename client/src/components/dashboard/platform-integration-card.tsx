import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Globe, Send, MessageSquareMore } from "lucide-react";

type PlatformType = "website" | "telegram" | "discord";
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
      case "website":
        return <Globe className="h-6 w-6 text-primary-500" />;
      case "telegram":
        return <Send className="h-6 w-6 text-primary-500" />;
      case "discord":
        return <MessageSquareMore className="h-6 w-6 text-primary-500" />;
    }
  };
  
  // Get status badge color
  const getStatusBadgeClass = () => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800";
      case "not_connected":
        return "bg-gray-100 text-gray-800";
      case "setup_required":
        return "bg-yellow-100 text-yellow-800";
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
          <div className="mt-4 flex items-center">
            <Link href={`/integrations/${type}`}>
              <Button variant="link" className="text-sm text-primary-600 font-medium hover:text-primary-700 p-0">
                Configure
              </Button>
            </Link>
            <span className="mx-2 text-gray-300">|</span>
            <Link href={`/integrations/${type}/analytics`}>
              <Button variant="link" className="text-sm text-gray-600 font-medium hover:text-gray-700 p-0">
                View Analytics
              </Button>
            </Link>
          </div>
        );
      case "not_connected":
        return (
          <div className="mt-4">
            <Link href={`/integrations/${type}`}>
              <Button className="px-4 py-2 bg-primary-500 text-white rounded-md text-sm font-medium hover:bg-primary-600">
                Connect {name.split(" ")[0]}
              </Button>
            </Link>
          </div>
        );
      case "setup_required":
        return (
          <div className="mt-4">
            <Link href={`/integrations/${type}`}>
              <Button className="px-4 py-2 bg-primary-500 text-white rounded-md text-sm font-medium hover:bg-primary-600">
                Complete Setup
              </Button>
            </Link>
          </div>
        );
    }
  };
  
  return (
    <div className="border-b border-gray-200 p-6 last:border-b-0">
      <div className="flex items-start justify-between">
        <div className="flex items-center">
          <div className="rounded-lg bg-blue-100 p-3 mr-4">
            {getPlatformIcon()}
          </div>
          <div>
            <h3 className="font-medium text-gray-800">{name}</h3>
            <p className="text-sm text-gray-500 mt-1">{description}</p>
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
