import React, { useState, useEffect } from 'react';
import { Bet, isSingleBet, isParlay } from '../types/bet';
import { apiClient } from '../services/api';
import { BetCard } from '../components/dashboard/BetCard';
import { ParlayCard } from '../components/dashboard/ParlayCard';
import { StatsOverview } from '../components/dashboard/StatsOverview';
import { LoadingSpinner } from '../components/shared/LoadingSpinner';

export const Dashboard: React.FC = () => {
  const [bets, setBets] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadBets();
  }, []);

  const loadBets = async () => {
    try {
      const data = await apiClient.getBets();
      setBets(data);
    } catch (err: any) {
      setError('Failed to load bets. Please ensure you are logged in.');
      console.error('Failed to load bets:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  const singleBets = bets.filter(isSingleBet);
  const parlays = bets.filter(isParlay);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold">Bet Tracker Dashboard</h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <StatsOverview bets={bets} />

        <div className="mt-12">
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-6">All Bets</h2>
          
          {bets.length === 0 ? (
            <div className="text-center py-12 text-gray-500 text-lg md:text-xl">
              No bets to display
            </div>
          ) : (
            <div className="space-y-8">
              {singleBets.length > 0 && (
                <div>
                  <h3 className="text-xl md:text-2xl font-semibold mb-4">Single Bets</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {singleBets.map((bet) => (
                      <BetCard key={bet.betId} bet={bet} />
                    ))}
                  </div>
                </div>
              )}

              {parlays.length > 0 && (
                <div>
                  <h3 className="text-xl md:text-2xl font-semibold mb-4">Parlays</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {parlays.map((bet) => (
                      <ParlayCard key={bet.betId} bet={bet} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

