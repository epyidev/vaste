import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Button, Input } from "../components/ui";

const LoginPage: React.FC = () => {
  const { state, login } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (state.isAuthenticated) {
      navigate("/");
    }
  }, [state.isAuthenticated, navigate]);

  const containerStyles: React.CSSProperties = {
    maxWidth: "1200px",
    margin: "0 auto",
    padding: "1rem 2rem",
    width: "100%",
    minHeight: "calc(100vh - 160px)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  };

  const formContainerStyle: React.CSSProperties = {
    maxWidth: "500px",
    width: "100%",
  };

  const titleStyles: React.CSSProperties = {
    color: "#ffffff",
    fontSize: "2rem",
    fontWeight: "bold",
    marginBottom: "0.5rem",
    textAlign: "center",
  };

  const subtitleStyles: React.CSSProperties = {
    fontSize: "1rem",
    color: "#ccc",
    textAlign: "center",
    marginBottom: "2rem",
  };

  const formStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: "1.5rem",
  };

  const errorStyles: React.CSSProperties = {
    background: "rgba(239, 68, 68, 0.1)",
    color: "rgba(239, 68, 68, 0.9)",
    padding: "1rem",
    borderRadius: "8px",
    border: "1px solid rgba(239, 68, 68, 0.2)",
    marginBottom: "1rem",
  };

  const linkStyles: React.CSSProperties = {
    textAlign: "center",
    marginTop: "1.5rem",
    color: "#ccc",
  };

  const linkButtonStyles: React.CSSProperties = {
    color: "#61dafb",
    textDecoration: "none",
    fontWeight: "500",
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setAuthError(""); // Clear error when user types
  };

  const validateForm = () => {
    if (!formData.email.trim()) {
      setAuthError("Email is required");
      return false;
    }
    if (!formData.password) {
      setAuthError("Password is required");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setAuthLoading(true);
    setAuthError("");

    try {
      const result = await login(formData.email.trim(), formData.password);
      if (!result.success) {
        setAuthError(result.message || "Login failed");
      }
      // Redirect will happen automatically via useEffect
    } catch (error: any) {
      setAuthError(error.message || "Login failed");
    } finally {
      setAuthLoading(false);
    }
  };

  return (
    <div style={containerStyles}>
      <div style={formContainerStyle}>
        <h1 style={titleStyles}>Welcome Back</h1>
        <p style={subtitleStyles}>Sign in to your Vaste account</p>

        {authError && <div style={errorStyles}>{authError}</div>}

        <form onSubmit={handleSubmit} style={formStyle}>
          <Input
            label="Email"
            type="email"
            value={formData.email}
            onChange={(e) => handleInputChange("email", e.target.value)}
            placeholder="Enter your email"
          />

          <Input
            label="Password"
            type="password"
            value={formData.password}
            onChange={(e) => handleInputChange("password", e.target.value)}
            placeholder="Enter your password"
          />

          <Button
            variant="primary"
            onClick={() => {
              const form = document.querySelector("form");
              if (form) form.requestSubmit();
            }}
            disabled={authLoading}
            style={{ width: "100%", marginTop: "1rem" }}
          >
            {authLoading ? "Signing in..." : "Sign In"}
          </Button>
        </form>

        <div style={linkStyles}>
          Don't have an account?{" "}
          <Link to="/register" style={linkButtonStyles}>
            Create one here
          </Link>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
