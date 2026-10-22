import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute';
import AppLayout from '@/components/layout/AppLayout';
// Add page imports here
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import WorkOrders from './pages/WorkOrders';
import WorkOrderDetail from './pages/WorkOrderDetail';
import WorkOrderCalendar from './pages/WorkOrderCalendar';
import Scan from './pages/Scan';
import ScanAsset from './pages/ScanAsset';
import PublicAssetRedirect from './pages/PublicAssetRedirect';
import Assets from './pages/Assets';
import AssetDetail from './pages/AssetDetail';
import Inventory from './pages/Inventory';
import SparePartDetail from './pages/SparePartDetail';
import Maintenance from './pages/Maintenance';
import Kpis from './pages/Kpis';
import Users from './pages/Users';

const RequireLogin = () => (
  <Navigate to={`/login?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`} replace />
);

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <Routes>
      {/* Add your page Route elements here */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      <Route element={<ProtectedRoute unauthenticatedElement={<RequireLogin />} />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/work-orders" element={<WorkOrders />} />
          <Route path="/work-orders/calendar" element={<WorkOrderCalendar />} />
          <Route path="/work-orders/:id" element={<WorkOrderDetail />} />
          <Route path="/scan" element={<Scan />} />
          <Route path="/scan/asset/:id" element={<ScanAsset />} />
          <Route path="/public/asset/:id" element={<PublicAssetRedirect />} />
          <Route path="/assets" element={<Assets />} />
          <Route path="/assets/:id" element={<AssetDetail />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/inventory/:id" element={<SparePartDetail />} />
          <Route path="/maintenance" element={<Maintenance />} />
          <Route path="/kpis" element={<Kpis />} />
          <Route path="/users" element={<Users />} />
        </Route>
      </Route>

      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App