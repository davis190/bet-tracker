import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { BetForm } from '../components/admin/BetForm';
import { ParlayForm } from '../components/admin/ParlayForm';
import { BetList } from '../components/admin/BetList';
import { ClearWeekButton } from '../components/admin/ClearWeekButton';
import { useNavigate } from 'react-router-dom';

export const Admin: React.FC = () => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'add' | 'manage'>('add');
  const [betType, setBetType] = useState<'single' | 'parlay'>('single');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleSuccess = () => {
    setRefreshTrigger((prev) => prev + 1);
    setActiveTab('manage');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <nav className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold">Bet Tracker Admin</h1>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600 dark:text-gray-300">{user?.email}</span>
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm text-white bg-indigo-600 rounded hover:bg-indigo-700"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <nav className="flex space-x-4">
            <button
              onClick={() => setActiveTab('add')}
              className={`px-4 py-2 rounded ${
                activeTab === 'add'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              Add Bet
            </button>
            <button
              onClick={() => setActiveTab('manage')}
              className={`px-4 py-2 rounded ${
                activeTab === 'manage'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              Manage Bets
            </button>
          </nav>
        </div>

        {activeTab === 'add' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="mb-4">
              <div className="flex gap-4">
                <button
                  onClick={() => setBetType('single')}
                  className={`px-4 py-2 rounded ${
                    betType === 'single'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  Single Bet
                </button>
                <button
                  onClick={() => setBetType('parlay')}
                  className={`px-4 py-2 rounded ${
                    betType === 'parlay'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  Parlay
                </button>
              </div>
            </div>

            {betType === 'single' ? (
              <BetForm onSuccess={handleSuccess} />
            ) : (
              <ParlayForm onSuccess={handleSuccess} />
            )}
          </div>
        )}

        {activeTab === 'manage' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">All Bets</h2>
                <ClearWeekButton onSuccess={() => setRefreshTrigger((prev) => prev + 1)} />
              </div>
              <BetList refreshTrigger={refreshTrigger} onRefresh={() => setRefreshTrigger((prev) => prev + 1)} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

