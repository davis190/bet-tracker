import React, { useState, useEffect } from 'react';
import { apiClient } from '../../services/api';
import { ExtractedBet, ExtractedSingleBet, ExtractedParlayBet } from '../../types/bet';
import { useAuth } from '../../contexts/AuthContext';

interface BetSlipImportProps {
  onImported: () => void;
}

const getUsernameFromEmail = (email: string | undefined): string | undefined => {
  if (!email || !email.includes('@')) {
    return undefined;
  }
  return email.split('@')[0];
};

export const BetSlipImport: React.FC<BetSlipImportProps> = ({ onImported }) => {
  const { user } = useAuth();
  const defaultAttribution = getUsernameFromEmail(user?.email);
  
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [extractedBets, setExtractedBets] = useState<ExtractedBet[]>([]);
  const [editableBets, setEditableBets] = useState<ExtractedBet[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [isImporting, setIsImporting] = useState(false);

  // Initialize editable bets when extracted bets change
  useEffect(() => {
    if (extractedBets.length > 0) {
      const initialized = extractedBets.map((bet) => {
        const editable: ExtractedBet = { ...bet };
        
        // Ensure all required fields have default values for editing
        if (editable.type === 'single') {
          const single = editable as ExtractedSingleBet;
          if (!single.amount) single.amount = 0;
          if (!single.date) single.date = new Date().toISOString().split('T')[0];
          if (!single.sport) single.sport = '';
          if (!single.teams) single.teams = '';
          if (!single.betType) single.betType = 'moneyline';
          if (!single.selection) single.selection = '';
          if (single.odds === undefined || single.odds === null) single.odds = 0;
          if (!single.attributedTo && defaultAttribution) single.attributedTo = defaultAttribution;
        } else {
          const parlay = editable as ExtractedParlayBet;
          if (!parlay.amount) parlay.amount = 0;
          if (!parlay.date) parlay.date = new Date().toISOString().split('T')[0];
          if (!parlay.legs) parlay.legs = [];
          if (!parlay.attributedTo && defaultAttribution) parlay.attributedTo = defaultAttribution;
          
          // Initialize leg fields
          parlay.legs = parlay.legs.map((leg) => ({
            ...leg,
            sport: leg.sport || '',
            teams: leg.teams || '',
            betType: leg.betType || 'moneyline',
            selection: leg.selection || '',
            odds: leg.odds !== undefined && leg.odds !== null ? leg.odds : 0,
            attributedTo: leg.attributedTo || defaultAttribution,
          }));
        }
        
        return editable;
      });
      setEditableBets(initialized);
      setSelectedIndices(new Set(initialized.map((_, index) => index)));
    }
  }, [extractedBets, defaultAttribution]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0] || null;
    setFile(selectedFile);
    setExtractedBets([]);
    setEditableBets([]);
    setSelectedIndices(new Set());
    setWarnings([]);
    setError(null);

    if (selectedFile) {
      const url = URL.createObjectURL(selectedFile);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }
  };

  const readFileAsBase64 = (fileToRead: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        if (typeof result === 'string') {
          resolve(result);
        } else {
          reject(new Error('Failed to read file as base64'));
        }
      };
      reader.onerror = () => {
        reject(reader.error || new Error('Failed to read file'));
      };
      reader.readAsDataURL(fileToRead);
    });
  };

  const handleExtractBets = async () => {
    if (!file) {
      setError('Please select an image of a bet slip first.');
      return;
    }

    setIsExtracting(true);
    setError(null);
    setWarnings([]);
    setExtractedBets([]);
    setEditableBets([]);
    setSelectedIndices(new Set());

    try {
      const imageBase64 = await readFileAsBase64(file);
      const result = await apiClient.processBetSlip(imageBase64);
      setExtractedBets(result.bets || []);
      setWarnings(result.warnings || []);
    } catch (err: any) {
      const message =
        err?.response?.data?.error?.message ||
        err?.message ||
        'Failed to extract bets from bet slip image.';
      setError(message);
    } finally {
      setIsExtracting(false);
    }
  };

  const toggleSelected = (index: number) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const updateBetField = (betIndex: number, field: string, value: any) => {
    setEditableBets((prev) => {
      const updated = [...prev];
      const bet = { ...updated[betIndex] };
      
      if (bet.type === 'single') {
        (bet as any)[field] = value;
      } else {
        (bet as any)[field] = value;
      }
      
      updated[betIndex] = bet;
      return updated;
    });
  };

  const updateLegField = (betIndex: number, legIndex: number, field: string, value: any) => {
    setEditableBets((prev) => {
      const updated = [...prev];
      const bet = { ...updated[betIndex] };
      
      if (bet.type === 'parlay' && bet.legs) {
        const legs = [...bet.legs];
        const leg = { ...legs[legIndex] };
        (leg as any)[field] = value;
        legs[legIndex] = leg;
        bet.legs = legs;
      }
      
      updated[betIndex] = bet;
      return updated;
    });
  };

  const addLeg = (betIndex: number) => {
    setEditableBets((prev) => {
      const updated = [...prev];
      const bet = { ...updated[betIndex] };
      
      if (bet.type === 'parlay') {
        const legs = bet.legs || [];
        bet.legs = [
          ...legs,
          {
            sport: '',
            teams: '',
            betType: 'moneyline',
            selection: '',
            odds: 0,
            attributedTo: defaultAttribution,
          },
        ];
      }
      
      updated[betIndex] = bet;
      return updated;
    });
  };

  const removeLeg = (betIndex: number, legIndex: number) => {
    setEditableBets((prev) => {
      const updated = [...prev];
      const bet = { ...updated[betIndex] };
      
      if (bet.type === 'parlay' && bet.legs) {
        bet.legs = bet.legs.filter((_, idx) => idx !== legIndex);
      }
      
      updated[betIndex] = bet;
      return updated;
    });
  };

  const handleImportSelected = async () => {
    if (selectedIndices.size === 0 || editableBets.length === 0) {
      return;
    }

    setIsImporting(true);
    setError(null);

    try {
      const selectedBets: ExtractedBet[] = editableBets
        .filter((_, index) => selectedIndices.has(index))
        .map((bet) => {
          // Clean up the bet data before sending
          const cleaned: any = { ...bet };
          delete cleaned._validationError;

          if (bet.type === 'single') {
            return {
              type: 'single',
              amount: Number(cleaned.amount) || 0,
              date: cleaned.date || new Date().toISOString().split('T')[0],
              sport: cleaned.sport || '',
              teams: cleaned.teams || '',
              betType: cleaned.betType || 'moneyline',
              selection: cleaned.selection || '',
              odds: Number(cleaned.odds) || 0,
              ...(cleaned.attributedTo ? { attributedTo: cleaned.attributedTo } : {}),
            };
          } else {
            return {
              type: 'parlay',
              amount: Number(cleaned.amount) || 0,
              date: cleaned.date || new Date().toISOString().split('T')[0],
              legs: (cleaned.legs || []).map((leg: any) => ({
                sport: leg.sport || '',
                teams: leg.teams || '',
                betType: leg.betType || 'moneyline',
                selection: leg.selection || '',
                odds: Number(leg.odds) || 0,
                ...(leg.attributedTo ? { attributedTo: leg.attributedTo } : {}),
              })),
              ...(cleaned.attributedTo ? { attributedTo: cleaned.attributedTo } : {}),
            };
          }
        });

      for (const bet of selectedBets) {
        await apiClient.createBet(bet as any);
      }
      onImported();
    } catch (err: any) {
      const message =
        err?.response?.data?.error?.message ||
        err?.message ||
        'Failed to import one or more bets.';
      setError(message);
    } finally {
      setIsImporting(false);
    }
  };

  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'number') return value.toString();
    return String(value);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mt-6">
      <h2 className="text-xl font-semibold mb-4">Import from Bet Slip</h2>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
        Upload an image of a bet slip, and we&apos;ll extract the bets using Amazon Bedrock.
        You can review and edit the extracted data before importing.
      </p>

      <div className="space-y-4">
        <div>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-900 dark:text-gray-100
                       file:mr-4 file:py-2 file:px-4
                       file:rounded-md file:border-0
                       file:text-sm file:font-semibold
                       file:bg-indigo-50 file:text-indigo-700
                       hover:file:bg-indigo-100"
          />
        </div>

        {previewUrl && (
          <div className="mt-2">
            <p className="text-sm font-medium mb-1">Preview</p>
            <img
              src={previewUrl}
              alt="Bet slip preview"
              className="max-h-64 rounded border border-gray-200 dark:border-gray-700"
            />
          </div>
        )}

        <div>
          <button
            type="button"
            onClick={handleExtractBets}
            disabled={!file || isExtracting}
            className={`px-4 py-2 rounded text-white ${
              isExtracting || !file
                ? 'bg-indigo-300 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            {isExtracting ? 'Extracting...' : 'Extract Bets'}
          </button>
        </div>

        {error && (
          <div className="mt-2 text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        {warnings.length > 0 && (
          <div className="mt-2 text-sm text-yellow-700 dark:text-yellow-400 space-y-1">
            {warnings.map((warning, index) => (
              <p key={index}>• {warning}</p>
            ))}
          </div>
        )}

        {editableBets.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold">Extracted Bets</h3>
              <button
                type="button"
                onClick={handleImportSelected}
                disabled={selectedIndices.size === 0 || isImporting}
                className={`px-4 py-2 rounded text-white ${
                  selectedIndices.size === 0 || isImporting
                    ? 'bg-green-300 cursor-not-allowed'
                    : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {isImporting
                  ? 'Importing...'
                  : selectedIndices.size > 0
                  ? `Import Selected (${selectedIndices.size})`
                  : 'Import Selected'}
              </button>
            </div>

            <div className="space-y-4">
              {editableBets.map((bet, index) => {
                const isSelected = selectedIndices.has(index);
                const isParlay = bet.type === 'parlay';
                const validationError = bet._validationError;

                return (
                  <div
                    key={index}
                    className={`border rounded p-4 ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30'
                        : 'border-gray-200 dark:border-gray-700'
                    } ${validationError ? 'border-red-300 dark:border-red-700' : ''}`}
                  >
                    <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold uppercase tracking-wide">
                            {bet.type === 'single' ? 'Single' : 'Parlay'}
                          </span>
                        {validationError && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200">
                            Has Errors
                          </span>
                        )}
                      </div>
                      <div className="ml-4">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelected(index)}
                          onClick={(event) => event.stopPropagation()}
                          className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                        />
                      </div>
                    </div>

                    {validationError && (
                      <div className="mb-3 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-700 dark:text-red-300">
                        <strong>Validation Error:</strong> {validationError}
                      </div>
                    )}

                    <div className="space-y-3">
                      {/* Common fields */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Amount ($)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={formatValue(bet.amount)}
                            onChange={(e) => updateBetField(index, 'amount', e.target.value ? parseFloat(e.target.value) : 0)}
                            className="block w-full text-sm rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Date
                          </label>
                          <input
                            type="date"
                            value={formatValue(bet.date)}
                            onChange={(e) => updateBetField(index, 'date', e.target.value)}
                            className="block w-full text-sm rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                          />
                        </div>
                      </div>

                      {bet.type === 'single' && (
                        <>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Sport
                              </label>
                              <input
                                type="text"
                                value={formatValue(bet.sport)}
                                onChange={(e) => updateBetField(index, 'sport', e.target.value)}
                                className="block w-full text-sm rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Teams
                              </label>
                              <input
                                type="text"
                                value={formatValue(bet.teams)}
                                onChange={(e) => updateBetField(index, 'teams', e.target.value)}
                                className="block w-full text-sm rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Bet Type
                              </label>
                              <select
                                value={formatValue(bet.betType)}
                                onChange={(e) => updateBetField(index, 'betType', e.target.value)}
                                className="block w-full text-sm rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                              >
                                <option value="moneyline">Moneyline</option>
                                <option value="spread">Spread</option>
                                <option value="over/under">Over/Under</option>
                                <option value="total">Total</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Selection
                              </label>
                              <input
                                type="text"
                                value={formatValue(bet.selection)}
                                onChange={(e) => updateBetField(index, 'selection', e.target.value)}
                                className="block w-full text-sm rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Odds
                              </label>
                              <input
                                type="number"
                                step="1"
                                value={formatValue(bet.odds)}
                                onChange={(e) => updateBetField(index, 'odds', e.target.value ? parseFloat(e.target.value) : 0)}
                                className="block w-full text-sm rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                placeholder="e.g., -110 or +200"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Attributed To (Optional)
                              </label>
                              <input
                                type="text"
                                value={formatValue(bet.attributedTo)}
                                onChange={(e) => updateBetField(index, 'attributedTo', e.target.value)}
                                className="block w-full text-sm rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                placeholder={defaultAttribution || "e.g., John Doe"}
                              />
                            </div>
                          </div>
                        </>
                      )}

                      {isParlay && bet.legs && (
                        <>
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                                Parlay Legs
                              </label>
                              <button
                                type="button"
                                onClick={() => addLeg(index)}
                                className="text-xs px-2 py-1 bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-200 rounded hover:bg-indigo-200 dark:hover:bg-indigo-800"
                              >
                                + Add Leg
                              </button>
                            </div>
                            <div className="space-y-3">
                              {bet.legs.map((leg, legIndex) => (
                                <div key={legIndex} className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded border border-gray-200 dark:border-gray-700">
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                      Leg {legIndex + 1}
                                    </span>
                                    {bet.legs && bet.legs.length > 2 && (
                                      <button
                                        type="button"
                                        onClick={() => removeLeg(index, legIndex)}
                                        className="text-xs px-2 py-1 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 rounded hover:bg-red-200 dark:hover:bg-red-800"
                                      >
                                        Remove
                                      </button>
                                    )}
                                  </div>
                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                                        Sport
                                      </label>
                                      <input
                                        type="text"
                                        value={formatValue(leg.sport)}
                                        onChange={(e) => updateLegField(index, legIndex, 'sport', e.target.value)}
                                        className="block w-full text-xs rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                                        Teams
                                      </label>
                                      <input
                                        type="text"
                                        value={formatValue(leg.teams)}
                                        onChange={(e) => updateLegField(index, legIndex, 'teams', e.target.value)}
                                        className="block w-full text-xs rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                                        Bet Type
                                      </label>
                                      <select
                                        value={formatValue(leg.betType)}
                                        onChange={(e) => updateLegField(index, legIndex, 'betType', e.target.value)}
                                        className="block w-full text-xs rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                      >
                                        <option value="moneyline">Moneyline</option>
                                        <option value="spread">Spread</option>
                                        <option value="over/under">Over/Under</option>
                                        <option value="total">Total</option>
                                      </select>
                                    </div>
                                    <div>
                                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                                        Selection
                                      </label>
                                      <input
                                        type="text"
                                        value={formatValue(leg.selection)}
                                        onChange={(e) => updateLegField(index, legIndex, 'selection', e.target.value)}
                                        className="block w-full text-xs rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                                        Odds
                                      </label>
                                      <input
                                        type="number"
                                        step="1"
                                        value={formatValue(leg.odds)}
                                        onChange={(e) => updateLegField(index, legIndex, 'odds', e.target.value ? parseFloat(e.target.value) : 0)}
                                        className="block w-full text-xs rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                        placeholder="e.g., -110 or +200"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                                        Attributed To (Optional)
                                      </label>
                                      <input
                                        type="text"
                                        value={formatValue(leg.attributedTo)}
                                        onChange={(e) => updateLegField(index, legIndex, 'attributedTo', e.target.value)}
                                        className="block w-full text-xs rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                        placeholder={defaultAttribution || "e.g., Jane Smith"}
                                      />
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Parlay Attributed To (Optional)
                            </label>
                            <input
                              type="text"
                              value={formatValue(bet.attributedTo)}
                              onChange={(e) => updateBetField(index, 'attributedTo', e.target.value)}
                              className="block w-full text-sm rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                              placeholder={defaultAttribution || "e.g., John Doe"}
                            />
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
