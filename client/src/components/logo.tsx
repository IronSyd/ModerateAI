import { MessagesSquare } from "lucide-react";
import { Link } from "wouter";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export const Logo = ({ size = "md", className = "" }: LogoProps) => {
  const sizes = {
    sm: {
      container: "p-1.5",
      icon: "h-4 w-4",
      text: "text-lg",
    },
    md: {
      container: "p-2",
      icon: "h-6 w-6",
      text: "text-2xl",
    },
    lg: {
      container: "p-3",
      icon: "h-8 w-8",
      text: "text-3xl",
    },
  };

  return (
    <Link href="/">
      <div className={`flex items-center cursor-pointer ${className}`}>
        <div className={`rounded-lg bg-primary ${sizes[size].container} mr-2`}>
          <MessagesSquare className={`${sizes[size].icon} text-primary-foreground`} />
        </div>
        <span className={`${sizes[size].text} font-bold`}>ModerateAI</span>
      </div>
    </Link>
  );
};