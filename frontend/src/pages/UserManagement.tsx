import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useUserProfile, UserProfile } from '../contexts/UserProfileContext';
import { apiClient } from '../services/api';
import { LoadingSpinner } from '../components/shared/LoadingSpinner';

export const UserManagement: React.FC = () => {
  const { logout, user } = useAuth();
  const { userProfile, isAdmin } = useUserProfile();
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editedUser, setEditedUser] = useState<Partial<UserProfile> | null>(null);

  useEffect(() => {
    if (!isAdmin) {
      navigate('/admin');
      return;
    }
    loadUsers();
  }, [isAdmin, navigate]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const usersList = await apiClient.listUsers();
      // Normalize users to ensure all feature flags are present with defaults
      const normalizedUsers: UserProfile[] = usersList.map((user) => ({
        ...user,
        featureFlags: {
          canCreateBets: user.featureFlags.canCreateBets ?? false,
          canManageBets: user.featureFlags.canManageBets ?? false,
          canDeleteBets: user.featureFlags.canDeleteBets ?? false,
          canClearWeek: user.featureFlags.canClearWeek ?? false,
          canBetslipImport: user.featureFlags.canBetslipImport ?? false,
          seeManageBetsPage: user.featureFlags.seeManageBetsPage ?? false,
          seeManageBetsPageOwn: user.featureFlags.seeManageBetsPageOwn ?? false,
          canEditBets: user.featureFlags.canEditBets ?? false,
          canEditBetsOwn: user.featureFlags.canEditBetsOwn ?? false,
          canMarkBetFeatures: user.featureFlags.canMarkBetFeatures ?? false,
          canMarkBetFeaturesOwn: user.featureFlags.canMarkBetFeaturesOwn ?? false,
          canMarkBetWinLoss: user.featureFlags.canMarkBetWinLoss ?? false,
          canMarkBetWinLossOwn: user.featureFlags.canMarkBetWinLossOwn ?? false,
        },
        aliases: user.aliases ?? [],
      }));
      setUsers(normalizedUsers);
    } catch (err: any) {
      console.error('Failed to load users:', err);
      setError(err.response?.data?.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (user: UserProfile) => {
    setEditingUser(user.userId);
    setEditedUser({
      ...user,
      featureFlags: { ...user.featureFlags },
      aliases: user.aliases ? [...user.aliases] : [],
    });
  };

  const handleCancelEdit = () => {
    setEditingUser(null);
    setEditedUser(null);
  };

  const handleFeatureFlagChange = (flagName: keyof UserProfile['featureFlags'], value: boolean) => {
    if (!editedUser) return;
    setEditedUser({
      ...editedUser,
      featureFlags: {
        ...editedUser.featureFlags!,
        [flagName]: value,
      },
    });
  };

  const handleRoleChange = (role: 'user' | 'admin') => {
    if (!editedUser) return;
    setEditedUser({
      ...editedUser,
      role,
    });
  };

  const handleAddAlias = () => {
    if (!editedUser) return;
    const newAlias = prompt('Enter new alias:');
    if (newAlias && newAlias.trim()) {
      const currentAliases = editedUser.aliases || [];
      if (currentAliases.includes(newAlias.trim())) {
        alert('This alias already exists');
        return;
      }
      setEditedUser({
        ...editedUser,
        aliases: [...currentAliases, newAlias.trim()],
      });
    }
  };

  const handleRemoveAlias = (aliasToRemove: string) => {
    if (!editedUser) return;
    const currentAliases = editedUser.aliases || [];
    setEditedUser({
      ...editedUser,
      aliases: currentAliases.filter((a) => a !== aliasToRemove),
    });
  };

  const handleSave = async (userId: string) => {
    if (!editedUser) return;

    try {
      setSaving(userId);
      setError(null);

      const updates: any = {
        userId,
      };

      if (editedUser.role !== undefined) {
        updates.role = editedUser.role;
      }

      if (editedUser.featureFlags) {
        updates.featureFlags = editedUser.featureFlags;
      }

      // Only allow editing aliases if not editing own profile
      if (editedUser.aliases !== undefined && userId !== userProfile?.userId) {
        updates.aliases = editedUser.aliases;
      }

      await apiClient.updateUserProfile(updates);
      await loadUsers();
      setEditingUser(null);
      setEditedUser(null);
    } catch (err: any) {
      console.error('Failed to update user:', err);
      setError(err.response?.data?.message || 'Failed to update user');
    } finally {
      setSaving(null);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  if (!isAdmin) {
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <nav className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold">User Management</h1>
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
                onClick={() => navigate('/settings')}
                className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                Settings
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-4 bg-red-100 dark:bg-red-900 border border-red-400 text-red-700 dark:text-red-300 px-4 py-3 rounded">
            {error}
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Feature Flags
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Aliases
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {users.map((userItem) => {
                  const isCurrentUser = userItem.userId === userProfile?.userId;
                  const isEditing = editingUser === userItem.userId;
                  const displayUser = isEditing && editedUser ? editedUser : userItem;

                  return (
                    <tr
                      key={userItem.userId}
                      className={isCurrentUser ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {displayUser.email}
                          {isCurrentUser && (
                            <span className="ml-2 text-xs text-indigo-600 dark:text-indigo-400">(You)</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {isEditing ? (
                          <select
                            value={displayUser.role}
                            onChange={(e) => handleRoleChange(e.target.value as 'user' | 'admin')}
                            className="text-sm rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                          >
                            <option value="user">User</option>
                            <option value="admin">Admin</option>
                          </select>
                        ) : (
                          <span className="text-sm text-gray-900 dark:text-white capitalize">
                            {displayUser.role}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm space-y-1">
                          {isEditing ? (
                            <div className="space-y-2">
                              <div className="flex items-center">
                                <input
                                  type="checkbox"
                                  checked={displayUser.featureFlags?.canCreateBets || false}
                                  onChange={(e) => handleFeatureFlagChange('canCreateBets', e.target.checked)}
                                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                />
                                <label className="ml-2 text-gray-700 dark:text-gray-300">Create Bets</label>
                              </div>
                              <div className="flex items-center">
                                <input
                                  type="checkbox"
                                  checked={displayUser.featureFlags?.canDeleteBets || false}
                                  onChange={(e) => handleFeatureFlagChange('canDeleteBets', e.target.checked)}
                                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                />
                                <label className="ml-2 text-gray-700 dark:text-gray-300">Delete Bets</label>
                              </div>
                              <div className="flex items-center">
                                <input
                                  type="checkbox"
                                  checked={displayUser.featureFlags?.canClearWeek || false}
                                  onChange={(e) => handleFeatureFlagChange('canClearWeek', e.target.checked)}
                                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                />
                                <label className="ml-2 text-gray-700 dark:text-gray-300">Clear Week</label>
                              </div>
                              <div className="flex items-center">
                                <input
                                  type="checkbox"
                                  checked={displayUser.featureFlags?.canBetslipImport || false}
                                  onChange={(e) => handleFeatureFlagChange('canBetslipImport', e.target.checked)}
                                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                />
                                <label className="ml-2 text-gray-700 dark:text-gray-300">Betslip Import</label>
                              </div>
                              <div className="flex items-center">
                                <input
                                  type="checkbox"
                                  checked={displayUser.featureFlags?.seeManageBetsPage || false}
                                  onChange={(e) => handleFeatureFlagChange('seeManageBetsPage', e.target.checked)}
                                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                />
                                <label className="ml-2 text-gray-700 dark:text-gray-300">See Manage Page</label>
                              </div>
                              <div className="flex items-center">
                                <input
                                  type="checkbox"
                                  checked={displayUser.featureFlags?.seeManageBetsPageOwn || false}
                                  onChange={(e) => handleFeatureFlagChange('seeManageBetsPageOwn', e.target.checked)}
                                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                />
                                <label className="ml-2 text-gray-700 dark:text-gray-300">See Manage Page (Own)</label>
                              </div>
                              <div className="flex items-center">
                                <input
                                  type="checkbox"
                                  checked={displayUser.featureFlags?.canEditBets || false}
                                  onChange={(e) => handleFeatureFlagChange('canEditBets', e.target.checked)}
                                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                />
                                <label className="ml-2 text-gray-700 dark:text-gray-300">Edit Bets</label>
                              </div>
                              <div className="flex items-center">
                                <input
                                  type="checkbox"
                                  checked={displayUser.featureFlags?.canEditBetsOwn || false}
                                  onChange={(e) => handleFeatureFlagChange('canEditBetsOwn', e.target.checked)}
                                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                />
                                <label className="ml-2 text-gray-700 dark:text-gray-300">Edit Bets (Own)</label>
                              </div>
                              <div className="flex items-center">
                                <input
                                  type="checkbox"
                                  checked={displayUser.featureFlags?.canMarkBetFeatures || false}
                                  onChange={(e) => handleFeatureFlagChange('canMarkBetFeatures', e.target.checked)}
                                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                />
                                <label className="ml-2 text-gray-700 dark:text-gray-300">Mark Featured</label>
                              </div>
                              <div className="flex items-center">
                                <input
                                  type="checkbox"
                                  checked={displayUser.featureFlags?.canMarkBetFeaturesOwn || false}
                                  onChange={(e) => handleFeatureFlagChange('canMarkBetFeaturesOwn', e.target.checked)}
                                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                />
                                <label className="ml-2 text-gray-700 dark:text-gray-300">Mark Featured (Own)</label>
                              </div>
                              <div className="flex items-center">
                                <input
                                  type="checkbox"
                                  checked={displayUser.featureFlags?.canMarkBetWinLoss || false}
                                  onChange={(e) => handleFeatureFlagChange('canMarkBetWinLoss', e.target.checked)}
                                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                />
                                <label className="ml-2 text-gray-700 dark:text-gray-300">Mark Win/Loss</label>
                              </div>
                              <div className="flex items-center">
                                <input
                                  type="checkbox"
                                  checked={displayUser.featureFlags?.canMarkBetWinLossOwn || false}
                                  onChange={(e) => handleFeatureFlagChange('canMarkBetWinLossOwn', e.target.checked)}
                                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                />
                                <label className="ml-2 text-gray-700 dark:text-gray-300">Mark Win/Loss (Own)</label>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              {Object.entries(displayUser.featureFlags || {})
                                .filter(([_, value]) => value)
                                .map(([key]) => (
                                  <div key={key} className="text-gray-600 dark:text-gray-400">
                                    {key}
                                  </div>
                                ))}
                              {Object.values(displayUser.featureFlags || {}).every((v) => !v) && (
                                <span className="text-gray-400 dark:text-gray-500 italic">None</span>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {isEditing ? (
                          <div className="space-y-2">
                            <div className="flex flex-wrap gap-2">
                              {(displayUser.aliases || []).map((alias, idx) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center px-2 py-1 rounded text-xs bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                                >
                                  {alias}
                                  {!isCurrentUser && (
                                    <button
                                      onClick={() => handleRemoveAlias(alias)}
                                      className="ml-1 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                                    >
                                      ×
                                    </button>
                                  )}
                                </span>
                              ))}
                            </div>
                            {!isCurrentUser && (
                              <button
                                onClick={handleAddAlias}
                                className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300"
                              >
                                + Add Alias
                              </button>
                            )}
                            {isCurrentUser && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                                You cannot edit your own aliases
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {(displayUser.aliases || []).length > 0 ? (
                              (displayUser.aliases || []).map((alias, idx) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center px-2 py-1 rounded text-xs bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                                >
                                  {alias}
                                </span>
                              ))
                            ) : (
                              <span className="text-sm text-gray-400 dark:text-gray-500 italic">None</span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {isEditing ? (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleSave(userItem.userId)}
                              disabled={saving === userItem.userId}
                              className="px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {saving === userItem.userId ? 'Saving...' : 'Save'}
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              disabled={saving === userItem.userId}
                              className="px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleEdit(userItem)}
                            className="px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                          >
                            Edit
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
};

