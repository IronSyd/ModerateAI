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

type Notification = {
  id: string;
  title: string;
  description: string;
  time: string;
  read: boolean;
  type: 'message' | 'moderation' | 'system';
};

const demoNotifications: Notification[] = [
  {
    id: '1',
    title: 'New message received',
    description: 'A new message from user John Doe requires attention.',
    time: '2 minutes ago',
    read: false,
    type: 'message'
  },
  {
    id: '2',
    title: 'Content automatically moderated',
    description: 'A message was flagged for inappropriate content in Discord channel.',
    time: '30 minutes ago',
    read: false,
    type: 'moderation'
  },
  {
    id: '3',
    title: 'System update completed',
    description: 'ModerateAI has been updated to version 2.1.0',
    time: '2 hours ago',
    read: true,
    type: 'system'
  },
  {
    id: '4',
    title: 'Training complete',
    description: 'Your custom AI model training has been completed.',
    time: 'Yesterday',
    read: true,
    type: 'system'
  }
];

export function NotificationMenu({ onClose }: { onClose: () => void }) {
  const [notifications, setNotifications] = React.useState<Notification[]>(demoNotifications);
  const unreadCount = notifications.filter(n => !n.read).length;
  
  const markAllAsRead = () => {
    setNotifications(prev => 
      prev.map(notification => ({ ...notification, read: true }))
    );
  };
  
  const markAsRead = (id: string) => {
    setNotifications(prev => 
      prev.map(notification => 
        notification.id === id ? { ...notification, read: true } : notification
      )
    );
  };
  
  const getNotificationIcon = (type: Notification['type']) => {
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
      <div className="absolute right-0 mt-2 w-80 bg-white rounded-md shadow-lg overflow-hidden border border-gray-200">
        <div className="p-3 border-b flex justify-between items-center">
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
        
        <div className="max-h-[400px] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="py-6 text-center text-gray-500">
              <Bell className="h-8 w-8 mx-auto mb-2 text-gray-400" />
              <p>No notifications</p>
            </div>
          ) : (
            notifications.map((notification) => (
              <div 
                key={notification.id}
                className={`p-3 border-b hover:bg-gray-50 cursor-pointer flex items-start ${
                  !notification.read ? 'bg-primary/5' : ''
                }`}
                onClick={() => markAsRead(notification.id)}
              >
                <div className="mr-3">
                  {getNotificationIcon(notification.type)}
                </div>
                <div className="flex-grow min-w-0">
                  <div className="flex justify-between items-start">
                    <h4 className="font-medium truncate">{notification.title}</h4>
                    {!notification.read && (
                      <span className="h-2 w-2 bg-primary rounded-full ml-2 mt-1.5 flex-shrink-0"></span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mt-0.5 line-clamp-2">
                    {notification.description}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{notification.time}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-400 ml-2 mt-1 flex-shrink-0" />
              </div>
            ))
          )}
        </div>
        
        <div className="p-2 border-t bg-gray-50 text-center">
          <button 
            className="text-sm text-primary hover:text-primary/80 font-medium"
            onClick={onClose}
          >
            View all notifications
          </button>
        </div>
      </div>
    </div>
  );
}