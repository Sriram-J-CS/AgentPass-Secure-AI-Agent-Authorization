"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Shield,
  Lock,
  Eye,
  EyeOff,
  CheckCircle,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";

export const LoginPage: React.FC = () => {
  const router = useRouter();
  const [email, setEmail] = useState("sriram@company.com");
  const [password, setPassword] = useState("••••••••••••");
  const [showPassword, setShowPassword] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      router.push("/");
    }, 400);
  };

  return (
    <div className="min-h-screen bg-[#080C14] text-slate-100 flex flex-col justify-between p-6">
      {/* Top Header */}
      <div className="flex items-center gap-3">
        <Link href="/landing" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 text-black">
            <Shield className="w-4 h-4 text-slate-950 fill-current" />
          </div>
          <span className="text-base font-black tracking-tight text-white">
            AgentPass
          </span>
        </Link>
      </div>

      {/* Main Login Card (Matching Image 2) */}
      <div className="flex-1 flex items-center justify-center py-10">
        <div className="w-full max-w-md p-8 glass-card rounded-3xl border-slate-800 shadow-2xl glow-cyan space-y-6">
          {/* Padlock Icon & Title */}
          <div className="text-center space-y-2">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-lg glow-cyan-sm">
              <Lock className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight">
              Welcome back
            </h2>
            <p className="text-xs text-slate-400">
              Sign in to your secure workspace
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSignIn} className="space-y-4 text-xs">
            <div className="space-y-1.5">
              <label className="text-slate-300 font-semibold block">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-2.5 bg-slate-900/80 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/40 transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-300 font-semibold block">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 bg-slate-900/80 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/40 transition-all pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none text-slate-400">
                <input
                  type="checkbox"
                  checked={keepSignedIn}
                  onChange={(e) => setKeepSignedIn(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-0 cursor-pointer"
                />
                <span>Keep me signed in</span>
              </label>

              <a href="#" className="text-cyan-400 hover:underline">
                Forgot password?
              </a>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-bold text-xs uppercase tracking-wider shadow-lg shadow-cyan-500/20 transition-all cursor-pointer disabled:opacity-50 mt-2"
            >
              {loading ? "Authenticating..." : "Sign in"}
            </button>
          </form>

          {/* Divider */}
          <div className="relative flex items-center justify-center">
            <div className="border-t border-slate-800 w-full" />
            <span className="bg-[#0D1526] px-3 text-[11px] text-slate-500 uppercase font-mono absolute">
              or
            </span>
          </div>

          {/* Create New Workspace */}
          <Link
            href="/"
            className="w-full py-2.5 rounded-xl border border-slate-700 hover:border-slate-600 bg-slate-900/60 text-slate-300 hover:text-white font-semibold text-xs text-center block transition-colors"
          >
            Create a new workspace
          </Link>
        </div>
      </div>

      {/* Footer Security Badges (Matching Image 2) */}
      <div className="flex flex-wrap items-center justify-center gap-6 text-[11px] text-slate-500">
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
          Protected workspace
        </span>
        <span className="flex items-center gap-1.5">
          <Lock className="w-3.5 h-3.5 text-emerald-400" />
          Your data stays secure
        </span>
        <span className="flex items-center gap-1.5">
          <CheckCircle className="w-3.5 h-3.5 text-blue-400" />
          Enterprise-grade security
        </span>
      </div>
    </div>
  );
};
