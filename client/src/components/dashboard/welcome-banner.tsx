import { Progress } from "@/components/ui/progress";

type WelcomeBannerProps = {
  completedSteps: number;
  totalSteps: number;
  title: string;
  description: string;
};

const WelcomeBanner = ({ 
  completedSteps, 
  totalSteps, 
  title, 
  description 
}: WelcomeBannerProps) => {
  const percentage = (completedSteps / totalSteps) * 100;
  
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
      <div className="px-6 py-5 flex flex-col md:flex-row items-start md:items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
          <p className="mt-1 text-sm text-gray-600">{description}</p>
        </div>
        <div className="mt-4 md:mt-0 flex-shrink-0">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
            {completedSteps}/{totalSteps} Setup Steps Completed
          </span>
        </div>
      </div>
      
      {/* Progress Bar */}
      <Progress value={percentage} className="h-2 rounded-none" />
    </div>
  );
};

export default WelcomeBanner;
