import React from 'react';
import { Banknote, CreditCard, Landmark, Gift, Star } from 'lucide-react';

export const MetodoIcon: React.FC<{ metodo: string; className?: string }> = ({ metodo, className = 'w-4 h-4' }) => {
  switch (metodo) {
    case 'Efectivo':
    case 'Cash':
      return <Banknote className={className} strokeWidth={2} />;
    case 'Tarjeta':
      return <CreditCard className={className} strokeWidth={2} />;
    case 'Transferencia':
      return <Landmark className={className} strokeWidth={2} />;
    case 'Canje':
      return <Star className={className} strokeWidth={2} />;
    case 'Cupon':
      return <Gift className={className} strokeWidth={2} />;
    default:
      return <Banknote className={className} strokeWidth={2} />;
  }
};

export default MetodoIcon;
