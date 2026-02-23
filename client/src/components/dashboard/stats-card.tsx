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
        <CardContent className="p-6">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-muted-foreground">{title}</p>
              <p className="text-2xl font-semibold text-foreground mt-1">{value}</p>
            </div>
            <div className={`rounded-full p-3 ${iconBgColor} ${iconColor}`}>
              {icon}
            </div>
          </div>

          {changeValue !== null && (
            <div className="flex items-center mt-4">
              <span className={`flex items-center text-sm font-medium ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                {isPositive ? (
                  <ArrowUpRight className="h-4 w-4 mr-1" />
                ) : (
                  <ArrowDownRight className="h-4 w-4 mr-1" />
                )}
                {Math.abs(changeValue)}%
              </span>
              <span className="text-muted-foreground text-sm ml-2">{changeText}</span>
            </div>
          )}

          {changeValue === null && statusLabel && (
            <div className={`mt-4 text-sm font-medium ${statusToneClass}`}>{statusLabel}</div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default StatsCard;
