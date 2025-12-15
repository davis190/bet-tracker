import React from 'react';
import { SingleBet } from '../../types/bet';
import { formatDate } from '../../utils/week';

interface BetCardProps {
  bet: SingleBet;
}

export const BetCard: React.FC<BetCardProps> = ({ bet }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'won':
        return 'bg-green-500';
      case 'lost':
        return 'bg-red-500';
      default:
        return 'bg-yellow-500';
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border-l-4 border-indigo-500">
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <h3 className="text-xl md:text-2xl font-bold mb-2">{bet.teams}</h3>
          <div className="text-sm md:text-base text-gray-600 dark:text-gray-400 mb-2">
            {bet.sport} • {bet.betType}
          </div>
          <div className="text-lg md:text-xl font-semibold mb-2">{bet.selection}</div>
        </div>
        <div className={`w-4 h-4 rounded-full ${getStatusColor(bet.status)}`}></div>
      </div>
      
      <div className="grid grid-cols-2 gap-4 text-sm md:text-base">
        <div>
          <span className="text-gray-600 dark:text-gray-400">Odds:</span>
          <span className="ml-2 font-semibold">{bet.odds > 0 ? '+' : ''}{bet.odds}</span>
        </div>
        <div>
          <span className="text-gray-600 dark:text-gray-400">Date:</span>
          <span className="ml-2">{formatDate(bet.date)}</span>
        </div>
        <div>
          <span className="text-gray-600 dark:text-gray-400">Amount:</span>
          <span className="ml-2 font-semibold">${bet.amount.toFixed(2)}</span>
        </div>
        <div>
          <span className="text-gray-600 dark:text-gray-400">Payout:</span>
          <span className="ml-2 font-semibold text-green-600 dark:text-green-400">
            ${bet.potentialPayout.toFixed(2)}
          </span>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
          bet.status === 'won' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
          bet.status === 'lost' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
          'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
        }`}>
          {bet.status.toUpperCase()}
        </span>
        {bet.attributedTo && (
          <span className="text-xs text-gray-500 dark:text-gray-400 italic">
            Bet by: {bet.attributedTo}
          </span>
        )}
      </div>
    </div>
  );
};

