import React from 'react';
import { Bet, isSingleBet, isParlay } from '../../types/bet';

interface StatsOverviewProps {
  bets: Bet[];
}

export const StatsOverview: React.FC<StatsOverviewProps> = ({ bets }) => {
  const singleBets = bets.filter(isSingleBet);
  const parlays = bets.filter(isParlay);

  const calculateStats = (betList: Bet[]) => {
    const total = betList.length;
    const won = betList.filter(b => b.status === 'won').length;
    const lost = betList.filter(b => b.status === 'lost').length;
    const pending = betList.filter(b => b.status === 'pending').length;
    const winRate = total > 0 ? (won / (won + lost)) * 100 : 0;
    
    const totalWagered = betList.reduce((sum, bet) => sum + bet.amount, 0);
    const totalWon = betList
      .filter(b => b.status === 'won')
      .reduce((sum, bet) => sum + bet.potentialPayout, 0);
    const totalLost = betList
      .filter(b => b.status === 'lost')
      .reduce((sum, bet) => sum + bet.amount, 0);
    const profitLoss = totalWon - totalWagered;

    return {
      total,
      won,
      lost,
      pending,
      winRate,
      totalWagered,
      totalWon,
      totalLost,
      profitLoss,
    };
  };

  const allStats = calculateStats(bets);
  const singleStats = calculateStats(singleBets);
  const parlayStats = calculateStats(parlays);

  const StatCard = ({ title, value, subtitle, color = 'indigo' }: {
    title: string;
    value: string | number;
    subtitle?: string;
    color?: 'indigo' | 'green' | 'red';
  }) => {
    const textColorClasses = {
      indigo: 'text-indigo-600 dark:text-indigo-400',
      green: 'text-green-600 dark:text-green-400',
      red: 'text-red-600 dark:text-red-400',
    };

    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <h4 className="text-sm md:text-base font-medium text-gray-600 dark:text-gray-400 mb-2">
          {title}
        </h4>
        <div className={`text-3xl md:text-4xl lg:text-5xl font-bold ${textColorClasses[color]}`}>
          {value}
        </div>
        {subtitle && (
          <div className="text-sm md:text-base text-gray-600 dark:text-gray-400 mt-2">
            {subtitle}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-6">Overall Statistics</h2>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Total Bets"
          value={allStats.total}
          color="indigo"
        />
        <StatCard
          title="Wins"
          value={allStats.won}
          color="green"
        />
        <StatCard
          title="Losses"
          value={allStats.lost}
          color="red"
        />
        <StatCard
          title="Win Rate"
          value={`${allStats.winRate.toFixed(1)}%`}
          subtitle={allStats.won + allStats.lost > 0 ? `${allStats.won}/${allStats.won + allStats.lost}` : 'N/A'}
          color="indigo"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <StatCard
          title="Profit/Loss"
          value={`$${allStats.profitLoss.toFixed(2)}`}
          subtitle={`Wagered: $${allStats.totalWagered.toFixed(2)}`}
          color={allStats.profitLoss >= 0 ? 'green' : 'red'}
        />
        <StatCard
          title="Pending Bets"
          value={allStats.pending}
          color="indigo"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        <div>
          <h3 className="text-xl md:text-2xl font-bold mb-4">Single Bets</h3>
          <div className="grid grid-cols-2 gap-4">
            <StatCard title="Total" value={singleStats.total} color="indigo" />
            <StatCard title="Win Rate" value={`${singleStats.winRate.toFixed(1)}%`} color="indigo" />
            <StatCard title="Wins" value={singleStats.won} color="green" />
            <StatCard title="Losses" value={singleStats.lost} color="red" />
          </div>
        </div>

        <div>
          <h3 className="text-xl md:text-2xl font-bold mb-4">Parlays</h3>
          <div className="grid grid-cols-2 gap-4">
            <StatCard title="Total" value={parlayStats.total} color="indigo" />
            <StatCard title="Win Rate" value={`${parlayStats.winRate.toFixed(1)}%`} color="indigo" />
            <StatCard title="Wins" value={parlayStats.won} color="green" />
            <StatCard title="Losses" value={parlayStats.lost} color="red" />
          </div>
        </div>
      </div>
    </div>
  );
};

