// Meta Connect Component
// Connect Facebook Page and Instagram Business account to team

import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';

interface MetaAccount {
  connected: boolean;
  page?: { id: string; name: string };
  instagram?: { id: string; username: string };
  tokenExpired?: boolean;
}

interface MetaConnectProps {
  teamId: number;
}

export function MetaConnect({ teamId }: MetaConnectProps) {
  const [account, setAccount] = useState<MetaAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [location, setLocation] = useLocation();

  useEffect(() => {
    fetchAccount();
  }, [teamId]);

  // Check for OAuth callback params in URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get('meta_connected');
    const error = params.get('meta_error');
    
    if (connected === 'true') {
      fetchAccount();
      // Clear URL params
      window.history.replaceState({}, '', window.location.pathname);
    }
    
    if (error) {
      alert(`Connection failed: ${decodeURIComponent(error)}`);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const fetchAccount = async () => {
    try {
      const res = await fetch(`/api/meta/account/${teamId}`);
      const data = await res.json();
      setAccount(data);
    } catch (err) {
      console.error('Failed to fetch Meta account:', err);
    } finally {
      setLoading(false);
    }
  };

  const connectMeta = () => {
    setConnecting(true);
    window.location.href = `/api/meta/connect?team_id=${teamId}`;
  };

  const disconnectMeta = async () => {
    if (!confirm('Disconnect this team\'s Facebook Page and Instagram account?')) {
      return;
    }

    try {
      await fetch('/api/meta/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team_id: teamId.toString() }),
      });
      setAccount({ connected: false });
    } catch (err) {
      console.error('Failed to disconnect:', err);
    }
  };

  if (loading) {
    return (
      <div className="p-4 border rounded-lg bg-gray-50">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (!account?.connected) {
    return (
      <div className="p-4 border rounded-lg bg-gray-50">
        <h3 className="text-lg font-semibold mb-3">Connect Social Accounts</h3>
        <p className="text-gray-600 mb-4">
          Connect your Facebook Page and Instagram Business account to post updates directly from the team.
        </p>
        <button
          onClick={connectMeta}
          disabled={connecting}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {connecting ? 'Connecting...' : 'Connect Meta Account'}
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 border rounded-lg bg-gray-50">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold">Connected Accounts</h3>
        {account.tokenExpired && (
          <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded">
            Token Expired
          </span>
        )}
      </div>

      <div className="space-y-3">
        {account.page && (
          <div className="flex items-center gap-2">
            <span className="text-2xl">📘</span>
            <div>
              <p className="font-medium">Facebook Page</p>
              <p className="text-sm text-gray-600">{account.page.name}</p>
            </div>
          </div>
        )}

        {account.instagram && (
          <div className="flex items-center gap-2">
            <span className="text-2xl">📸</span>
            <div>
              <p className="font-medium">Instagram</p>
              <p className="text-sm text-gray-600">@{account.instagram.username}</p>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 flex gap-2">
        <button
          onClick={connectMeta}
          className="px-3 py-1 text-sm border rounded hover:bg-gray-100"
        >
          Reconnect
        </button>
        <button
          onClick={disconnectMeta}
          className="px-3 py-1 text-sm text-red-600 border border-red-300 rounded hover:bg-red-50"
        >
          Disconnect
        </button>
      </div>
    </div>
  );
}