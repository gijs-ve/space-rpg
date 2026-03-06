'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/auth';

export default function LoginPage() {
  const { login } = useAuth();
  const router    = useRouter();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      router.replace('/hero');
    } catch (err: any) {
      setError(err.message ?? 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm">
      <h1 className="text-3xl font-bold text-center mb-8 text-amber-400">Iron Realm</h1>
      <form onSubmit={handleSubmit} className="bg-gray-900 rounded-xl p-8 space-y-5 shadow-xl">
        <h2 className="text-xl font-semibold text-center">Sign In</h2>

        {error && (
          <p className="text-red-400 text-sm bg-red-950 rounded px-3 py-2">{error}</p>
        )}

        <div>
          <label className="block text-sm text-gray-400 mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full bg-gray-800 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full bg-gray-800 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-gray-950 font-semibold rounded-lg py-2 transition"
        >
          {loading ? 'Signing in…' : 'Sign In'}
        </button>

        <p className="text-center text-sm text-gray-500">
          No account?{' '}
          <Link href="/register" className="text-amber-400 hover:underline">
            Register
          </Link>
        </p>
      </form>
    </div>
  );
}
