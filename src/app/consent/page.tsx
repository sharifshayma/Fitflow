"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Leaf } from "lucide-react";

// OAuth consent screen. The MCP/OIDC plugin redirects here with consent_code,
// client_id and scope; we POST the decision to the consent endpoint and follow
// the returned redirectURI back to the client (e.g. the Claude connector).
export default function ConsentPage() {
  const [consentCode, setConsentCode] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string>("The application");
  const [scopes, setScopes] = useState<string[]>([]);
  const [loading, setLoading] = useState<null | "accept" | "deny">(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setConsentCode(params.get("consent_code"));
    if (params.get("client_id")) setClientId(params.get("client_id")!);
    const scope = params.get("scope");
    if (scope) setScopes(scope.split(" ").filter(Boolean));
  }, []);

  const decide = async (accept: boolean) => {
    setLoading(accept ? "accept" : "deny");
    setError(null);
    try {
      const res = await fetch("/api/auth/oauth2/consent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ accept, consent_code: consentCode }),
      });
      const data = await res.json();
      if (data?.redirectURI) {
        window.location.href = data.redirectURI;
        return;
      }
      setError(data?.error_description ?? "Something went wrong. Please try again.");
      setLoading(null);
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(null);
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
            <h1 className="text-xl font-bold tracking-tight">Authorize access</h1>
            <p className="text-sm text-muted-foreground mt-1">
              <span className="font-medium text-foreground">{clientId}</span> wants to access
              your FitFlow goals and logs.
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {scopes.length > 0 && (
            <ul className="text-sm text-muted-foreground bg-muted/50 rounded-lg px-3 py-2 space-y-1">
              {scopes.map((s) => (
                <li key={s}>• {s}</li>
              ))}
            </ul>
          )}
          {error && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              disabled={loading !== null}
              onClick={() => decide(false)}
            >
              {loading === "deny" ? "..." : "Deny"}
            </Button>
            <Button
              className="flex-1"
              disabled={loading !== null || !consentCode}
              onClick={() => decide(true)}
            >
              {loading === "accept" ? "..." : "Allow"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
