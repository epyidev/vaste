/**
 * GamePage.tsx - Game page component
 * Page that renders the Game component with authentication check
 */

import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Game } from "../Game";

export const GamePage: React.FC = () => {
  const { serverUrl: encodedServerUrl } = useParams<{ serverUrl: string }>();
  const navigate = useNavigate();
  const { state: authState } = useAuth();

  const serverUrl = encodedServerUrl ? decodeURIComponent(encodedServerUrl) : "";

  // Redirect to login if not authenticated
  if (!authState.isAuthenticated) {
    navigate("/login");
    return null;
  }

  // Redirect to server list if no server URL
  if (!serverUrl) {
    navigate("/servers");
    return null;
  }

  // Render game (Game component handles all connection logic internally)
  return (
    <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", zIndex: 9999 }}>
      <Game serverUrl={serverUrl} user={authState.user} />
    </div>
  );
};

export default GamePage;
