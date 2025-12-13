import React, { useState } from 'react';
import { CreateSingleBetRequest } from '../../types/bet';
import { apiClient } from '../../services/api';

interface BetFormProps {
  onSuccess: () => void;
}

export const BetForm: React.FC<BetFormProps> = ({ onSuccess }) => {
  const [formData, setFormData] = useState<CreateSingleBetRequest>({
    type: 'single',
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    sport: '',
    teams: '',
    betType: 'moneyline',
    selection: '',
    odds: 0,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [oddsInput, setOddsInput] = useState<string>('0');

  const calculatePayout = (amount: number, odds: number): number => {
    if (odds > 0) {
      return (odds / 100) * amount + amount;
    } else {
      return (100 / Math.abs(odds)) * amount + amount;
    }
  };

  const potentialPayout = calculatePayout(formData.amount, formData.odds);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await apiClient.createBet(formData);
      onSuccess();
      // Reset form
      setFormData({
        type: 'single',
        amount: 0,
        date: new Date().toISOString().split('T')[0],
        sport: '',
        teams: '',
        betType: 'moneyline',
        selection: '',
        odds: 0,
      });
      setOddsInput('0');
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to create bet');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h3 className="text-lg font-semibold">Single Bet</h3>
      
      {error && (
        <div className="rounded-md bg-red-50 dark:bg-red-900 p-4">
          <div className="text-sm text-red-800 dark:text-red-200">{error}</div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Sport
          </label>
          <input
            type="text"
            required
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            value={formData.sport}
            onChange={(e) => setFormData({ ...formData, sport: e.target.value })}
            placeholder="e.g., NFL"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Teams
          </label>
          <input
            type="text"
            required
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            value={formData.teams}
            onChange={(e) => setFormData({ ...formData, teams: e.target.value })}
            placeholder="e.g., Colts @ Seahawks"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Bet Type
          </label>
          <select
            required
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            value={formData.betType}
            onChange={(e) => setFormData({ ...formData, betType: e.target.value as any })}
          >
            <option value="spread">Spread</option>
            <option value="moneyline">Moneyline</option>
            <option value="over/under">Over/Under</option>
            <option value="total">Total</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Selection
          </label>
          <input
            type="text"
            required
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            value={formData.selection}
            onChange={(e) => setFormData({ ...formData, selection: e.target.value })}
            placeholder="e.g., Over 44.5"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Odds
          </label>
          <input
            type="text"
            inputMode="numeric"
            required
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            value={oddsInput}
            onChange={(e) => {
              const value = e.target.value;
              // Allow empty, just minus sign, or valid number pattern
              if (value === '' || value === '-' || /^-?\d*\.?\d*$/.test(value)) {
                setOddsInput(value);
                const parsed = parseFloat(value);
                if (!isNaN(parsed) && value !== '' && value !== '-') {
                  setFormData({ ...formData, odds: parsed });
                } else if (value === '' || value === '-') {
                  setFormData({ ...formData, odds: 0 });
                }
              }
            }}
            onBlur={() => {
              // Ensure we have a valid number on blur
              const parsed = parseFloat(oddsInput);
              if (isNaN(parsed) || oddsInput === '' || oddsInput === '-') {
                setOddsInput('0');
                setFormData({ ...formData, odds: 0 });
              } else {
                setOddsInput(parsed.toString());
                setFormData({ ...formData, odds: parsed });
              }
            }}
            placeholder="e.g., -110"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Amount
          </label>
          <input
            type="number"
            required
            step="0.01"
            min="0.01"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            value={formData.amount}
            onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Date
          </label>
          <input
            type="date"
            required
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Potential Payout
          </label>
          <div className="mt-1 text-lg font-semibold text-green-600 dark:text-green-400">
            ${potentialPayout.toFixed(2)}
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
      >
        {loading ? 'Creating...' : 'Create Bet'}
      </button>
    </form>
  );
};

