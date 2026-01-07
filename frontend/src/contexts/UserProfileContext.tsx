import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiClient } from '../services/api';
import { Bet, isSingleBet } from '../types/bet';

export interface UserProfile {
  userId: string;
  email: string;
  role: 'user' | 'admin';
  featureFlags: {
    canCreateBets: boolean;
    canManageBets: boolean; // Kept for backward compatibility
    canDeleteBets: boolean;
    canClearWeek: boolean;
    canBetslipImport: boolean;
    // New granular permissions
    seeManageBetsPage: boolean;
    seeManageBetsPageOwn: boolean;
    canEditBets: boolean;
    canEditBetsOwn: boolean;
    canMarkBetFeatures: boolean;
    canMarkBetFeaturesOwn: boolean;
    canMarkBetWinLoss: boolean;
    canMarkBetWinLossOwn: boolean;
  };
  aliases?: string[];
  createdAt?: string;
  updatedAt?: string;
}

interface EditPermissions {
  canEditOverall: boolean;
  canEditLegs?: boolean[];
}

interface WinLossPermissions {
  canMarkOverall: boolean;
  canMarkLegs?: boolean[];
}

interface UserProfileContextType {
  userProfile: UserProfile | null;
  loading: boolean;
  hasFeatureFlag: (flag: keyof UserProfile['featureFlags']) => boolean;
  isAdmin: boolean;
  refreshProfile: () => Promise<void>;
  canSeeManageBetsPage: () => boolean;
  canEditBet: (bet: any) => EditPermissions;
  canMarkFeatured: (bet: any) => boolean;
  canMarkWinLoss: (bet: any) => WinLossPermissions;
}

const UserProfileContext = createContext<UserProfileContextType | undefined>(undefined);

