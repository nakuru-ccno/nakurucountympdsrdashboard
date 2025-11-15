import React, { useState, useEffect, useMemo } from 'react';
import { Home, ListChecks, Users, Shield, LogOut, Menu } from 'lucide-react';

// NOTE: This application is designed to use Supabase for authentication and data.
// In this simulated environment, we must include the mandatory global variables
// for Firebase initialization, but their values are ignored and we use a mock
// for Supabase authentication and data access instead.

// ** Required Global Variable Setup (Mocked for Supabase project) **
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
// const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
// -------------------------------------------------------------------

// --- 1. MOCK SUPABASE AUTH & DATA CONTEXT ---
// This hook simulates fetching user information and their assigned RLS user_level.
const useSupabaseAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate initial authentication and profile fetch delay (1 second)
    setLoading(true);

    // Mock User Data with a profile containing the RLS level we discussed
    const mockUser = {
      id: 'a1b2c3d4-e5f6-7g8h-9i0j-k1l2m3n4o5p6',
      email: 'county.admin@nakuru.go.ke',
      user_level: 'County', // Simulating a County-level user for initial testing
      // In Phase 2, this data would come from Supabase Auth and the 'user_profiles' table.
    };

    setTimeout(() => {
      setUser(mockUser);
      setLoading(false);
    }, 1000);
  }, []);

  // Placeholder for a sign-out function
  const signOut = () => {
    setUser(null);
    setLoading(false);
    // In a real app: supabase.auth.signOut();
  };

  return { user, loading, signOut };
};

// --- 2. COMPONENTS ---

// Navigation Item component for the sidebar
const NavItem = ({ icon: Icon, title, onClick, isActive, isCollapsed }) => (
  <button
    onClick={onClick}
    className={`
      flex items-center w-full p-3 my-1 transition duration-200 rounded-lg
      ${isActive ? 'bg-indigo-600 text-white shadow-lg' : 'text-indigo-200 hover:bg-indigo-700'}
    `}
  >
    <Icon className="w-5 h-5" />
    {!isCollapsed && <span className="ml-3 font-medium">{title}</span>}
  </button>
);

// Sidebar Component
const Sidebar = ({ currentView, setCurrentView, user, isCollapsed, setIsCollapsed }) => {
  const navItems = [
    { name: 'Dashboard', icon: Home, view: 'dashboard' },
    { name: 'Case List', icon: ListChecks, view: 'cases' },
    { name: 'Reports', icon: Shield, view: 'reports' },
    { name: 'User Management', icon: Users, view: 'users', requiresAdmin: true },
  ];

  return (
    <div className={`
      h-full bg-indigo-800 text-white shadow-xl transition-all duration-300
      ${isCollapsed ? 'w-20' : 'w-64'}
      flex flex-col flex-shrink-0
    `}>
      <div className="flex items-center justify-between p-4 border-b border-indigo-700">
        {!isCollapsed && (
          <h1 className="text-xl font-bold text-white tracking-wider">MPDSR Nakuru</h1>
        )}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-2 rounded-full hover:bg-indigo-700 text-indigo-200"
          aria-label="Toggle Sidebar"
        >
          <Menu className="w-6 h-6" />
        </button>
      </div>

      <nav className="flex-grow p-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          // Conditional rendering based on mock user_level. Only 'National' can see User Mgmt.
          if (item.requiresAdmin && user.user_level !== 'National') {
            // For now, only show user management for 'National' level in the mock.
            return null;
          }
          return (
            <NavItem
              key={item.view}
              icon={item.icon}
              title={item.name}
              onClick={() => setCurrentView(item.view)}
              isActive={currentView === item.view}
              isCollapsed={isCollapsed}
            />
          );
        })}
      </nav>

      {/* User Info and Logout */}
      <div className={`p-4 border-t border-indigo-700 ${isCollapsed ? 'text-center' : ''}`}>
        {!isCollapsed && (
          <div className="text-sm font-semibold mb-2 truncate">
            {user.email}
          </div>
        )}
        <div className={`text-xs text-indigo-300 mb-3 ${isCollapsed ? 'hidden' : ''}`}>
          Level: <span className="font-bold text-indigo-100">{user.user_level}</span>
        </div>
        <button
          className={`flex items-center justify-center w-full p-2 text-sm transition duration-200 rounded-lg text-red-300 bg-indigo-700 hover:bg-red-600 hover:text-white ${isCollapsed ? 'px-1' : ''}`}
        >
          <LogOut className="w-5 h-5" />
          {!isCollapsed && <span className="ml-2">Logout</span>}
        </button>
      </div>
    </div>
  );
};

