import React from "react";
import { 
  Bell, 
  Check, 
  ChevronRight, 
  Megaphone, 
  MessageSquare, 
  ShieldAlert,
  X
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useNotifications, Notification, NotificationType } from "@/hooks/use-notifications";
import { useLocation } from "wouter";

export function NotificationMenu({ onClose }: { onClose: () => void }) {
  const { 
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    dismissNewNotificationsIndicator,
    addNotification,
    clearAllNotifications
  } = useNotifications();
  
  const [, navigate] = useLocation();
  
  // When opening the menu, clear the "new notifications" indicator
  React.useEffect(() => {
    dismissNewNotificationsIndicator();
  }, [dismissNewNotificationsIndicator]);
  
  const getNotificationIcon = (type: NotificationType) => {
    switch (type) {
      case 'message':
        return <MessageSquare className="h-5 w-5 text-blue-500" />;
      case 'moderation':
        return <ShieldAlert className="h-5 w-5 text-red-500" />;
      case 'system':
        return <Megaphone className="h-5 w-5 text-purple-500" />;
      default:
        return <Bell className="h-5 w-5 text-gray-500" />;
    }
  };
  
  return (
    <div className="relative z-50">
      <div className="fixed inset-0" onClick={onClose}></div>
      <div className="absolute right-0 mt-2 w-80 bg-card rounded-md shadow-lg overflow-hidden border border-border">
        <div className="p-3 border-b">
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center">
              <h3 className="text-lg font-semibold">Notifications</h3>
              {unreadCount > 0 && (
                <Badge className="ml-2 bg-primary" variant="default">
                  {unreadCount} new
                </Badge>
              )}
            </div>
            <button 
              onClick={markAllAsRead}
              className="text-xs text-primary hover:text-primary/80"
              disabled={unreadCount === 0}
            >
              Mark all as read
            </button>
          </div>
          
          <div className="flex justify-end">
            <button 
              onClick={clearAllNotifications}
              className="text-xs text-destructive hover:text-destructive/80 flex items-center"
              disabled={notifications.length === 0}
            >
              <X className="h-3 w-3 mr-1" />
              Clear all notifications
            </button>
          </div>
        </div>
        
        <div className="max-h-[400px] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="py-6 text-center text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p>No notifications</p>
            </div>
          ) : (
            notifications.map((notification) => (
              <div 
                key={notification.id}
                className={`p-3 border-b hover:bg-accent cursor-pointer flex items-start ${
                  !notification.read ? 'bg-primary/10' : ''
                }`}
                onClick={() => {
                  // Mark as read
                  markAsRead(notification.id);
                  
                  // Navigate to the linked page if available
                  if (notification.link) {
                    navigate(notification.link);
                    onClose(); // Close the notification menu
                  }
                }}
              >
                <div className="mr-3">
                  {getNotificationIcon(notification.type)}
                </div>
                <div className="flex-grow min-w-0">
                  <div className="flex justify-between items-start">
                    <h4 className="font-medium truncate text-foreground">{notification.title}</h4>
                    {!notification.read && (
                      <span className="h-2 w-2 bg-primary rounded-full ml-2 mt-1.5 flex-shrink-0"></span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                    {notification.description}
                  </p>
                  <p className="text-xs text-muted-foreground/70 mt-1">{notification.time}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground ml-2 mt-1 flex-shrink-0" />
              </div>
            ))
          )}
        </div>
        
        <div className="p-2 border-t bg-muted/50 flex justify-center">
          <button 
            className="text-sm text-primary hover:text-primary/80 font-medium"
            onClick={() => {
              // Create a random notification
              const types: NotificationType[] = ['message', 'moderation', 'system'];
              const randomType = types[Math.floor(Math.random() * types.length)];
              
              // Add the notification using the function from the hook we already initialized
              // Create appropriate link based on notification type
              let link = '/dashboard';
              
              if (randomType === 'message') {
                link = '/conversations';
              } else if (randomType === 'moderation') {
                link = '/integrations/telegram';
              } else if (randomType === 'system') {
                link = '/settings';
              }
              
              addNotification({
                title: `New ${randomType} notification`,
                description: `This is a test ${randomType} notification added at ${new Date().toLocaleTimeString()}`,
                type: randomType,
                link: link
              });
            }}
          >
            Add Test Notification
          </button>
        </div>
      </div>
    </div>
  );
}