export const UserProfileProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async () => {
    try {
      const profile = await apiClient.getUserProfile();
      // Normalize profile to ensure all feature flags are present with defaults
      const normalizedProfile: UserProfile = {
        ...profile,
        featureFlags: {
          canCreateBets: profile.featureFlags.canCreateBets ?? false,
          canManageBets: profile.featureFlags.canManageBets ?? false,
          canDeleteBets: profile.featureFlags.canDeleteBets ?? false,
          canClearWeek: profile.featureFlags.canClearWeek ?? false,
          canBetslipImport: profile.featureFlags.canBetslipImport ?? false,
          // New granular permissions with defaults
          seeManageBetsPage: profile.featureFlags.seeManageBetsPage ?? false,
          seeManageBetsPageOwn: profile.featureFlags.seeManageBetsPageOwn ?? false,
          canEditBets: profile.featureFlags.canEditBets ?? false,
          canEditBetsOwn: profile.featureFlags.canEditBetsOwn ?? false,
          canMarkBetFeatures: profile.featureFlags.canMarkBetFeatures ?? false,
          canMarkBetFeaturesOwn: profile.featureFlags.canMarkBetFeaturesOwn ?? false,
          canMarkBetWinLoss: profile.featureFlags.canMarkBetWinLoss ?? false,
          canMarkBetWinLossOwn: profile.featureFlags.canMarkBetWinLossOwn ?? false,
        },
        aliases: profile.aliases ?? [],
      };
      setUserProfile(normalizedProfile);
    } catch (err) {
      console.error('Failed to fetch user profile:', err);
      setUserProfile(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const hasFeatureFlag = (flag: keyof UserProfile['featureFlags']): boolean => {
    if (!userProfile) return false;
    return userProfile.featureFlags[flag] || false;
  };

  const isAdmin = userProfile?.role === 'admin' || false;

  const refreshProfile = async () => {
    await fetchProfile();
  };

  const canSeeManageBetsPage = (): boolean => {
    if (!userProfile) return false;
    // Global permission takes precedence
    if (userProfile.featureFlags.seeManageBetsPage) return true;
    // Check "Own" permission
    return userProfile.featureFlags.seeManageBetsPageOwn || false;
  };

  const isAttributedToUser = (attributedTo: string | undefined, userAliases: string[]): boolean => {
    if (!attributedTo || !userAliases || userAliases.length === 0) return false;
    return userAliases.includes(attributedTo);
  };

  const canEditBet = (bet: Bet): EditPermissions => {
    if (!userProfile) {
      return { canEditOverall: false };
    }

    const userAliases = userProfile.aliases || [];
    const flags = userProfile.featureFlags;

    // Global permission takes precedence
    if (flags.canEditBets) {
      if (isSingleBet(bet)) {
        return { canEditOverall: true };
      } else {
        // Parlay - can edit everything
        return {
          canEditOverall: true,
          canEditLegs: bet.legs.map(() => true),
        };
      }
    }

    // Check "Own" permission
    if (!flags.canEditBetsOwn) {
      if (isSingleBet(bet)) {
        return { canEditOverall: false };
      } else {
        return {
          canEditOverall: false,
          canEditLegs: bet.legs.map(() => false),
        };
      }
    }

    // Has "Own" permission - check attribution
    if (isSingleBet(bet)) {
      const canEdit = isAttributedToUser(bet.attributedTo, userAliases);
      return { canEditOverall: canEdit };
    } else {
      // Parlay
      const canEditOverall = isAttributedToUser(bet.attributedTo, userAliases);
      const canEditLegs = bet.legs.map((leg) => isAttributedToUser(leg.attributedTo, userAliases));
      return {
        canEditOverall,
        canEditLegs,
      };
    }
  };

  const canMarkFeatured = (bet: Bet): boolean => {
    if (!userProfile) return false;
    const flags = userProfile.featureFlags;

    // Global permission takes precedence
    if (flags.canMarkBetFeatures) return true;

    // Check "Own" permission
    if (!flags.canMarkBetFeaturesOwn) return false;

    // Check attribution
    const userAliases = userProfile.aliases || [];
    if (isSingleBet(bet)) {
      return isAttributedToUser(bet.attributedTo, userAliases);
    } else {
      // For parlays, check parlay's attributedTo (not legs)
      return isAttributedToUser(bet.attributedTo, userAliases);
    }
  };

  const canMarkWinLoss = (bet: Bet): WinLossPermissions => {
    if (!userProfile) {
      return { canMarkOverall: false };
    }

    const userAliases = userProfile.aliases || [];
    const flags = userProfile.featureFlags;

    // Global permission takes precedence
    if (flags.canMarkBetWinLoss) {
      if (isSingleBet(bet)) {
        return { canMarkOverall: true };
      } else {
        return {
          canMarkOverall: true,
          canMarkLegs: bet.legs.map(() => true),
        };
      }
    }

    // Check "Own" permission
    if (!flags.canMarkBetWinLossOwn) {
      if (isSingleBet(bet)) {
        return { canMarkOverall: false };
      } else {
        return {
          canMarkOverall: false,
          canMarkLegs: bet.legs.map(() => false),
        };
      }
    }

    // Has "Own" permission - check attribution
    if (isSingleBet(bet)) {
      const canMark = isAttributedToUser(bet.attributedTo, userAliases);
      return { canMarkOverall: canMark };
    } else {
      // Parlay
      const canMarkOverall = isAttributedToUser(bet.attributedTo, userAliases);
      const canMarkLegs = bet.legs.map((leg) => isAttributedToUser(leg.attributedTo, userAliases));
      return {
        canMarkOverall,
        canMarkLegs,
      };
    }
  };

  return (
    <UserProfileContext.Provider
      value={{
        userProfile,
        loading,
        hasFeatureFlag,
        isAdmin,
        refreshProfile,
        canSeeManageBetsPage,
        canEditBet,
        canMarkFeatured,
        canMarkWinLoss,
      }}
    >
      {children}
    </UserProfileContext.Provider>
  );
};

export const useUserProfile = () => {
  const context = useContext(UserProfileContext);
  if (context === undefined) {
    throw new Error('useUserProfile must be used within a UserProfileProvider');
  }
  return context;
};

