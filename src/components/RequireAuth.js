// src/components/RequireAuth.jsx
import React from "react";
import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import { Navigate, useLocation } from "react-router-dom";

/**
 * RequireAuth
 * - Blocks access to children until AuthContext finishes hydrating.
 * - If not authenticated, redirects to /login with redirectTo=<path+search>.
 *
 * Usage:
 * <RequireAuth> 
 *   <ProtectedPage />
 * </RequireAuth>
 */
export default function RequireAuth({ children }) {
  const { user, loading } = useContext(AuthContext);
  const location = useLocation();

  // While AuthContext hydrates, show a loading placeholder
  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: "center" }}>
        Loading...
      </div>
    );
  }

  // Not logged in → redirect to login, include current path+search as redirectTo
  if (!user) {
    const redirectTo = encodeURIComponent(location.pathname + (location.search || ""));
    return <Navigate to={`/login?redirectTo=${redirectTo}`} replace />;
  }

  // Authenticated — render children
  return children;
}