// Main Content Placeholders
const DashboardView = ({ user }) => (
  <div className="p-6">
    <h1 className="text-3xl font-bold text-gray-800 mb-6">MPDSR Overview</h1>
    <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-indigo-500">
      <p className="text-gray-600">Welcome, **{user.user_level}** User ({user.email}).</p>
      <p className="mt-2 text-gray-700 font-medium">
        This view is restricted to show data only for your assigned jurisdiction based on RLS.
        Current access: **Nakuru County** (Simulated).
      </p>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-6">
      {['Maternal Deaths', 'Perinatal Deaths', 'Case Audits', 'Facilities'].map((title, i) => (
        <div key={i} className="bg-white p-5 rounded-xl shadow-md transition hover:shadow-xl">
          <p className="text-sm text-indigo-500 font-semibold">{title}</p>
          <p className="text-3xl font-extrabold text-gray-900 mt-1">{i * 25 + 10}</p>
          <p className="text-xs text-gray-500 mt-1">Total count for this period</p>
        </div>
      ))}
    </div>
  </div>
);

const CaseListView = () => (
  <div className="p-6">
    <h1 className="text-3xl font-bold text-gray-800 mb-6">Maternal & Perinatal Case Listing</h1>
    <div className="bg-white p-6 rounded-xl shadow-lg">
      <p className="text-gray-600">This table (to be built) will display filtered MPDSR cases.</p>
      <p className="mt-2 text-sm text-red-500">**RLS Protection in Effect:** Only cases belonging to the authenticated user's jurisdiction are visible.</p>
    </div>
  </div>
);

const ReportsView = () => (
  <div className="p-6">
    <h1 className="text-3xl font-bold text-gray-800 mb-6">Interactive Reports & Visualizations</h1>
    <div className="bg-white p-6 rounded-xl shadow-lg">
      <p className="text-gray-600">Charts and data analytics will be placed here.</p>
      <p className="mt-2 text-sm text-blue-500">Charts will aggregate and display data according to RLS constraints (County level data).</p>
    </div>
  </div>
);

const UserManagementView = () => (
  <div className="p-6">
    <h1 className="text-3xl font-bold text-gray-800 mb-6">User and Role Administration</h1>
    <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-800 p-4 rounded-xl shadow-lg">
      <p className="font-bold">Access Warning:</p>
      <p className="text-sm">This module is typically restricted to 'National' or 'Admin' level users via RLS policies on the `user_profiles` table.</p>
    </div>
  </div>
);

// --- 3. MAIN APPLICATION ---
const App = () => {
  const { user, loading } = useSupabaseAuth();
  const [currentView, setCurrentView] = useState('dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  useEffect(() => {
    // Apply Inter font and set body background
    document.body.style.fontFamily = 'Inter, sans-serif';
    document.body.className = 'bg-gray-100';
  }, []);


  const renderContent = useMemo(() => {
    if (loading) {
      return (
        <div className="flex items-center justify-center flex-grow h-screen">
          <div className="flex flex-col items-center p-6 bg-white rounded-xl shadow-lg">
            <svg className="animate-spin h-8 w-8 text-indigo-600 mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-lg font-medium text-gray-700">Loading User Profile and RLS Configuration...</p>
          </div>
        </div>
      );
    }

    if (!user) {
      // In a real application, this would redirect to a login screen
      return (
        <div className="flex items-center justify-center flex-grow h-screen">
          <div className="p-10 bg-white rounded-xl shadow-2xl text-center">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h1>
            <p className="text-gray-600">Please log in to access the MPDSR Dashboard.</p>
            <button className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition">Go to Login (Mock)</button>
          </div>
        </div>
      );
    }

    switch (currentView) {
      case 'dashboard':
        return <DashboardView user={user} />;
      case 'cases':
        return <CaseListView />;
      case 'reports':
        return <ReportsView />;
      case 'users':
        return <UserManagementView />;
      default:
        return <DashboardView user={user} />;
    }
  }, [loading, user, currentView]);

  return (
    <div className="flex h-screen overflow-hidden">
      {user && (
        <Sidebar
          currentView={currentView}
          setCurrentView={setCurrentView}
          user={user}
          isCollapsed={isSidebarCollapsed}
          setIsCollapsed={setIsSidebarCollapsed}
        />
      )}
      <main className="flex-grow overflow-y-auto transition-all duration-300">
        {renderContent}
      </main>
    </div>
  );
};

export default App;
