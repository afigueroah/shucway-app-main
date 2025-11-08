import React from 'react';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  change?: number;
  description?: string;
  colorClass?: string;
}

const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  icon,
  change,
  description,
  colorClass = 'from-blue-500 to-blue-400'
}) => {
  return (
    <div className={`p-4 rounded-lg shadow-md bg-gradient-to-r ${colorClass}`}>
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-white text-sm font-medium mb-1">{title}</h3>
          <div className="text-white text-2xl font-bold mb-2">{value}</div>
          {change !== undefined && (
            <div className={`text-sm ${change >= 0 ? 'text-green-100' : 'text-red-100'}`}>
              {change >= 0 ? '↑' : '↓'} {Math.abs(change)}%
            </div>
          )}
        </div>
        {icon && <div className="text-white text-3xl opacity-80">{icon}</div>}
      </div>
      {description && (
        <p className="mt-2 text-sm text-white opacity-90">{description}</p>
      )}
    </div>
  );
};

export default StatsCard;
