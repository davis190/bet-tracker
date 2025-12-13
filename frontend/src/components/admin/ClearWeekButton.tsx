import React, { useState } from 'react';
import { apiClient } from '../../services/api';

interface ClearWeekButtonProps {
  onSuccess: () => void;
}

export const ClearWeekButton: React.FC<ClearWeekButtonProps> = ({ onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleClear = async () => {
    setLoading(true);
    try {
      await apiClient.clearWeek();
      setShowConfirm(false);
      onSuccess();
    } catch (err) {
      console.error('Failed to clear week:', err);
      alert('Failed to clear week');
    } finally {
      setLoading(false);
    }
  };

  if (showConfirm) {
    return (
      <div className="border rounded-lg p-4 bg-yellow-50 dark:bg-yellow-900/20">
        <p className="text-sm font-medium mb-4">
          Are you sure you want to clear all bets for this week? This action cannot be undone.
        </p>
        <div className="flex gap-2">
          <button
            onClick={handleClear}
            disabled={loading}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? 'Clearing...' : 'Yes, Clear Week'}
          </button>
          <button
            onClick={() => setShowConfirm(false)}
            disabled={loading}
            className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-white rounded hover:bg-gray-400 dark:hover:bg-gray-500"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setShowConfirm(true)}
      className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
    >
      Clear All Bets for Week
    </button>
  );
};

