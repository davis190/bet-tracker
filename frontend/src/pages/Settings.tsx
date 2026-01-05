import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useUserProfile } from '../contexts/UserProfileContext';
import { ChangePasswordForm } from '../components/auth/ChangePasswordForm';

export const Settings: React.FC = () => {
  const { logout, user } = useAuth();
  const { userProfile } = useUserProfile();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
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

          {/* Change Password Section */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <ChangePasswordForm />
          </div>
        </div>
      </main>
    </div>
  );
};

