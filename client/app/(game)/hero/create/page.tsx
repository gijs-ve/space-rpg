'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth';
import { useGameInventory } from '@/context/inventory';
import { apiFetch } from '@/lib/api';

export default function CreateHeroPage() {
  const { token } = useAuth();
  const { refreshHeroMeta } = useGameInventory();
  const router = useRouter();

  const [name,    setName]    = useState('');
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setError('');
    setLoading(true);
    try {
      await apiFetch('/hero/create', {
        method: 'POST',
        token:  token!,
        body:   JSON.stringify({ name: name.trim() }),
      });
      // Refresh context so the hero guard knows we now have a hero
      await refreshHeroMeta();
      router.replace('/map');
    } catch (err: any) {
      setError(err.message ?? 'Failed to create hero');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-center h-full">
      <div className="w-full max-w-sm">
        <form
          onSubmit={handleSubmit}
          className="bg-gray-900 rounded-xl p-8 space-y-6 shadow-xl border border-gray-800"
        >
          <div className="text-center space-y-1">
            <div className="text-5xl mb-3">🧙</div>
            <h2 className="text-xl font-semibold text-amber-300">Name Your Hero</h2>
            <p className="text-xs text-gray-500">
              This name will follow you throughout Iron Realm.
            </p>
          </div>

          {error && (
            <p className="text-red-400 text-sm bg-red-950 rounded px-3 py-2">{error}</p>
          )}

          <div>
            <label className="block text-sm text-gray-400 mb-1">Hero name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={1}
              maxLength={32}
              placeholder="Enter a name…"
              autoFocus
              className="w-full bg-gray-800 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 text-amber-100 placeholder-gray-600"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-gray-950 font-semibold rounded-lg py-2.5 transition"
          >
            {loading ? 'Creating hero…' : 'Begin your journey ⚔'}
          </button>
        </form>
      </div>
    </div>
  );
}
