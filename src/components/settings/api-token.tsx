"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";

const MCP_URL = "https://fitflow.shayma.me/api/mcp";

export function ApiToken() {
  const [copied, setCopied] = useState(false);

  async function copyUrl() {
    await navigator.clipboard.writeText(MCP_URL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Claude AI Integration</CardTitle>
        <CardDescription>
          Connect FitFlow to Claude.ai to log food, water, and weight via chat.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <p className="text-sm font-medium">How to connect:</p>
          <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-2">
            <li>
              On Claude.ai, go to{" "}
              <span className="font-medium text-foreground">
                Customize &rarr; Connectors
              </span>
            </li>
            <li>
              Click the{" "}
              <span className="font-medium text-foreground">+</span>
              {" "}button to add a custom connector
            </li>
            <li>
              Enter a name (e.g. &quot;FitFlow&quot;) and paste this URL:
              <div className="flex items-center gap-2 mt-1.5">
                <code className="flex-1 rounded bg-muted px-3 py-2 text-xs font-mono">
                  {MCP_URL}
                </code>
                <Button variant="ghost" size="icon" onClick={copyUrl} className="shrink-0">
                  {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </li>
            <li>
              Click{" "}
              <span className="font-medium text-foreground">Add</span>
              , then{" "}
              <span className="font-medium text-foreground">Connect</span>
            </li>
            <li>
              Sign in with your FitFlow email and password when prompted
            </li>
          </ol>
        </div>
        <div className="rounded-md bg-muted/50 px-3 py-2.5 text-xs text-muted-foreground">
          Once connected, you can ask Claude things like &quot;log 2 cups of water&quot;,
          &quot;what did I eat today?&quot;, or &quot;how was my week?&quot;
        </div>
      </CardContent>
    </Card>
  );
}
