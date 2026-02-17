import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import './App.css';
import Login from './components/Login';
import TicketLookup from './components/TicketLookup';
import PaymentReceipt from './components/PaymentReceipt';
import HPPCallback from './components/HPPCallback';
import HPPCompletion from './components/HPPCompletion';
import AdminLayout from './components/admin/AdminLayout';
import WardenPortal from './components/warden/WardenPortal';
import OperatorLogin from './components/operator/OperatorLogin';
import OperatorDashboard from './components/operator/OperatorDashboard';
import CitizenDashboard from './components/citizen/CitizenDashboard';
import Header from './components/common/Header';
import GlobalLoader from './components/common/GlobalLoader';
import { BrandingProvider } from './contexts/BrandingContext';
import { AuthProvider } from './contexts/AuthContext';

// Component to conditionally render header based on route
function ConditionalHeader() {
  const location = useLocation();
  
  // Only show header on home page
  if (location.pathname === '/') {
    return <Header />;
  }
  
  return null;
}

function AppContent() {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is logged in
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    // Clear all authentication data
    setUser(null);
    localStorage.removeItem('user');
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    
    // Redirect to login page
    navigate('/');
  };

  return (
    <div className="App">
      <ConditionalHeader />
      <Routes>
        <Route path="/" element={<Login onLoginSuccess={handleLogin} />} />
        <Route path="/ticket-lookup" element={<TicketLookup />} />
        <Route path="/payment-receipt" element={<PaymentReceipt />} />
        <Route path="/hpp-callback" element={<HPPCallback />} />
        <Route path="/hpp-complete" element={<HPPCompletion />} />
        <Route path="/admin/*" element={<AdminLayout user={user} onLogout={handleLogout} />} />
        <Route path="/warden" element={<WardenPortal user={user} onLogout={handleLogout} />} />
        <Route path="/operator/login" element={<OperatorLogin />} />
        <Route path="/operator/*" element={<OperatorDashboard />} />
        <Route path="/citizen/dashboard" element={<CitizenDashboard />} />
      </Routes>
    </div>
  );
}

function App() {
  return (
    <BrandingProvider>
      <AuthProvider>
        <Router>
          <GlobalLoader />
          <AppContent />
        </Router>
      </AuthProvider>
    </BrandingProvider>
  );
}

export default App;
