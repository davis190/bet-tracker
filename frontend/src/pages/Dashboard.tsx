import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Bet, isSingleBet, isParlay } from '../types/bet';
import { apiClient } from '../services/api';
import { BetCard } from '../components/dashboard/BetCard';
import { ParlayCard } from '../components/dashboard/ParlayCard';
import { LoadingSpinner } from '../components/shared/LoadingSpinner';
import { useAuth } from '../contexts/AuthContext';

export const Dashboard: React.FC = () => {
  const [bets, setBets] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    loadBets();
  }, []);

  const loadBets = async () => {
    try {
      const data = await apiClient.getBets();
      setBets(data);
    } catch (err: any) {
      setError('Failed to load bets. Please try again later.');
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
          <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
          {!isAuthenticated && (
            <Link
              to="/login"
              className="inline-block px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Login to Manage Bets
            </Link>
          )}
        </div>
      </div>
    );
  }

  // Filter to only show open (pending) bets
  const openBets = bets.filter(bet => bet.status === 'pending');
  const singleBets = openBets.filter(isSingleBet);
  const parlays = openBets.filter(isParlay);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold">Bet Tracker Dashboard</h1>
            {isAuthenticated ? (
              <Link
                to="/admin"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Manage Bets
              </Link>
            ) : (
              <Link
                to="/login"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Login to Manage
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {openBets.length === 0 ? (
          <div className="text-center py-12 text-gray-500 text-lg md:text-xl">
            No open bets to display
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
      </main>
    </div>
  );
};

