import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiClient } from '../services/api';

export interface UserProfile {
  userId: string;
  email: string;
  role: 'user' | 'admin';
  featureFlags: {
    canCreateBets: boolean;
    canManageBets: boolean;
    canDeleteBets: boolean;
    canClearWeek: boolean;
    canBetslipImport: boolean;
  };
  createdAt?: string;
  updatedAt?: string;
}

interface UserProfileContextType {
  userProfile: UserProfile | null;
  loading: boolean;
  hasFeatureFlag: (flag: keyof UserProfile['featureFlags']) => boolean;
  isAdmin: boolean;
  refreshProfile: () => Promise<void>;
}

const UserProfileContext = createContext<UserProfileContextType | undefined>(undefined);

export const UserProfileProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async () => {
    try {
      const profile = await apiClient.getUserProfile();
      setUserProfile(profile);
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

  return (
    <UserProfileContext.Provider
      value={{
        userProfile,
        loading,
        hasFeatureFlag,
        isAdmin,
        refreshProfile,
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

