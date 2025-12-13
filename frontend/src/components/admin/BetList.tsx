import React, { useState, useEffect } from 'react';
import { Bet, isSingleBet, isParlay } from '../../types/bet';
import { apiClient } from '../../services/api';
import { formatDate } from '../../utils/week';

interface BetListProps {
  refreshTrigger: number;
  onRefresh: () => void;
}

export const BetList: React.FC<BetListProps> = ({ refreshTrigger, onRefresh }) => {
  const [bets, setBets] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');

  useEffect(() => {
    loadBets();
  }, [refreshTrigger, statusFilter, typeFilter]);

  const loadBets = async () => {
    setLoading(true);
    try {
      const filters: any = {};
      if (statusFilter) filters.status = statusFilter;
      if (typeFilter) filters.type = typeFilter;
      const data = await apiClient.getBets(filters);
      setBets(data);
    } catch (err) {
      console.error('Failed to load bets:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (betId: string, status: 'won' | 'lost') => {
    try {
      await apiClient.updateBet(betId, { status });
      onRefresh();
    } catch (err) {
      console.error('Failed to update bet:', err);
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'won':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'lost':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading bets...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 items-center">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Status
          </label>
          <select
            className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="won">Won</option>
            <option value="lost">Lost</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Type
          </label>
          <select
            className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="">All</option>
            <option value="single">Single</option>
            <option value="parlay">Parlay</option>
          </select>
        </div>
      </div>

      {bets.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No bets found</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {bets.map((bet) => (
            <div
              key={bet.betId}
              className="border rounded-lg p-4 space-y-2 dark:border-gray-600"
            >
              <div className="flex justify-between items-start">
                <span className={`px-2 py-1 rounded text-xs font-semibold ${getStatusBadgeClass(bet.status)}`}>
                  {bet.status.toUpperCase()}
                </span>
                <span className="text-xs text-gray-500">{formatDate(bet.date)}</span>
              </div>

              {isSingleBet(bet) && (
                <div>
                  <div className="font-semibold">{bet.teams}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {bet.sport} • {bet.betType}
                  </div>
                  <div className="text-sm">{bet.selection}</div>
                  <div className="text-sm">Odds: {bet.odds > 0 ? '+' : ''}{bet.odds}</div>
                  <div className="text-sm">Amount: ${bet.amount.toFixed(2)}</div>
                  <div className="text-sm font-semibold text-green-600 dark:text-green-400">
                    Payout: ${bet.potentialPayout.toFixed(2)}
                  </div>
                </div>
              )}

              {isParlay(bet) && (
                <div>
                  <div className="font-semibold">Parlay ({bet.legs.length} legs)</div>
                  <div className="text-sm">Amount: ${bet.amount.toFixed(2)}</div>
                  <div className="text-sm font-semibold text-green-600 dark:text-green-400">
                    Payout: ${bet.potentialPayout.toFixed(2)}
                  </div>
                  <details className="mt-2">
                    <summary className="text-sm cursor-pointer text-indigo-600 dark:text-indigo-400">
                      View Legs
                    </summary>
                    <div className="mt-2 space-y-2 pl-4 border-l-2">
                      {bet.legs.map((leg, idx) => (
                        <div key={leg.id || idx} className="text-sm">
                          <div>{leg.teams}</div>
                          <div className="text-gray-600 dark:text-gray-400">
                            {leg.betType}: {leg.selection} ({leg.odds > 0 ? '+' : ''}{leg.odds})
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
                </div>
              )}

              {bet.status === 'pending' && (
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => handleStatusUpdate(bet.betId, 'won')}
                    className="flex-1 px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    Won
                  </button>
                  <button
                    onClick={() => handleStatusUpdate(bet.betId, 'lost')}
                    className="flex-1 px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    Lost
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

