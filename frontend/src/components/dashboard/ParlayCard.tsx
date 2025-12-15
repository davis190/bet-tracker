import React, { useState } from 'react';
import { Parlay, BetStatus } from '../../types/bet';
import { formatDate } from '../../utils/week';
import { apiClient } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

interface ParlayCardProps {
  bet: Parlay;
  onUpdate?: () => void;
}

export const ParlayCard: React.FC<ParlayCardProps> = ({ bet, onUpdate }) => {
  const { isAuthenticated } = useAuth();
  const [updatingLegId, setUpdatingLegId] = useState<string | null>(null);

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

  const getLegStatus = (leg: { status?: BetStatus }): BetStatus => {
    return leg.status || 'pending';
  };

  const getStatusBadgeClass = (status: BetStatus) => {
    switch (status) {
      case 'won':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'lost':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    }
  };

  const updateLegStatus = async (legId: string, newStatus: BetStatus) => {
    if (!isAuthenticated) return;
    
    setUpdatingLegId(legId);
    try {
      // Create updated legs array
      const updatedLegs = bet.legs.map(leg => 
        leg.id === legId ? { ...leg, status: newStatus } : leg
      );
      
      // Update the parlay with new legs
      await apiClient.updateBet(bet.betId, { legs: updatedLegs });
      
      // Call onUpdate callback to refresh the bet list
      if (onUpdate) {
        onUpdate();
      }
    } catch (error) {
      console.error('Failed to update leg status:', error);
    } finally {
      setUpdatingLegId(null);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border-l-4 border-purple-500">
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <h3 className="text-xl md:text-2xl font-bold mb-2">
            Parlay ({bet.legs.length} legs)
          </h3>
          <div className="text-sm md:text-base text-gray-600 dark:text-gray-400">
            {bet.legs.map(leg => leg.sport).filter((v, i, a) => a.indexOf(v) === i).join(', ')}
          </div>
        </div>
        <div className={`w-4 h-4 rounded-full ${getStatusColor(bet.status)}`}></div>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm md:text-base mb-4">
        <div>
          <span className="text-gray-600 dark:text-gray-400">Date:</span>
          <span className="ml-2">{formatDate(bet.date)}</span>
        </div>
        <div>
          <span className="text-gray-600 dark:text-gray-400">Amount:</span>
          <span className="ml-2 font-semibold">${bet.amount.toFixed(2)}</span>
        </div>
        <div className="col-span-2">
          <span className="text-gray-600 dark:text-gray-400">Potential Payout:</span>
          <span className="ml-2 font-semibold text-lg md:text-xl text-green-600 dark:text-green-400">
            ${bet.potentialPayout.toFixed(2)}
          </span>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-3">
        {bet.legs.map((leg, idx) => {
          const legStatus = getLegStatus(leg);
          const isUpdating = updatingLegId === leg.id;
          
          return (
            <div key={leg.id || idx} className="bg-gray-50 dark:bg-gray-700 rounded p-3">
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1">
                  <div className="font-semibold text-base md:text-lg">{leg.teams}</div>
                  <div className="text-sm md:text-base text-gray-600 dark:text-gray-400">
                    {leg.betType}: {leg.selection}
                  </div>
                  <div className="text-sm md:text-base">
                    Odds: <span className="font-semibold">{leg.odds > 0 ? '+' : ''}{leg.odds}</span>
                  </div>
                </div>
                <div className="ml-4 flex flex-col items-end gap-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusBadgeClass(legStatus)}`}>
                    {legStatus.toUpperCase()}
                  </span>
                  {leg.attributedTo && (
                    <span className="text-xs text-gray-500 dark:text-gray-400 italic">
                      {leg.attributedTo}
                    </span>
                  )}
                  {isAuthenticated && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => updateLegStatus(leg.id, 'won')}
                        disabled={isUpdating || legStatus === 'won'}
                        className={`px-2 py-1 text-xs rounded ${
                          legStatus === 'won'
                            ? 'bg-green-200 text-green-800 dark:bg-green-800 dark:text-green-200 cursor-not-allowed'
                            : 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-800'
                        } disabled:opacity-50`}
                        title="Mark as Won"
                      >
                        {isUpdating ? '...' : 'W'}
                      </button>
                      <button
                        onClick={() => updateLegStatus(leg.id, 'lost')}
                        disabled={isUpdating || legStatus === 'lost'}
                        className={`px-2 py-1 text-xs rounded ${
                          legStatus === 'lost'
                            ? 'bg-red-200 text-red-800 dark:bg-red-800 dark:text-red-200 cursor-not-allowed'
                            : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-800'
                        } disabled:opacity-50`}
                        title="Mark as Lost"
                      >
                        {isUpdating ? '...' : 'L'}
                      </button>
                      {legStatus !== 'pending' && (
                        <button
                          onClick={() => updateLegStatus(leg.id, 'pending')}
                          disabled={isUpdating}
                          className="px-2 py-1 text-xs rounded bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300 hover:bg-yellow-200 dark:hover:bg-yellow-800 disabled:opacity-50"
                          title="Reset to Pending"
                        >
                          {isUpdating ? '...' : 'P'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
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

