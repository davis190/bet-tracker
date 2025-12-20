import React, { useState, useEffect } from 'react';
import { Bet, isSingleBet, isParlay, BetLeg, SingleBet, Parlay } from '../../types/bet';
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
  const [editingBetId, setEditingBetId] = useState<string | null>(null);
  const [editedBet, setEditedBet] = useState<Partial<SingleBet | Parlay> | null>(null);
  const [editedLegs, setEditedLegs] = useState<BetLeg[] | null>(null);
  const [oddsInput, setOddsInput] = useState<{ [key: string]: string }>({});
  const [saving, setSaving] = useState(false);

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

  const handleLegStatusUpdate = async (betId: string, legIndex: number, legStatus: 'won' | 'lost' | 'pending', currentLegs: BetLeg[]) => {
    try {
      // Create updated legs array with the new status for the specific leg
      const updatedLegs = currentLegs.map((leg, idx) => {
        if (idx === legIndex) {
          return { ...leg, status: legStatus };
        }
        return leg;
      });
      await apiClient.updateBet(betId, { legs: updatedLegs });
      onRefresh();
    } catch (err) {
      console.error('Failed to update leg status:', err);
    }
  };

  const handleFeaturedToggle = async (betId: string, currentFeatured: boolean) => {
    try {
      await apiClient.updateBet(betId, { featured: !currentFeatured });
      onRefresh();
    } catch (err) {
      console.error('Failed to update featured status:', err);
    }
  };

  const calculatePayout = (amount: number, odds: number): number => {
    if (odds > 0) {
      return (odds / 100) * amount + amount;
    } else {
      return (100 / Math.abs(odds)) * amount + amount;
    }
  };

  const calculateParlayPayout = (amount: number, legs: BetLeg[]): number => {
    let combinedDecimal = 1.0;
    for (const leg of legs) {
      const odds = leg.odds;
      if (odds === 0) return 0;
      const decimal = odds > 0 ? (odds / 100) + 1 : (100 / Math.abs(odds)) + 1;
      combinedDecimal *= decimal;
    }
    return amount * combinedDecimal;
  };

  const handleEdit = (bet: Bet) => {
    setEditingBetId(bet.betId);
    setEditedBet({ ...bet });
    if (isParlay(bet)) {
      setEditedLegs([...bet.legs]);
    }
    // Initialize odds input for single bets
    if (isSingleBet(bet)) {
      setOddsInput({ [bet.betId]: bet.odds.toString() });
    }
  };

  const handleCancelEdit = () => {
    setEditingBetId(null);
    setEditedBet(null);
    setEditedLegs(null);
    setOddsInput({});
  };

  const handleSave = async () => {
    if (!editingBetId || !editedBet) return;

    setSaving(true);
    try {
      const updates: any = {};

      if (isSingleBet(editedBet) && isSingleBet(bets.find(b => b.betId === editingBetId))) {
        // Single bet updates
        if (editedBet.sport !== undefined) updates.sport = editedBet.sport;
        if (editedBet.teams !== undefined) updates.teams = editedBet.teams;
        if (editedBet.betType !== undefined) updates.betType = editedBet.betType;
        if (editedBet.selection !== undefined) updates.selection = editedBet.selection;
        if (editedBet.odds !== undefined) updates.odds = editedBet.odds;
        if (editedBet.amount !== undefined) updates.amount = editedBet.amount;
        if (editedBet.date !== undefined) updates.date = editedBet.date;
        if (editedBet.attributedTo !== undefined) updates.attributedTo = editedBet.attributedTo;

        // Recalculate potential payout if amount or odds changed
        if (editedBet.amount !== undefined || editedBet.odds !== undefined) {
          const amount = editedBet.amount ?? (bets.find(b => b.betId === editingBetId) as SingleBet).amount;
          const odds = editedBet.odds ?? (bets.find(b => b.betId === editingBetId) as SingleBet).odds;
          updates.potentialPayout = calculatePayout(amount, odds);
        }
      } else if (isParlay(editedBet) && isParlay(bets.find(b => b.betId === editingBetId)) && editedLegs) {
        // Parlay updates
        if (editedBet.amount !== undefined) updates.amount = editedBet.amount;
        if (editedBet.date !== undefined) updates.date = editedBet.date;
        if (editedBet.attributedTo !== undefined) updates.attributedTo = editedBet.attributedTo;
        
        // Update legs
        updates.legs = editedLegs;

        // Recalculate potential payout if amount or legs changed
        const amount = editedBet.amount ?? (bets.find(b => b.betId === editingBetId) as Parlay).amount;
        updates.potentialPayout = calculateParlayPayout(amount, editedLegs);
      }

      await apiClient.updateBet(editingBetId, updates);
      handleCancelEdit();
      onRefresh();
    } catch (err) {
      console.error('Failed to update bet:', err);
      alert('Failed to update bet. Please try again.');
    } finally {
      setSaving(false);
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

  // Check if a bet has pending status or pending legs
  const hasPendingStatus = (bet: Bet): boolean => {
    if (bet.status === 'pending') {
      return true;
    }
    if (isParlay(bet)) {
      // Check if any leg is pending
      return bet.legs.some((leg) => !leg.status || leg.status === 'pending');
    }
    return false;
  };

  // Sort bets: pending bets (or bets with pending legs) first
  const sortedBets = [...bets].sort((a, b) => {
    const aHasPending = hasPendingStatus(a);
    const bHasPending = hasPendingStatus(b);
    
    if (aHasPending && !bHasPending) return -1;
    if (!aHasPending && bHasPending) return 1;
    return 0;
  });

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

      {sortedBets.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No bets found</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedBets.map((bet) => (
            <div
              key={bet.betId}
              className="border rounded-lg p-4 space-y-2 dark:border-gray-600"
            >
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${getStatusBadgeClass(bet.status)}`}>
                    {bet.status.toUpperCase()}
                  </span>
                  <button
                    onClick={() => handleFeaturedToggle(bet.betId, bet.featured || false)}
                    className={`px-2 py-1 rounded text-xs font-semibold transition-colors ${
                      bet.featured
                        ? 'bg-yellow-500 text-white hover:bg-yellow-600 dark:bg-yellow-600 dark:hover:bg-yellow-700'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                    }`}
                    title={bet.featured ? 'Remove from featured' : 'Mark as featured'}
                    disabled={editingBetId === bet.betId}
                  >
                    ⭐ {bet.featured ? 'Featured' : 'Feature'}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  {editingBetId === bet.betId ? (
                    <>
                      <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                      >
                        {saving ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        disabled={saving}
                        className="px-2 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => handleEdit(bet)}
                        className="px-2 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700"
                      >
                        Edit
                      </button>
                      <span className="text-xs text-gray-500">{formatDate(bet.date)}</span>
                    </>
                  )}
                </div>
              </div>

              {isSingleBet(bet) && (
                <div className="space-y-2">
                  {editingBetId === bet.betId && editedBet && isSingleBet(editedBet) ? (
                    <>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">Teams</label>
                        <input
                          type="text"
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white px-2 py-1"
                          value={editedBet.teams || ''}
                          onChange={(e) => setEditedBet({ ...editedBet, teams: e.target.value })}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">Sport</label>
                          <input
                            type="text"
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white px-2 py-1"
                            value={editedBet.sport || ''}
                            onChange={(e) => setEditedBet({ ...editedBet, sport: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">Bet Type</label>
                          <select
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white px-2 py-1"
                            value={editedBet.betType || 'moneyline'}
                            onChange={(e) => setEditedBet({ ...editedBet, betType: e.target.value as any })}
                          >
                            <option value="spread">Spread</option>
                            <option value="moneyline">Moneyline</option>
                            <option value="over/under">Over/Under</option>
                            <option value="total">Total</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">Selection</label>
                        <input
                          type="text"
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white px-2 py-1"
                          value={editedBet.selection || ''}
                          onChange={(e) => setEditedBet({ ...editedBet, selection: e.target.value })}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">Odds</label>
                          <input
                            type="text"
                            inputMode="numeric"
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white px-2 py-1"
                            value={oddsInput[bet.betId] ?? editedBet.odds?.toString() ?? ''}
                            onChange={(e) => {
                              const value = e.target.value;
                              if (value === '' || value === '-' || /^-?\d*\.?\d*$/.test(value)) {
                                setOddsInput({ ...oddsInput, [bet.betId]: value });
                                const parsed = parseFloat(value);
                                if (!isNaN(parsed) && value !== '' && value !== '-') {
                                  setEditedBet({ ...editedBet, odds: parsed });
                                } else if (value === '' || value === '-') {
                                  setEditedBet({ ...editedBet, odds: 0 });
                                }
                              }
                            }}
                            onBlur={() => {
                              const parsed = parseFloat(oddsInput[bet.betId] || editedBet.odds?.toString() || '0');
                              if (isNaN(parsed) || oddsInput[bet.betId] === '' || oddsInput[bet.betId] === '-') {
                                setOddsInput({ ...oddsInput, [bet.betId]: (editedBet.odds || 0).toString() });
                                setEditedBet({ ...editedBet, odds: editedBet.odds || 0 });
                              } else {
                                setOddsInput({ ...oddsInput, [bet.betId]: parsed.toString() });
                                setEditedBet({ ...editedBet, odds: parsed });
                              }
                            }}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">Amount</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white px-2 py-1"
                            value={editedBet.amount ?? 0}
                            onChange={(e) => setEditedBet({ ...editedBet, amount: parseFloat(e.target.value) || 0 })}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">Date</label>
                        <input
                          type="date"
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white px-2 py-1"
                          value={editedBet.date || ''}
                          onChange={(e) => setEditedBet({ ...editedBet, date: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">Attributed To</label>
                        <input
                          type="text"
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white px-2 py-1"
                          value={editedBet.attributedTo || ''}
                          onChange={(e) => setEditedBet({ ...editedBet, attributedTo: e.target.value || undefined })}
                        />
                      </div>
                      <div className="text-sm font-semibold text-green-600 dark:text-green-400">
                        Payout: ${calculatePayout(editedBet.amount || 0, editedBet.odds || 0).toFixed(2)}
                      </div>
                    </>
                  ) : (
                    <>
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
                      {bet.attributedTo && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 italic mt-1">
                          Suggested by: {bet.attributedTo}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {isParlay(bet) && (
                <div className="space-y-2">
                  {editingBetId === bet.betId && editedBet && isParlay(editedBet) && editedLegs ? (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">Amount</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white px-2 py-1"
                            value={editedBet.amount ?? 0}
                            onChange={(e) => setEditedBet({ ...editedBet, amount: parseFloat(e.target.value) || 0 })}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">Date</label>
                          <input
                            type="date"
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white px-2 py-1"
                            value={editedBet.date || ''}
                            onChange={(e) => setEditedBet({ ...editedBet, date: e.target.value })}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">Attributed To</label>
                        <input
                          type="text"
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white px-2 py-1"
                          value={editedBet.attributedTo || ''}
                          onChange={(e) => setEditedBet({ ...editedBet, attributedTo: e.target.value || undefined })}
                        />
                      </div>
                      <div className="text-sm font-semibold text-green-600 dark:text-green-400">
                        Payout: ${calculateParlayPayout(editedBet.amount || 0, editedLegs).toFixed(2)}
                      </div>
                      <details className="mt-2" open>
                        <summary className="text-sm cursor-pointer text-indigo-600 dark:text-indigo-400">
                          Edit Legs ({editedLegs.length})
                        </summary>
                        <div className="mt-2 space-y-3 pl-4 border-l-2">
                          {editedLegs.map((leg, idx) => (
                            <div key={leg.id || idx} className="text-sm space-y-2 p-2 bg-gray-50 dark:bg-gray-700 rounded">
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">Teams</label>
                                  <input
                                    type="text"
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-xs dark:bg-gray-600 dark:border-gray-500 dark:text-white px-2 py-1"
                                    value={leg.teams || ''}
                                    onChange={(e) => {
                                      const updated = [...editedLegs];
                                      updated[idx] = { ...updated[idx], teams: e.target.value };
                                      setEditedLegs(updated);
                                    }}
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">Sport</label>
                                  <input
                                    type="text"
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-xs dark:bg-gray-600 dark:border-gray-500 dark:text-white px-2 py-1"
                                    value={leg.sport || ''}
                                    onChange={(e) => {
                                      const updated = [...editedLegs];
                                      updated[idx] = { ...updated[idx], sport: e.target.value };
                                      setEditedLegs(updated);
                                    }}
                                  />
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">Bet Type</label>
                                  <select
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-xs dark:bg-gray-600 dark:border-gray-500 dark:text-white px-2 py-1"
                                    value={leg.betType || 'moneyline'}
                                    onChange={(e) => {
                                      const updated = [...editedLegs];
                                      updated[idx] = { ...updated[idx], betType: e.target.value as any };
                                      setEditedLegs(updated);
                                    }}
                                  >
                                    <option value="spread">Spread</option>
                                    <option value="moneyline">Moneyline</option>
                                    <option value="over/under">Over/Under</option>
                                    <option value="total">Total</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">Selection</label>
                                  <input
                                    type="text"
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-xs dark:bg-gray-600 dark:border-gray-500 dark:text-white px-2 py-1"
                                    value={leg.selection || ''}
                                    onChange={(e) => {
                                      const updated = [...editedLegs];
                                      updated[idx] = { ...updated[idx], selection: e.target.value };
                                      setEditedLegs(updated);
                                    }}
                                  />
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">Odds</label>
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-xs dark:bg-gray-600 dark:border-gray-500 dark:text-white px-2 py-1"
                                    value={leg.odds?.toString() || ''}
                                    onChange={(e) => {
                                      const value = e.target.value;
                                      if (value === '' || value === '-' || /^-?\d*\.?\d*$/.test(value)) {
                                        const parsed = parseFloat(value);
                                        if (!isNaN(parsed) && value !== '' && value !== '-') {
                                          const updated = [...editedLegs];
                                          updated[idx] = { ...updated[idx], odds: parsed };
                                          setEditedLegs(updated);
                                        } else if (value === '' || value === '-') {
                                          const updated = [...editedLegs];
                                          updated[idx] = { ...updated[idx], odds: 0 };
                                          setEditedLegs(updated);
                                        } else {
                                          const updated = [...editedLegs];
                                          updated[idx] = { ...updated[idx], odds: leg.odds };
                                          setEditedLegs(updated);
                                        }
                                      }
                                    }}
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">Attributed To</label>
                                  <input
                                    type="text"
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-xs dark:bg-gray-600 dark:border-gray-500 dark:text-white px-2 py-1"
                                    value={leg.attributedTo || ''}
                                    onChange={(e) => {
                                      const updated = [...editedLegs];
                                      updated[idx] = { ...updated[idx], attributedTo: e.target.value || undefined };
                                      setEditedLegs(updated);
                                    }}
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </details>
                    </>
                  ) : (
                    <>
                      <div className="font-semibold">Parlay ({bet.legs.length} legs)</div>
                      <div className="text-sm">Amount: ${bet.amount.toFixed(2)}</div>
                      <div className="text-sm font-semibold text-green-600 dark:text-green-400">
                        Payout: ${bet.potentialPayout.toFixed(2)}
                      </div>
                      {bet.attributedTo && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 italic mt-1">
                          Suggested by: {bet.attributedTo}
                        </div>
                      )}
                      <details className="mt-2" open>
                        <summary className="text-sm cursor-pointer text-indigo-600 dark:text-indigo-400">
                          View Legs
                        </summary>
                        <div className="mt-2 space-y-3 pl-4 border-l-2">
                          {bet.legs.map((leg, idx) => {
                            const legStatus = leg.status || 'pending';
                            return (
                              <div key={leg.id || idx} className="text-sm space-y-1">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex-1">
                                    <div className="font-medium">{leg.teams}</div>
                                    <div className="text-gray-600 dark:text-gray-400">
                                      {leg.betType}: {leg.selection} ({leg.odds > 0 ? '+' : ''}{leg.odds})
                                    </div>
                                    {leg.attributedTo && (
                                      <div className="text-xs text-gray-500 dark:text-gray-400 italic mt-1">
                                        {leg.attributedTo}
                                      </div>
                                    )}
                                  </div>
                                  <span className={`px-2 py-1 rounded text-xs font-semibold ${getStatusBadgeClass(legStatus)}`}>
                                    {legStatus.toUpperCase()}
                                  </span>
                                </div>
                                <div className="flex gap-1 mt-1">
                                  <button
                                    onClick={() => handleLegStatusUpdate(bet.betId, idx, 'won', bet.legs)}
                                    className={`px-2 py-1 text-xs rounded ${
                                      legStatus === 'won'
                                        ? 'bg-green-600 text-white'
                                        : 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900 dark:text-green-200 dark:hover:bg-green-800'
                                    }`}
                                  >
                                    Won
                                  </button>
                                  <button
                                    onClick={() => handleLegStatusUpdate(bet.betId, idx, 'lost', bet.legs)}
                                    className={`px-2 py-1 text-xs rounded ${
                                      legStatus === 'lost'
                                        ? 'bg-red-600 text-white'
                                        : 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900 dark:text-red-200 dark:hover:bg-red-800'
                                    }`}
                                  >
                                    Lost
                                  </button>
                                  <button
                                    onClick={() => handleLegStatusUpdate(bet.betId, idx, 'pending', bet.legs)}
                                    className={`px-2 py-1 text-xs rounded ${
                                      legStatus === 'pending'
                                        ? 'bg-yellow-600 text-white'
                                        : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200 dark:bg-yellow-900 dark:text-yellow-200 dark:hover:bg-yellow-800'
                                    }`}
                                  >
                                    Pending
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </details>
                    </>
                  )}
                </div>
              )}

              {bet.status === 'pending' && editingBetId !== bet.betId && (
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

