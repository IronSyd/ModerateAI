import { ReactNode } from "react";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

type StatsCardProps = {
  title: string;
  value: string | number;
  icon: ReactNode;
  iconBgColor: string;
  iconColor: string;
  changeValue: number;
  changeText: string;
};

const StatsCard = ({
  title,
  value,
  icon,
  iconBgColor,
  iconColor,
  changeValue,
  changeText
}: StatsCardProps) => {
  const isPositive = changeValue >= 0;
  
  return (
    <Card className="border border-gray-200">
      <CardContent className="p-6">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-sm font-medium text-gray-500">{title}</p>
            <p className="text-2xl font-semibold text-gray-800 mt-1">{value}</p>
          </div>
          <div className={`rounded-full p-3 ${iconBgColor} ${iconColor}`}>
            {icon}
          </div>
        </div>
        
        <div className="flex items-center mt-4">
          <span className={`flex items-center text-sm font-medium ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
            {isPositive ? (
              <ArrowUpRight className="h-4 w-4 mr-1" />
            ) : (
              <ArrowDownRight className="h-4 w-4 mr-1" />
            )}
            {Math.abs(changeValue)}%
          </span>
          <span className="text-gray-500 text-sm ml-2">{changeText}</span>
        </div>
      </CardContent>
    </Card>
  );
};

export default StatsCard;
