import { FormEvent, useState } from "react";
import {
  Mail,
  Lock,
  Sparkles,
} from "lucide-react";

import { supabase } from "./lib/supabase";

type AuthProps = {
  onAuthenticated: () => void;
};

export default function Auth({
  onAuthenticated,
}: AuthProps) {
  const [mode, setMode] =
    useState<"login" | "signup">("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = async (
    e: FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    setError("");
    setMessage("");

    if (!email.trim()) {
      setError("Please enter your email.");
      return;
    }

    if (!password) {
      setError("Please enter your password.");
      return;
    }

    if (password.length < 6) {
      setError(
        "Password must contain at least 6 characters."
      );
      return;
    }

    setLoading(true);

    try {
      if (mode === "login") {
        const { data, error } =
          await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          });

        if (error) {
          throw error;
        }

        if (!data.user) {
          throw new Error("Login failed.");
        }

        onAuthenticated();
      } else {
        const { data, error } =
          await supabase.auth.signUp({
            email: email.trim(),
            password,
          });

        if (error) {
          throw error;
        }

        /*
         * If email confirmation is disabled,
         * Supabase will return a session immediately.
         */
        if (data.session) {
          onAuthenticated();
        } else {
          setMessage(
            "Account created successfully. Please check your email to verify your account before signing in."
          );

          setMode("login");
        }
      }
    } catch (err: any) {
      console.error("Authentication error:", err);

      setError(
        err?.message ||
          "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="authPage">
      <div className="authCard">

        {/* BRAND */}

        <div className="authBrand">
          <div className="authLogo">
            <Sparkles size={20} />
          </div>

          <div>
            <strong>JobPilot</strong>
            <span>AI</span>
          </div>
        </div>

        {/* HEADER */}

        <div className="authHeader">
          <h1>
            {mode === "login"
              ? "Welcome back"
              : "Create your account"}
          </h1>

          <p>
            {mode === "login"
              ? "Sign in to continue to your JobPilot workspace."
              : "Create your account and build your AI-powered job profile."}
          </p>
        </div>

        {/* FORM */}

        <form onSubmit={handleSubmit}>

          {/* EMAIL */}

          <div className="authField">
            <label>Email</label>

            <div className="authInput">
              <Mail size={17} />

              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) =>
                  setEmail(e.target.value)
                }
                autoComplete="email"
              />
            </div>
          </div>

          {/* PASSWORD */}

          <div className="authField">
            <label>Password</label>

            <div className="authInput">
              <Lock size={17} />

              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) =>
                  setPassword(e.target.value)
                }
                autoComplete={
                  mode === "login"
                    ? "current-password"
                    : "new-password"
                }
              />
            </div>
          </div>

          {/* ERROR */}

          {error && (
            <div className="authError">
              {error}
            </div>
          )}

          {/* MESSAGE */}

          {message && (
            <div className="authMessage">
              {message}
            </div>
          )}

          {/* SUBMIT */}

          <button
            className="authSubmit"
            type="submit"
            disabled={loading}
          >
            {loading
              ? "Please wait..."
              : mode === "login"
              ? "Sign In"
              : "Create Account"}
          </button>
        </form>

        {/* SWITCH */}

        <div className="authSwitch">
          {mode === "login" ? (
            <>
              <span>
                Don't have an account?
              </span>

              <button
                type="button"
                onClick={() => {
                  setMode("signup");
                  setError("");
                  setMessage("");
                }}
              >
                Create one
              </button>
            </>
          ) : (
            <>
              <span>
                Already have an account?
              </span>

              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setError("");
                  setMessage("");
                }}
              >
                Sign in
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  );
}