import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useUserProfile } from '../contexts/UserProfileContext';
import { ChangePasswordForm } from '../components/auth/ChangePasswordForm';
import { apiClient } from '../services/api';

export const Settings: React.FC = () => {
  const { logout, user } = useAuth();
  const { userProfile, refreshProfile } = useUserProfile();
  const navigate = useNavigate();
  const [newAlias, setNewAlias] = useState('');
  const [saving, setSaving] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const handleAddAlias = async () => {
    if (!newAlias.trim() || !userProfile) return;
    
    const currentAliases = userProfile.aliases || [];
    if (currentAliases.includes(newAlias.trim())) {
      alert('This alias already exists');
      return;
    }

    setSaving(true);
    try {
      await apiClient.updateUserProfile({
        aliases: [...currentAliases, newAlias.trim()],
      });
      setNewAlias('');
      await refreshProfile();
    } catch (err) {
      console.error('Failed to add alias:', err);
      alert('Failed to add alias. You may need admin permissions.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveAlias = async (aliasToRemove: string) => {
    if (!userProfile) return;
    
    const currentAliases = userProfile.aliases || [];
    const updatedAliases = currentAliases.filter((a: string) => a !== aliasToRemove);

    setSaving(true);
    try {
      await apiClient.updateUserProfile({
        aliases: updatedAliases,
      });
      await refreshProfile();
    } catch (err) {
      console.error('Failed to remove alias:', err);
      alert('Failed to remove alias. You may need admin permissions.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <nav className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold">Settings</h1>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600 dark:text-gray-300">{user?.email}</span>
              <button
                onClick={() => navigate('/admin')}
                className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                Admin
              </button>
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm text-white bg-indigo-600 rounded hover:bg-indigo-700"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {/* User Profile Section */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">User Profile</h2>
            {userProfile && (
              <div className="space-y-2">
                <div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Email:</span>
                  <span className="ml-2 text-gray-900 dark:text-white">{userProfile.email}</span>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Role:</span>
                  <span className="ml-2 text-gray-900 dark:text-white capitalize">{userProfile.role}</span>
                </div>
              </div>
            )}
          </div>

          {/* Aliases Section */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Aliases</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Aliases are used to identify bets attributed to you. If you have "Own" permissions,
              you can only manage bets that are attributed to one of your aliases.
            </p>
            <div className="space-y-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newAlias}
                  onChange={(e) => setNewAlias(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleAddAlias();
                    }
                  }}
                  placeholder="Enter new alias"
                  className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2"
                  disabled={saving}
                />
                <button
                  onClick={handleAddAlias}
                  disabled={saving || !newAlias.trim()}
                  className="px-4 py-2 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add
                </button>
              </div>
              {userProfile && userProfile.aliases && userProfile.aliases.length > 0 ? (
                <div className="space-y-2">
                  {userProfile.aliases.map((alias, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded"
                    >
                      <span className="text-sm text-gray-900 dark:text-white">{alias}</span>
                      <button
                        onClick={() => handleRemoveAlias(alias)}
                        disabled={saving}
                        className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                  No aliases configured. Add an alias to manage bets attributed to you.
                </p>
              )}
            </div>
          </div>

          {/* Change Password Section */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <ChangePasswordForm />
          </div>
        </div>
      </main>
    </div>
  );
};

