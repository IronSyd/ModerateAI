import React, { createContext, useContext, useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

export type NotificationType = 'message' | 'moderation' | 'system';

export interface Notification {
  id: string;
  title: string;
  description: string;
  time: string;
  read: boolean;
  type: NotificationType;
}

// Initial dummy notifications
const initialNotifications: Notification[] = [
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

interface NotificationsContextProps {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAllNotifications: () => void;
  addNotification: (notification: Omit<Notification, 'id' | 'time' | 'read'>) => void;
  hasNewNotifications: boolean;
  dismissNewNotificationsIndicator: () => void;
}

const NotificationsContext = createContext<NotificationsContextProps | undefined>(undefined);

export const NotificationsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications);
  const [hasNewNotifications, setHasNewNotifications] = useState(true);
  const queryClient = useQueryClient();

  const unreadCount = notifications.filter(n => !n.read).length;

  // Mock API call - in a real app, this would fetch notifications from the server
  const { data: fetchedNotifications } = useQuery({
    queryKey: ['/api/notifications'],
    queryFn: async () => {
      // In a real implementation, this would be an API call
      return initialNotifications;
    },
    // Only refresh every 30 seconds to avoid too many refreshes
    refetchInterval: 30000,
  });

  // Update notifications when fetched
  useEffect(() => {
    if (fetchedNotifications) {
      setNotifications(fetchedNotifications);
      // If there are unread notifications, show the indicator
      if (fetchedNotifications.some(n => !n.read)) {
        setHasNewNotifications(true);
      }
    }
  }, [fetchedNotifications]);

  // Mark a notification as read
  const markAsRead = (id: string) => {
    setNotifications(prev => 
      prev.map(notification => 
        notification.id === id ? { ...notification, read: true } : notification
      )
    );
    
    // In a real implementation, this would be an API call
    // apiRequest(`/api/notifications/${id}/read`, { method: 'POST' });
  };

  // Mark all notifications as read
  const markAllAsRead = () => {
    setNotifications(prev => 
      prev.map(notification => ({ ...notification, read: true }))
    );
    
    // In a real implementation, this would be an API call
    // apiRequest('/api/notifications/read-all', { method: 'POST' });
  };

  // Add a new notification
  const addNotification = (notification: Omit<Notification, 'id' | 'time' | 'read'>) => {
    const newNotification: Notification = {
      ...notification,
      id: Date.now().toString(),
      time: 'Just now',
      read: false
    };
    
    setNotifications(prev => [newNotification, ...prev]);
    setHasNewNotifications(true);
    
    // In a real implementation, this would be handled by push notifications or websockets
    // This is just a simulation for the demo
  };

  // Clear all notifications
  const clearAllNotifications = () => {
    setNotifications([]);
    setHasNewNotifications(false);
    
    // In a real implementation, this would be an API call
    // apiRequest('/api/notifications/clear-all', { method: 'POST' });
  };
  
  // Dismiss the new notifications indicator (pulsing effect)
  const dismissNewNotificationsIndicator = () => {
    setHasNewNotifications(false);
  };

  return (
    <NotificationsContext.Provider
      value={{
        notifications,
        unreadCount,
        markAsRead,
        markAllAsRead,
        clearAllNotifications,
        addNotification,
        hasNewNotifications,
        dismissNewNotificationsIndicator
      }}
    >
      {children}
    </NotificationsContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationsContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationsProvider');
  }
  return context;
};