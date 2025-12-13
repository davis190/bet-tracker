import React, { useState } from 'react';
import { CreateParlayRequest, BetLeg } from '../../types/bet';
import { apiClient } from '../../services/api';

interface ParlayFormProps {
  onSuccess: () => void;
}

export const ParlayForm: React.FC<ParlayFormProps> = ({ onSuccess }) => {
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [legs, setLegs] = useState<Omit<BetLeg, 'id'>[]>([
    {
      sport: '',
      teams: '',
      betType: 'moneyline',
      selection: '',
      odds: 0,
    },
    {
      sport: '',
      teams: '',
      betType: 'moneyline',
      selection: '',
      odds: 0,
    },
  ]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const calculateParlayPayout = (amount: number, legs: Omit<BetLeg, 'id'>[]): number => {
    const decimalOdds = legs.map(leg => {
      if (leg.odds > 0) {
        return (leg.odds / 100) + 1;
      } else {
        return (100 / Math.abs(leg.odds)) + 1;
      }
    });

    const combined = decimalOdds.reduce((acc, dec) => acc * dec, 1);
    return amount * combined;
  };

  const potentialPayout = calculateParlayPayout(amount, legs);

  const addLeg = () => {
    setLegs([...legs, {
      sport: '',
      teams: '',
      betType: 'moneyline',
      selection: '',
      odds: 0,
    }]);
  };

  const removeLeg = (index: number) => {
    if (legs.length > 2) {
      setLegs(legs.filter((_, i) => i !== index));
    }
  };

  const updateLeg = (index: number, field: keyof Omit<BetLeg, 'id'>, value: any) => {
    const updatedLegs = [...legs];
    updatedLegs[index] = { ...updatedLegs[index], [field]: value };
    setLegs(updatedLegs);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (legs.length < 2) {
      setError('Parlay must have at least 2 legs');
      return;
    }

    setLoading(true);

    try {
      const parlay: CreateParlayRequest = {
        type: 'parlay',
        amount,
        date,
        legs,
      };
      await apiClient.createBet(parlay);
      onSuccess();
      // Reset form
      setAmount(0);
      setDate(new Date().toISOString().split('T')[0]);
      setLegs([
        { sport: '', teams: '', betType: 'moneyline', selection: '', odds: 0 },
        { sport: '', teams: '', betType: 'moneyline', selection: '', odds: 0 },
      ]);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to create parlay');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h3 className="text-lg font-semibold">Parlay</h3>
      
      {error && (
        <div className="rounded-md bg-red-50 dark:bg-red-900 p-4">
          <div className="text-sm text-red-800 dark:text-red-200">{error}</div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            value={amount}
            onChange={(e) => setAmount(parseFloat(e.target.value))}
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
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Potential Payout
          </label>
          <div className="mt-1 text-lg font-semibold text-green-600 dark:text-green-400">
            ${potentialPayout.toFixed(2)}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h4 className="text-md font-medium">Legs</h4>
          <button
            type="button"
            onClick={addLeg}
            className="text-sm text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
          >
            + Add Leg
          </button>
        </div>

        {legs.map((leg, index) => (
          <div key={index} className="border rounded-lg p-4 space-y-4">
            <div className="flex justify-between items-center mb-2">
              <span className="font-medium">Leg {index + 1}</span>
              {legs.length > 2 && (
                <button
                  type="button"
                  onClick={() => removeLeg(index)}
                  className="text-sm text-red-600 hover:text-red-700 dark:text-red-400"
                >
                  Remove
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Sport
                </label>
                <input
                  type="text"
                  required
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  value={leg.sport}
                  onChange={(e) => updateLeg(index, 'sport', e.target.value)}
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
                  value={leg.teams}
                  onChange={(e) => updateLeg(index, 'teams', e.target.value)}
                  placeholder="e.g., Panthers @ Falcons"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Bet Type
                </label>
                <select
                  required
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  value={leg.betType}
                  onChange={(e) => updateLeg(index, 'betType', e.target.value as any)}
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
                  value={leg.selection}
                  onChange={(e) => updateLeg(index, 'selection', e.target.value)}
                  placeholder="e.g., Panthers"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Odds
                </label>
                <input
                  type="number"
                  required
                  step="1"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  value={leg.odds}
                  onChange={(e) => updateLeg(index, 'odds', parseFloat(e.target.value))}
                  placeholder="e.g., -150"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
      >
        {loading ? 'Creating...' : 'Create Parlay'}
      </button>
    </form>
  );
};

