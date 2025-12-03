import React, { useState } from 'react';
import { LayoutTemplate, Loader2, Mail, LogIn } from 'lucide-react';
import { supabase } from './lib/supabase';
export const Auth = () => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Send a "Magic Link" to email (No passwords needed!)
    const { error } = await supabase.auth.signInWithOtp({ email });
    
    if (error) {
      alert(error.message);
    } else {
      setSent(true);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white w-full max-w-md p-8 rounded-2xl shadow-xl border border-gray-100 text-center">
        
        {/* Logo */}
        <div className="flex justify-center mb-6">
            <div className="bg-indigo-600 p-3 rounded-xl shadow-lg shadow-indigo-200">
                <LayoutTemplate className="w-8 h-8 text-white" />
            </div>
        </div>
        
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome Back</h1>
        <p className="text-gray-500 mb-8">Sign in to ExamGen AI</p>

        {sent ? (
            <div className="bg-green-50 text-green-800 p-6 rounded-xl border border-green-100">
                <div className="flex justify-center mb-2">
                    <Mail className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="font-bold mb-1">Check your email!</h3>
                <p className="text-sm">We sent a magic link to <strong>{email}</strong>.</p>
                <button onClick={() => setSent(false)} className="mt-4 text-sm text-green-700 underline hover:text-green-800">Try different email</button>
            </div>
        ) : (
            <form onSubmit={handleLogin} className="space-y-4 text-left">
                <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1 ml-1">Email Address</label>
                    <input
                        type="email"
                        placeholder="principal@school.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                        required
                    />
                </div>
                <button
                    disabled={loading}
                    className="w-full bg-indigo-600 text-white py-3.5 rounded-xl font-semibold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 active:scale-[0.98]"
                >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogIn className="w-5 h-5" />}
                    Sign In with Email
                </button>
            </form>
        )}
      </div>
    </div>
  );
};