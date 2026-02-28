import { ReactNode } from "react";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";

type StatsCardProps = {
  title: string;
  value: string | number;
  icon: ReactNode;
  iconBgColor: string;
  iconColor: string;
  changeValue: number | null;
  changeText: string;
  statusLabel?: string;
  statusTone?: "neutral" | "success" | "warning" | "danger";
  delay?: number;
};

const StatsCard = ({
  title,
  value,
  icon,
  iconBgColor,
  iconColor,
  changeValue,
  changeText,
  statusLabel,
  statusTone = "neutral",
  delay = 0
}: StatsCardProps) => {
  const isPositive = changeValue !== null && changeValue >= 0;
  const statusToneClass =
    statusTone === "danger"
      ? "text-red-300"
      : statusTone === "warning"
        ? "text-amber-300"
        : statusTone === "success"
          ? "text-emerald-300"
          : "text-muted-foreground";
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, delay, ease: "easeOut" }}
      whileHover={{ y: -3, scale: 1.01 }}
      className="h-full"
    >
      <Card className="surface-glow lift-card h-full glass-surface">
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-medium text-muted-foreground">{title}</p>
              <p className="mt-1 text-lg sm:text-2xl lg:text-xl xl:text-2xl font-semibold text-foreground leading-tight whitespace-normal break-normal">
                {value}
              </p>
            </div>
            <div className={`shrink-0 rounded-full p-2.5 sm:p-3 ${iconBgColor} ${iconColor}`}>
              {icon}
            </div>
          </div>

          {changeValue !== null && (
            <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className={`flex items-center text-sm font-medium ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                {isPositive ? (
                  <ArrowUpRight className="h-4 w-4 mr-1" />
                ) : (
                  <ArrowDownRight className="h-4 w-4 mr-1" />
                )}
                {Math.abs(changeValue)}%
              </span>
              <span className="text-muted-foreground text-xs sm:text-sm">{changeText}</span>
            </div>
          )}

          {changeValue === null && statusLabel && (
            <div className={`mt-4 text-xs sm:text-sm font-medium break-words ${statusToneClass}`}>{statusLabel}</div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default StatsCard;
