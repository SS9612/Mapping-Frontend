import { BrowserRouter, Routes, Route, NavLink, Navigate } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { CompetenceProvider } from "./contexts/CompetenceContext";
import ErrorBoundary from "./components/ErrorBoundary";
import MapPage from "./pages/MapPageDev";
import ReviewPage from "./pages/ReviewPage";
import LoginPage from "./pages/LoginPage";
import "./index.css"; 

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function AppContent() {
  const { logout, username } = useAuth();

  return (
    <div className="app">
      <aside className="sidebar">
        <h2>Mapping LIA</h2>
        <nav>
          <NavLink to="/map">Map competences</NavLink>
          <NavLink to="/review">Review competences</NavLink>
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-user">Logged in as: {username}</div>
          <button onClick={logout} className="btn btn-logout">
            Logout
          </button>
        </div>
      </aside>
      <main className="main">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/map"
            element={
              <ProtectedRoute>
                <MapPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/review"
            element={
              <ProtectedRoute>
                <ReviewPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/review" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <CompetenceProvider>
            <AppContent />
            <ToastContainer />
          </CompetenceProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
