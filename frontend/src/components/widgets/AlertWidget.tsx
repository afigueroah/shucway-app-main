import React from 'react';

interface AlertWidgetProps {
  title: string;
  alerts: {
    id: string | number;
    message: string;
    type: 'warning' | 'error' | 'info';
    timestamp?: string;
  }[];
}

const AlertWidget: React.FC<AlertWidgetProps> = ({ title, alerts }) => {
  const getAlertColor = (type: string) => {
    switch (type) {
      case 'warning':
        return 'bg-yellow-100 border-yellow-500 text-yellow-700';
      case 'error':
        return 'bg-red-100 border-red-500 text-red-700';
      case 'info':
        return 'bg-blue-100 border-blue-500 text-blue-700';
      default:
        return 'bg-gray-100 border-gray-500 text-gray-700';
    }
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow-md">
      <h3 className="text-lg font-semibold mb-4">{title}</h3>
      <div className="space-y-3">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className={`p-3 rounded border-l-4 ${getAlertColor(alert.type)}`}
          >
            <p className="text-sm">{alert.message}</p>
            {alert.timestamp && (
              <p className="text-xs mt-1 opacity-75">{alert.timestamp}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default AlertWidget;