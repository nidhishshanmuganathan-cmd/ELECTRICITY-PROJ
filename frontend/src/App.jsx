import { lazy, Suspense, useEffect, useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import { AuthProvider, useAuth } from "./AuthContext";
import { ensureForegroundListener } from "./notifications";

import { AppLayout, LoadingState } from "./components/ui";
import { useTranslation } from "./utils/translate";
const SignIn = lazy(() => import("./components/SignIn"));
const CreateAccount = lazy(() => import("./components/CreateAccount"));
const HomeDashboard = lazy(() => import("./components/HomeDashboard"));
const Analysis = lazy(() => import("./components/Analysis"));
const Insights = lazy(() => import("./components/Insights"));
const History = lazy(() => import("./components/History"));
const Profile = lazy(() => import("./components/Profile"));
const Devices = lazy(() => import("./components/Devices"));
const Alerts = lazy(() => import("./components/Alerts"));

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="page-content">
        <LoadingState />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/signin" replace />;
  }

  return (
    <AppLayout>
      <Suspense fallback={<LoadingState />}>{children}</Suspense>
    </AppLayout>
  );
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="page-content">
        <LoadingState />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return (
    <Suspense
      fallback={
        <div className="page-content">
          <LoadingState />
        </div>
      }
    >
      {children}
    </Suspense>
  );
}

function PushRegistration() {
  const { user } = useAuth();

  useEffect(() => {
    if (user?.firebaseUser) {
      ensureForegroundListener();
    }
  }, [user?.firebaseUser]);

  return null;
}

export default function App() {
  const { t, currentLanguage } = useTranslation();
  useEffect(() => {
    document.documentElement.lang =
      { English: "en", Hindi: "hi", Tamil: "ta", Telugu: "te" }[
        currentLanguage
      ] || "en";
  }, [currentLanguage]);
  useEffect(() => {
    if ("serviceWorker" in navigator && window.isSecureContext) {
      navigator.serviceWorker
        .register("/firebase-messaging-sw.js")
        .catch(() => {});
    }
  }, []);
  const [pushMessage, setPushMessage] = useState(null);

  useEffect(() => {
    const showPushMessage = (event) => {
      setPushMessage(event.detail);
    };

    window.addEventListener("wattwatcher:push", showPushMessage);
    return () => {
      window.removeEventListener("wattwatcher:push", showPushMessage);
    };
  }, []);

  useEffect(() => {
    const handleThemeChange = () => {
      const isLight = localStorage.getItem("wattwatcher_theme") === "light";

      if (isLight) {
        document.body.classList.add("light-theme");
      } else {
        document.body.classList.remove("light-theme");
      }
    };

    handleThemeChange();

    window.addEventListener("themeChange", handleThemeChange);

    return () => {
      window.removeEventListener("themeChange", handleThemeChange);
    };
  }, []);

  return (
    <AuthProvider>
      <PushRegistration />
      <Router>
        {pushMessage && (
          <div role="status" className="toast push-toast">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">
                {pushMessage.title}
              </p>
              <p className="mt-1 text-xs text-gray-300">{pushMessage.body}</p>
            </div>
            <button
              onClick={() => setPushMessage(null)}
              className="mt-2 text-xs font-medium text-electric"
            >
              {t("dismiss")}
            </button>
          </div>
        )}
        <Routes>
          <Route
            path="/alerts"
            element={
              <ProtectedRoute>
                <Alerts />
              </ProtectedRoute>
            }
          />

          {/* Login pages */}
          <Route
            path="/signin"
            element={
              <PublicRoute>
                <SignIn />
              </PublicRoute>
            }
          />

          <Route
            path="/create-account"
            element={
              <PublicRoute>
                <CreateAccount />
              </PublicRoute>
            }
          />

          {/* Protected pages */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <HomeDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/analysis"
            element={
              <ProtectedRoute>
                <Analysis />
              </ProtectedRoute>
            }
          />

          <Route
            path="/insights"
            element={
              <ProtectedRoute>
                <Insights />
              </ProtectedRoute>
            }
          />

          <Route
            path="/history"
            element={
              <ProtectedRoute>
                <History />
              </ProtectedRoute>
            }
          />

          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />

          <Route
            path="/devices"
            element={
              <ProtectedRoute>
                <Devices />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
