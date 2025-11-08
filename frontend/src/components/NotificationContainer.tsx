// ================================================================
// 🔔 COMPONENTE DE NOTIFICACIONES
// ================================================================

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IoCheckmarkCircle, IoCloseCircle, IoWarning, IoInformationCircle, IoClose } from 'react-icons/io5';
import { Notification } from '../hooks/useNotifications';

interface NotificationItemProps {
  notification: Notification;
  onClose: (id: string) => void;
}

const NotificationItem: React.FC<NotificationItemProps> = ({ notification, onClose }) => {
  const getIcon = () => {
    switch (notification.type) {
      case 'success':
        return <IoCheckmarkCircle className="text-green-500" size={24} />;
      case 'error':
        return <IoCloseCircle className="text-red-500" size={24} />;
      case 'warning':
        return <IoWarning className="text-yellow-500" size={24} />;
      case 'info':
        return <IoInformationCircle className="text-blue-500" size={24} />;
      default:
        return <IoInformationCircle className="text-blue-500" size={24} />;
    }
  };

  const getBgColor = () => {
    switch (notification.type) {
      case 'success':
        return 'bg-green-50 border-green-200';
      case 'error':
        return 'bg-red-50 border-red-200';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200';
      case 'info':
        return 'bg-blue-50 border-blue-200';
      default:
        return 'bg-blue-50 border-blue-200';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -50, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={`relative p-4 rounded-lg border shadow-lg ${getBgColor()} max-w-sm w-full`}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          {getIcon()}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-gray-900 truncate">
            {notification.title}
          </h4>
          {notification.message && (
            <p className="text-sm text-gray-700 mt-1">
              {notification.message}
            </p>
          )}
        </div>
        <button
          onClick={() => onClose(notification.id)}
          className="flex-shrink-0 p-1 rounded-full hover:bg-black/5 transition-colors"
        >
          <IoClose size={16} className="text-gray-400" />
        </button>
      </div>
    </motion.div>
  );
};

interface NotificationContainerProps {
  notifications: Notification[];
  onClose: (id: string) => void;
}

export const NotificationContainer: React.FC<NotificationContainerProps> = ({
  notifications,
  onClose,
}) => {
  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      <AnimatePresence>
        {notifications.map((notification) => (
          <NotificationItem
            key={notification.id}
            notification={notification}
            onClose={onClose}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};

export default NotificationContainer;