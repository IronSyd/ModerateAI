import { useLocation } from "wouter";
import { MoreVertical, User, Settings, CreditCard, LogOut } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

const UserProfile = () => {
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  
  if (!user) {
    return null;
  }
  
  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        toast({
          title: "Logged out",
          description: "You have been successfully logged out.",
        });
        setLocation("/");
      }
    });
  };
  
  const navigateTo = (path: string) => {
    setLocation(path);
  };
  
  return (
    <div className="p-4 border-t border-border flex items-center">
      <Avatar>
        <AvatarImage 
          src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80" 
          alt={user.fullName || user.username} 
        />
        <AvatarFallback>{(user.fullName || user.username).charAt(0)}</AvatarFallback>
      </Avatar>
      
      <div className="ml-3">
        <p className="text-sm font-medium text-foreground">{user.fullName || user.username}</p>
        <p className="text-xs text-muted-foreground">{user.role}</p>
      </div>
      
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="ml-auto text-muted-foreground hover:text-foreground">
            <MoreVertical className="h-5 w-5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>My Account</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => navigateTo("/profile")}>
            <User className="mr-2 h-4 w-4" />
            Profile
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigateTo("/preferences")}>
            <Settings className="mr-2 h-4 w-4" />
            Preferences
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigateTo("/billing")}>
            <CreditCard className="mr-2 h-4 w-4" />
            Billing
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export default UserProfile;
