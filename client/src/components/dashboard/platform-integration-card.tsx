import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Globe, Plug, Settings2, Wrench } from "lucide-react";
import { SiDiscord, SiTelegram } from "react-icons/si";
import { motion, useReducedMotion } from "framer-motion";

type PlatformType = "telegram" | "discord" | "website";
type PlatformStatus = "active" | "not_connected" | "setup_required" | "inactive";

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
  const shouldReduceMotion = useReducedMotion();
  const integrationHref = `/integrations/${type}`;

  // Get icon based on platform type
  const getPlatformIcon = () => {
    switch (type) {
      case "telegram":
        return <SiTelegram className="h-6 w-6 text-[#229ED9]" />;
      case "discord":
        return <SiDiscord className="h-6 w-6 text-[#5865F2]" />;
      case "website":
        return <Globe className="h-6 w-6 text-primary" />;
    }
  };
  
  // Get status badge color
  const getStatusBadgeClass = () => {
    switch (status) {
      case "active":
        return "bg-green-600/20 text-green-500";
      case "not_connected":
        return "bg-muted/80 text-muted-foreground";
      case "inactive":
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
      case "inactive":
        return "Inactive";
      case "setup_required":
        return "Needs Setup";
    }
  };

  const getPlatformLabel = () => {
    switch (type) {
      case "telegram":
        return "Telegram";
      case "discord":
        return "Discord";
      case "website":
        return "Website";
    }
  };
  
  // Get action button based on status
  const getActionButton = () => {
    const actionButtonClass =
      "h-10 min-w-[156px] rounded-xl px-4 font-semibold glass-chip justify-center";

    switch (status) {
      case "active":
        return (
          <Button
            asChild
            size="sm"
            variant="outline"
            className={`${actionButtonClass} border-white/20 bg-white/[0.03] text-foreground hover:bg-primary/15 hover:text-foreground`}
          >
            <Link href={integrationHref}>
              <Settings2 className="h-4 w-4" />
              Configure
            </Link>
          </Button>
        );
      case "not_connected":
      case "inactive":
        return (
          <Button
            asChild
            size="sm"
            variant="secondary"
            className={`${actionButtonClass} bg-primary/15 text-foreground hover:bg-primary/25`}
          >
            <Link href={integrationHref}>
              <Plug className="h-4 w-4" />
              Connect {getPlatformLabel()}
            </Link>
          </Button>
        );
      case "setup_required":
        return (
          <Button asChild size="sm" className={actionButtonClass}>
            <Link href={integrationHref}>
              <Wrench className="h-4 w-4" />
              Complete Setup
            </Link>
          </Button>
        );
    }
  };
  
  return (
    <motion.div
      className="border-b glass-divider p-6 last:border-b-0 lift-card"
      initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
      whileHover={{ x: 2 }}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start">
          <div className="mr-4 shrink-0 rounded-lg border border-white/10 bg-primary/10 p-3 glass-chip">
            {getPlatformIcon()}
          </div>
          <div className="min-w-0">
            <h3 className="font-medium text-foreground">{name}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:items-end">
          <span className={`inline-flex items-center whitespace-nowrap rounded-full px-3 py-1 text-sm font-medium glass-chip ${getStatusBadgeClass()}`}>
            {getStatusText()}
          </span>
          {getActionButton()}
        </div>
      </div>
    </motion.div>
  );
};

export default PlatformIntegrationCard;
