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
  link?: string; // Optional link to navigate to when clicked
}

// Initial dummy notifications
const initialNotifications: Notification[] = [
  {
    id: '1',
    title: 'New message received',
    description: 'A new message from user John Doe requires attention.',
    time: '2 minutes ago',
    read: false,
    type: 'message',
    link: '/conversations'
  },
  {
    id: '2',
    title: 'Content automatically moderated',
    description: 'A message was flagged for inappropriate content in Discord channel.',
    time: '30 minutes ago',
    read: false,
    type: 'moderation',
    link: '/integrations/discord'
  },
  {
    id: '3',
    title: 'System update completed',
    description: 'ModerateAI has been updated to version 2.1.0',
    time: '2 hours ago',
    read: true,
    type: 'system',
    link: '/settings'
  },
  {
    id: '4',
    title: 'Training complete',
    description: 'Your custom AI model training has been completed.',
    time: 'Yesterday',
    read: true,
    type: 'system',
    link: '/ai-configuration'
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

  // Instead of fetching notifications every 30 seconds, we'll use localStorage to persist the read state
  useEffect(() => {
    // Try to get notifications from localStorage
    const storedNotifications = localStorage.getItem('notifications');
    if (storedNotifications) {
      try {
        const parsedNotifications = JSON.parse(storedNotifications);
        setNotifications(parsedNotifications);
        
        // Only set hasNewNotifications if there are unread notifications
        if (parsedNotifications.some((n: Notification) => !n.read)) {
          setHasNewNotifications(true);
        } else {
          setHasNewNotifications(false);
        }
      } catch (e) {
        // If there's an error parsing, use initial notifications
        console.error('Error parsing stored notifications', e);
        setNotifications(initialNotifications);
      }
    } else {
      // If nothing in storage, use initial notifications
      setNotifications(initialNotifications);
    }
  }, []);

  // Save notifications to localStorage
  const saveNotificationsToStorage = (updatedNotifications: Notification[]) => {
    try {
      localStorage.setItem('notifications', JSON.stringify(updatedNotifications));
    } catch (e) {
      console.error('Error saving notifications to localStorage', e);
    }
  };

  // Mark a notification as read
  const markAsRead = (id: string) => {
    setNotifications(prev => {
      const updated = prev.map(notification => 
        notification.id === id ? { ...notification, read: true } : notification
      );
      saveNotificationsToStorage(updated);
      return updated;
    });
    
    // In a real implementation, this would be an API call
    // apiRequest(`/api/notifications/${id}/read`, { method: 'POST' });
  };

  // Mark all notifications as read
  const markAllAsRead = () => {
    setNotifications(prev => {
      const updated = prev.map(notification => ({ ...notification, read: true }));
      saveNotificationsToStorage(updated);
      return updated;
    });
    
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
    
    setNotifications(prev => {
      const updated = [newNotification, ...prev];
      saveNotificationsToStorage(updated);
      return updated;
    });
    setHasNewNotifications(true);
    
    // In a real implementation, this would be handled by push notifications or websockets
    // This is just a simulation for the demo
  };

  // Clear all notifications
  const clearAllNotifications = () => {
    setNotifications([]);
    setHasNewNotifications(false);
    
    // Clear notifications in localStorage
    localStorage.removeItem('notifications');
    
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