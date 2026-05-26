"use client";

import { useState, useEffect, useTransition } from "react";
import { createApiKey, listApiKeys, revokeApiKey } from "@/app/actions/api-keys";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KeyIcon, CopyIcon, TrashIcon, CheckIcon } from "lucide-react";

type ApiKeyRow = { id: string; name: string; keyPrefix: string; lastUsedAt: Date | null; createdAt: Date };

export function ApiKeysSection() {
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [name, setName] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    listApiKeys().then(setKeys);
  }, []);

  function handleCreate() {
    if (!name.trim()) return;
    startTransition(async () => {
      const result = await createApiKey(name.trim());
      setNewKey(result.rawKey);
      setName("");
      const updated = await listApiKeys();
      setKeys(updated);
    });
  }

  function handleRevoke(keyId: string) {
    if (!confirm("Revoke this API key? This cannot be undone.")) return;
    startTransition(async () => {
      await revokeApiKey(keyId);
      const updated = await listApiKeys();
      setKeys(updated);
    });
  }

  function handleCopy() {
    if (newKey) {
      navigator.clipboard.writeText(newKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="rounded-xl border bg-card p-6">
      <div className="flex items-center gap-2 mb-4">
        <KeyIcon className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold">API Keys</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Create API keys to access the Apotho Dashboard API. Keys inherit your permissions.
      </p>

      {/* New key reveal */}
      {newKey && (
        <div className="mb-4 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4">
          <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400 mb-2">
            Copy your API key now — it will not be shown again.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded bg-muted px-3 py-2 text-xs font-mono break-all">{newKey}</code>
            <Button size="sm" variant="outline" onClick={handleCopy}>
              {copied ? <CheckIcon className="h-4 w-4" /> : <CopyIcon className="h-4 w-4" />}
            </Button>
          </div>
          <Button size="sm" variant="ghost" className="mt-2 text-xs" onClick={() => setNewKey(null)}>
            Dismiss
          </Button>
        </div>
      )}

      {/* Create form */}
      <div className="flex gap-2 mb-6">
        <Input
          placeholder="Key name (e.g., Make.com integration)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          className="flex-1"
        />
        <Button onClick={handleCreate} disabled={isPending || !name.trim()}>
          Create Key
        </Button>
      </div>

      {/* Key list */}
      {keys.length === 0 ? (
        <p className="text-sm text-muted-foreground">No API keys yet.</p>
      ) : (
        <div className="space-y-2">
          {keys.map((key) => (
            <div key={key.id} className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{key.name}</p>
                <p className="text-xs text-muted-foreground">
                  <code>{key.keyPrefix}...</code>
                  {" · "}
                  Created {new Date(key.createdAt).toLocaleDateString()}
                  {key.lastUsedAt && <> · Last used {new Date(key.lastUsedAt).toLocaleDateString()}</>}
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => handleRevoke(key.id)} disabled={isPending}>
                <TrashIcon className="h-4 w-4 text-red-500" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
