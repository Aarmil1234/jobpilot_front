import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function Login({
    onLogin,
}: {
    onLogin: () => void;
}) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const login = async () => {
        setLoading(true);
        setError("");

        const { error } =
            await supabase.auth.signInWithPassword({
                email,
                password,
            });

        if (error) {
            setError(error.message);
        } else {
            onLogin();
        }

        setLoading(false);
    };

    return (
        <div className="authPage">
            <div className="authCard">

                <h1>Welcome to JobPilot</h1>

                <p>
                    Sign in to continue to your AI job profile.
                </p>

                <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) =>
                        setEmail(e.target.value)
                    }
                />

                <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) =>
                        setPassword(e.target.value)
                    }
                />

                {error && (
                    <div className="error">
                        {error}
                    </div>
                )}

                <button
                    className="primary"
                    onClick={login}
                    disabled={loading}
                >
                    {loading ? "Signing in..." : "Sign In"}
                </button>

            </div>
        </div>
    );
}