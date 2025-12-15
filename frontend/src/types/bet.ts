export type BetType = "single" | "parlay";
export type BetStatus = "pending" | "won" | "lost";
export type BetLegBetType = "spread" | "moneyline" | "over/under" | "total";

export interface BetLeg {
  id: string;
  sport: string;
  teams: string;
  betType: BetLegBetType;
  selection: string;
  odds: number;
  status?: BetStatus; // Optional, defaults to 'pending' if not set
  attributedTo?: string; // Optional, name of person who suggested this bet
}

export interface SingleBet {
  betId: string;
  userId: string;
  type: "single";
  status: BetStatus;
  date: string;
  amount: number;
  potentialPayout: number;
  sport: string;
  teams: string;
  betType: BetLegBetType;
  selection: string;
  odds: number;
  createdAt: string;
  updatedAt: string;
  attributedTo?: string; // Optional, name of person who suggested this bet
}

export interface Parlay {
  betId: string;
  userId: string;
  type: "parlay";
  status: BetStatus;
  date: string;
  amount: number;
  potentialPayout: number;
  legs: BetLeg[];
  createdAt: string;
  updatedAt: string;
  attributedTo?: string; // Optional, name of person who suggested this parlay
}

export type Bet = SingleBet | Parlay;

// Type guards
export function isSingleBet(bet: Bet): bet is SingleBet {
  return bet.type === "single";
}

export function isParlay(bet: Bet): bet is Parlay {
  return bet.type === "parlay";
}

// Request types for creating bets
export interface CreateSingleBetRequest {
  type: "single";
  amount: number;
  date: string;
  sport: string;
  teams: string;
  betType: BetLegBetType;
  selection: string;
  odds: number;
  attributedTo?: string; // Optional, name of person who suggested this bet
}

export interface CreateParlayRequest {
  type: "parlay";
  amount: number;
  date: string;
  legs: Omit<BetLeg, "id">[];
  attributedTo?: string; // Optional, name of person who suggested this parlay
}

export type CreateBetRequest = CreateSingleBetRequest | CreateParlayRequest;

// Types for bets extracted from a bet slip image via Bedrock
export type ExtractedSingleBet = CreateSingleBetRequest;
export type ExtractedParlayBet = CreateParlayRequest;
export type ExtractedBet = ExtractedSingleBet | ExtractedParlayBet;


