import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Bet, isSingleBet, isParlay, Parlay } from '../types/bet';
import { apiClient } from '../services/api';
import { BetCard } from '../components/dashboard/BetCard';
import { ParlayCard } from '../components/dashboard/ParlayCard';
import { LoadingSpinner } from '../components/shared/LoadingSpinner';
import { useAuth } from '../contexts/AuthContext';

export const Dashboard: React.FC = () => {
  const [bets, setBets] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attributionFilter, setAttributionFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
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

  // Extract all unique attribution values from bets
  const getAllAttributions = (): string[] => {
    const attributions = new Set<string>();
    
    bets.forEach((bet) => {
      if (isSingleBet(bet) && bet.attributedTo) {
        attributions.add(bet.attributedTo);
      } else if (isParlay(bet)) {
        if (bet.attributedTo) {
          attributions.add(bet.attributedTo);
        }
        bet.legs.forEach((leg) => {
          if (leg.attributedTo) {
            attributions.add(leg.attributedTo);
          }
        });
      }
    });
    
    return Array.from(attributions).sort();
  };

  // Helper function to check if a parlay has any pending leg
  const hasPendingLeg = (parlay: Parlay): boolean => {
    return parlay.legs.some((leg) => !leg.status || leg.status === 'pending');
  };

  // Filter bets based on status
  const filterBetsByStatus = (betsToFilter: Bet[]): Bet[] => {
    if (!statusFilter) {
      return betsToFilter;
    }

    return betsToFilter.filter((bet) => {
      if (isSingleBet(bet)) {
        // Single bet: match if status matches
        return bet.status === statusFilter;
      } else if (isParlay(bet)) {
        // For pending: match if parlay status is pending OR any leg is pending
        if (statusFilter === 'pending') {
          return bet.status === 'pending' || hasPendingLeg(bet);
        }
        // For won/lost: match if parlay status matches
        return bet.status === statusFilter;
      }
      return false;
    });
  };

  // Filter bets based on attribution
  const filterBetsByAttribution = (betsToFilter: Bet[]): Bet[] => {
    if (!attributionFilter) {
      return betsToFilter;
    }

    return betsToFilter.filter((bet) => {
      if (isSingleBet(bet)) {
        // Single bet: match if attributedTo matches
        return bet.attributedTo === attributionFilter;
      } else if (isParlay(bet)) {
        // Parlay: match if parlay's attributedTo matches OR any leg's attributedTo matches
        if (bet.attributedTo === attributionFilter) {
          return true;
        }
        return bet.legs.some((leg) => leg.attributedTo === attributionFilter);
      }
      return false;
    });
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

  // Filter bets by status first, then by attribution
  const filteredBets = filterBetsByAttribution(filterBetsByStatus(bets));
  
  // Separate featured and non-featured bets
  const featuredBets = filteredBets.filter(bet => bet.featured === true);
  const nonFeaturedBets = filteredBets.filter(bet => !bet.featured);
  
  // Split non-featured bets by type
  const singleBets = nonFeaturedBets.filter(isSingleBet);
  const parlays = nonFeaturedBets.filter(isParlay);
  
  const allAttributions = getAllAttributions();

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
        {bets.length === 0 ? (
          <div className="text-center py-12 text-gray-500 text-lg md:text-xl">
            No bets to display
          </div>
        ) : (
          <div className="space-y-8">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
              <div className="flex flex-wrap gap-4 items-center">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Filter by Status:
                </label>
                <select
                  className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="won">Won</option>
                  <option value="lost">Lost</option>
                </select>
                {statusFilter && (
                  <button
                    onClick={() => setStatusFilter('')}
                    className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 underline"
                  >
                    Clear Status Filter
                  </button>
                )}
                {allAttributions.length > 0 && (
                  <>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 ml-4">
                      Filter by Attribution:
                    </label>
                    <select
                      className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      value={attributionFilter}
                      onChange={(e) => setAttributionFilter(e.target.value)}
                    >
                      <option value="">All Bets</option>
                      {allAttributions.map((attr) => (
                        <option key={attr} value={attr}>
                          {attr}
                        </option>
                      ))}
                    </select>
                    {attributionFilter && (
                      <button
                        onClick={() => setAttributionFilter('')}
                        className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 underline"
                      >
                        Clear Attribution Filter
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
            
            {/* Featured Bets Section */}
            {featuredBets.length > 0 && (
              <div className="mb-8">
                <h2 className="text-2xl md:text-3xl font-bold mb-6 flex items-center gap-2">
                  ⭐ Featured Bets {attributionFilter && `(${featuredBets.length})`}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {featuredBets.map((bet) => (
                    isSingleBet(bet) ? (
                      <BetCard key={bet.betId} bet={bet} />
                    ) : (
                      <ParlayCard key={bet.betId} bet={bet} onUpdate={loadBets} />
                    )
                  ))}
                </div>
              </div>
            )}
            
            {/* Non-Featured Bets Section */}
            {singleBets.length > 0 && (
              <div>
                <h3 className="text-xl md:text-2xl font-semibold mb-4">
                  Single Bets {attributionFilter && `(${singleBets.length})`}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {singleBets.map((bet) => (
                    <BetCard key={bet.betId} bet={bet} />
                  ))}
                </div>
              </div>
            )}

            {parlays.length > 0 && (
              <div>
                <h3 className="text-xl md:text-2xl font-semibold mb-4">
                  Parlays {attributionFilter && `(${parlays.length})`}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {parlays.map((bet) => (
                    <ParlayCard key={bet.betId} bet={bet} onUpdate={loadBets} />
                  ))}
                </div>
              </div>
            )}

            {(statusFilter || attributionFilter) && featuredBets.length === 0 && singleBets.length === 0 && parlays.length === 0 && (
              <div className="text-center py-12 text-gray-500 text-lg md:text-xl">
                {statusFilter && attributionFilter 
                  ? `No bets found for status "${statusFilter}" and attribution "${attributionFilter}"`
                  : statusFilter
                  ? `No bets found for status "${statusFilter}"`
                  : `No bets found for attribution "${attributionFilter}"`
                }
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

