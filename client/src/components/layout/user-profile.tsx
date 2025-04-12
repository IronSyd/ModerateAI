import { useState } from "react";
import { MoreVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const UserProfile = () => {
  const [user] = useState({
    name: "Demo User",
    role: "Admin",
    imageUrl: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
  });
  
  return (
    <div className="p-4 border-t border-border flex items-center">
      <Avatar>
        <AvatarImage src={user.imageUrl} alt={user.name} />
        <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
      </Avatar>
      
      <div className="ml-3">
        <p className="text-sm font-medium text-foreground">{user.name}</p>
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
          <DropdownMenuItem>Profile</DropdownMenuItem>
          <DropdownMenuItem>Preferences</DropdownMenuItem>
          <DropdownMenuItem>Billing</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem>Log out</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export default UserProfile;
