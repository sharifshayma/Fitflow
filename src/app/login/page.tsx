"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn, signUp } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Leaf } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Where to send the user after a successful sign-in/sign-up.
  //
  // The OAuth/MCP authorize endpoint (better-auth's MCP plugin) redirects an
  // unauthenticated user to `/login?<authorize query>` while it parks the
  // request in a cookie. Once signed in we must return to that authorize
  // endpoint so the flow can continue to the consent screen and back to the
  // client's callback (e.g. Claude's connector). If we instead land on the
  // dashboard, the authorization never completes and the connector reports
  // "MCP authorization callback failed". When there are no OAuth params this is
  // an ordinary login, so we go to the dashboard.
  const postLoginDestination = () => {
    const search = window.location.search;
    const params = new URLSearchParams(search);
    if (params.has("client_id")) {
      return `/api/auth/mcp/authorize${search}`;
    }
    return "/";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (isSignUp) {
      const { error } = await signUp.email({
        email,
        password,
        name: email.split("@")[0],
      });
      if (error) {
        setError(error.message ?? "Could not create account.");
        setLoading(false);
      } else {
        window.location.href = postLoginDestination();
      }
    } else {
      const { error } = await signIn.email({ email, password });
      if (error) {
        setError(error.message ?? "Could not sign in.");
        setLoading(false);
      } else {
        window.location.href = postLoginDestination();
      }
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center space-y-4 pb-2">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <Leaf className="h-8 w-8 text-primary" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight">FitFlow</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {isSignUp ? "Create your account" : "Welcome back"}
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>

            {error && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading
                ? "Loading..."
                : isSignUp
                  ? "Create Account"
                  : "Sign In"}
            </Button>

            {!isSignUp && (
              <p className="text-center text-sm">
                <Link
                  href="/forgot-password"
                  className="font-medium text-muted-foreground hover:text-foreground hover:underline"
                >
                  Forgot your password?
                </Link>
              </p>
            )}

            <p className="text-center text-sm text-muted-foreground">
              {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setError(null);
                }}
                className="font-medium text-primary hover:underline"
              >
                {isSignUp ? "Sign in" : "Sign up"}
              </button>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
