import { useState } from "react";
import Dashbord from "./pages/DashboardPage/Dashbord.jsx";
import Login from "./pages/LoginPage/Login.jsx";
import { clearAuthSession, readAuthSession, saveAuthSession } from "./services/auth.js";

export default function App() {
  const [session, setSession] = useState(readAuthSession);
  // Preview dashboard saat development, kecuali membuka login atau registrasi.
  const [previewDashboard, setPreviewDashboard] = useState(
    () => import.meta.env.DEV && !["login", "register"].includes(new URLSearchParams(window.location.search).get("page")),
  );

  function handleLogin(nextSession) {
    saveAuthSession(nextSession);
    setSession(nextSession);
  }

  function handleLogout() {
    clearAuthSession();
    setSession(null);
    setPreviewDashboard(false);
  }

  return session || previewDashboard
    ? <Dashbord profile={session?.user} onLogout={handleLogout} />
    : <Login onSuccess={handleLogin} />;
}
