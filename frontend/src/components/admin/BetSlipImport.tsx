import React, { useState, useEffect } from 'react';
import { apiClient } from '../../services/api';
import { ExtractedBet } from '../../types/bet';
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
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [isImporting, setIsImporting] = useState(false);
  // Track attribution for bets/parlays (bet index -> attribution string)
  const [betAttributions, setBetAttributions] = useState<Record<number, string>>({});
  // Track attribution for parlay legs (bet index -> leg index -> attribution string)
  const [legAttributions, setLegAttributions] = useState<Record<number, Record<number, string>>>({});

  // Initialize default attributions when bets are extracted
  useEffect(() => {
    if (extractedBets.length > 0 && defaultAttribution) {
      setBetAttributions((prev) => {
        const newBetAttributions: Record<number, string> = {};
        extractedBets.forEach((bet, betIndex) => {
          // Set default attribution for bet/parlay if not already set
          if (!prev[betIndex]) {
            newBetAttributions[betIndex] = defaultAttribution;
          }
        });
        return Object.keys(newBetAttributions).length > 0 ? { ...prev, ...newBetAttributions } : prev;
      });
      
      setLegAttributions((prev) => {
        const newLegAttributions: Record<number, Record<number, string>> = {};
        extractedBets.forEach((bet, betIndex) => {
          // Set default attribution for parlay legs if not already set
          if (bet.type === 'parlay') {
            bet.legs.forEach((leg, legIndex) => {
              if (!prev[betIndex]?.[legIndex] && !leg.attributedTo) {
                if (!newLegAttributions[betIndex]) {
                  newLegAttributions[betIndex] = {};
                }
                newLegAttributions[betIndex][legIndex] = defaultAttribution;
              }
            });
          }
        });
        if (Object.keys(newLegAttributions).length === 0) {
          return prev;
        }
        const updated = { ...prev };
        Object.keys(newLegAttributions).forEach((betIndexStr) => {
          const betIndex = parseInt(betIndexStr);
          updated[betIndex] = { ...(updated[betIndex] || {}), ...newLegAttributions[betIndex] };
        });
        return updated;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extractedBets.length, defaultAttribution]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0] || null;
    setFile(selectedFile);
    setExtractedBets([]);
    setSelectedIndices(new Set());
    setWarnings([]);
    setError(null);
    setBetAttributions({});
    setLegAttributions({});

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
    setSelectedIndices(new Set());
    setBetAttributions({});
    setLegAttributions({});

    try {
      const imageBase64 = await readFileAsBase64(file);
      const result = await apiClient.processBetSlip(imageBase64);
      setExtractedBets(result.bets || []);
      setWarnings(result.warnings || []);
      setSelectedIndices(new Set(result.bets.map((_, index) => index)));
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

  const updateBetAttribution = (betIndex: number, value: string) => {
    setBetAttributions((prev) => ({
      ...prev,
      [betIndex]: value,
    }));
  };

  const updateLegAttribution = (betIndex: number, legIndex: number, value: string) => {
    setLegAttributions((prev) => ({
      ...prev,
      [betIndex]: {
        ...(prev[betIndex] || {}),
        [legIndex]: value,
      },
    }));
  };

  const handleImportSelected = async () => {
    if (selectedIndices.size === 0 || extractedBets.length === 0) {
      return;
    }

    setIsImporting(true);
    setError(null);

    try {
      const selectedBets = extractedBets
        .map((bet, index) => {
          if (!selectedIndices.has(index)) {
            return null;
          }

          // Apply attribution to the bet
          const betAttribution = betAttributions[index];
          const legAttributionMap = legAttributions[index] || {};

          if (bet.type === 'single') {
            return {
              ...bet,
              attributedTo: betAttribution?.trim() || bet.attributedTo || defaultAttribution,
            };
          } else {
            // For parlays, apply attribution to parlay and legs
            return {
              ...bet,
              attributedTo: betAttribution?.trim() || bet.attributedTo || defaultAttribution,
              legs: bet.legs.map((leg, legIndex) => ({
                ...leg,
                attributedTo: legAttributionMap[legIndex]?.trim() || leg.attributedTo || defaultAttribution,
              })),
            };
          }
        })
        .filter((bet): bet is ExtractedBet => bet !== null);

      for (const bet of selectedBets) {
        // Use the existing createBet endpoint; types line up with CreateBetRequest
        await apiClient.createBet(bet);
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

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mt-6">
      <h2 className="text-xl font-semibold mb-4">Import from Bet Slip</h2>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
        Upload an image of a bet slip, and we&apos;ll extract the bets using Amazon Bedrock.
        You can review and import the bets into your account.
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

        {extractedBets.length > 0 && (
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

            <div className="space-y-3">
              {extractedBets.map((bet, index) => {
                const isSelected = selectedIndices.has(index);
                const isParlay = bet.type === 'parlay';
                const legCount = isParlay ? bet.legs.length : 0;

                return (
                  <div
                    key={index}
                    className={`border rounded p-3 ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30'
                        : 'border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold uppercase tracking-wide">
                            {bet.type === 'single' ? 'Single' : 'Parlay'}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700">
                            {bet.date}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700">
                            ${bet.amount.toFixed(2)}
                          </span>
                          {isParlay && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-200 dark:bg-purple-700">
                              {legCount} leg{legCount !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                        {bet.type === 'single' && (
                          <div className="mt-1 text-sm text-gray-700 dark:text-gray-200">
                            <div>{bet.sport}</div>
                            <div className="font-medium">{bet.teams}</div>
                            <div>
                              {bet.betType} - {bet.selection} ({bet.odds > 0 ? `+${bet.odds}` : bet.odds})
                            </div>
                          </div>
                        )}
                        {isParlay && (
                          <div className="mt-1 text-sm text-gray-700 dark:text-gray-200 space-y-1">
                            {bet.legs.map((leg, legIndex) => (
                              <div key={legIndex}>
                                <span className="font-medium">
                                  Leg {legIndex + 1} - {leg.sport}:
                                </span>{' '}
                                {leg.teams} — {leg.betType} — {leg.selection} (
                                {leg.odds > 0 ? `+${leg.odds}` : leg.odds})
                              </div>
                            ))}
                          </div>
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

                    {/* Attribution input fields */}
                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 space-y-2">
                      {bet.type === 'single' && (
                        <div>
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Attributed To (Optional)
                          </label>
                          <input
                            type="text"
                            value={betAttributions[index] || defaultAttribution || ''}
                            onChange={(e) => updateBetAttribution(index, e.target.value)}
                            onClick={(event) => event.stopPropagation()}
                            onFocus={(event) => event.stopPropagation()}
                            className="block w-full text-sm rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            placeholder={defaultAttribution || "e.g., John Doe"}
                          />
                        </div>
                      )}

                      {isParlay && (
                        <>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Parlay Attributed To (Optional)
                            </label>
                            <input
                              type="text"
                              value={betAttributions[index] || defaultAttribution || ''}
                              onChange={(e) => updateBetAttribution(index, e.target.value)}
                              onClick={(event) => event.stopPropagation()}
                              onFocus={(event) => event.stopPropagation()}
                              className="block w-full text-sm rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                              placeholder={defaultAttribution || "e.g., John Doe"}
                            />
                          </div>
                          <div className="mt-2 space-y-2">
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                              Leg Attributions (Optional)
                            </label>
                            {bet.legs.map((leg, legIndex) => (
                              <div key={legIndex} className="pl-2">
                                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                                  Leg {legIndex + 1} - {leg.sport}
                                </label>
                                <input
                                  type="text"
                                  value={legAttributions[index]?.[legIndex] || defaultAttribution || ''}
                                  onChange={(e) => updateLegAttribution(index, legIndex, e.target.value)}
                                  onClick={(event) => event.stopPropagation()}
                                  onFocus={(event) => event.stopPropagation()}
                                  className="block w-full text-sm rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                  placeholder={defaultAttribution || "e.g., Jane Smith"}
                                />
                              </div>
                            ))}
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


