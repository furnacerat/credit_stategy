import Link from "next/link";
import Image from "next/image";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 font-sans dark:bg-[#09090b] text-zinc-900 dark:text-zinc-50">
      {/* Navigation */}
      <nav className="flex items-center justify-between px-6 py-4 md:px-12">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center">
            <span className="text-white font-bold text-xl">C</span>
          </div>
          <span className="text-xl font-bold tracking-tight">Credit Strategy AI</span>
        </div>
        <div className="hidden md:flex items-center gap-8 text-sm font-medium">
          <Link href="#features" className="hover:text-indigo-600 transition-colors">Features</Link>
          <Link href="#how-it-works" className="hover:text-indigo-600 transition-colors">How it Works</Link>
          <Link href="/dashboard" className="rounded-full bg-zinc-900 px-5 py-2 text-zinc-50 hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors shadow-sm">
            Launch App
          </Link>
        </div>
      </nav>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative flex flex-col items-center justify-center px-6 py-24 text-center md:px-12 md:py-32 lg:py-48">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(45%_45%_at_50%_50%,rgba(79,70,229,0.1),transparent)]" />

          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50/50 px-3 py-1 text-xs font-semibold text-indigo-700 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-400 mb-8 animate-fade-in">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
            </span>
            Now Powered by GPT-4o
          </div>

          <h1 className="max-w-4xl text-5xl font-extrabold tracking-tight sm:text-7xl mb-8 bg-clip-text text-transparent bg-gradient-to-b from-zinc-900 to-zinc-600 dark:from-zinc-50 dark:to-zinc-400">
            Master Your Credit with <span className="text-indigo-600 dark:text-indigo-400">AI Intelligence</span>
          </h1>

          <p className="max-w-2xl text-lg text-zinc-600 dark:text-zinc-400 mb-12 leading-relaxed">
            Upload your credit report and let our advanced AI analyze every detail. Get a personalized strategic brief and professional dispute letters in seconds.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto">
            <Link
              href="/dashboard"
              className="flex h-14 w-full sm:w-64 items-center justify-center rounded-2xl bg-indigo-600 text-white text-lg font-semibold hover:bg-indigo-700 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-indigo-200 dark:shadow-none"
            >
              Analyze My Report
            </Link>
            <Link
              href="#features"
              className="flex h-14 w-full sm:w-48 items-center justify-center rounded-2xl border border-zinc-200 bg-white dark:bg-zinc-900/50 dark:border-zinc-800 text-lg font-semibold hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all"
            >
              Learn More
            </Link>
          </div>
        </section>

        {/* Features Preview */}
        <section id="features" className="px-6 py-24 md:px-12 bg-white dark:bg-zinc-900/50">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
              <div className="space-y-4 p-8 rounded-3xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-700/50">
                <div className="h-12 w-12 rounded-2xl bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-6">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20" /><path d="m4.93 4.93 14.14 14.14" /><path d="M2 12h20" /><path d="m4.93 19.07 14.14-14.14" /></svg>
                </div>
                <h3 className="text-xl font-bold">Smart Analysis</h3>
                <p className="text-zinc-600 dark:text-zinc-400">Our AI identifies negative items, utilization issues, and score improvement opportunities instantly.</p>
              </div>

              <div className="space-y-4 p-8 rounded-3xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-700/50">
                <div className="h-12 w-12 rounded-2xl bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-6">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /></svg>
                </div>
                <h3 className="text-xl font-bold">Letter Generation</h3>
                <p className="text-zinc-600 dark:text-zinc-400">Generate legally-backed dispute letters tailored to your specific credit report errors.</p>
              </div>

              <div className="space-y-4 p-8 rounded-3xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-700/50">
                <div className="h-12 w-12 rounded-2xl bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-6">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                </div>
                <h3 className="text-xl font-bold">Secure & Private</h3>
                <p className="text-zinc-600 dark:text-zinc-400">Your data is encrypted and processed securely. We prioritize your financial privacy.</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-200 dark:border-zinc-800 px-6 py-12 md:px-12">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded bg-indigo-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">C</span>
            </div>
            <span className="font-bold">Credit Strategy AI</span>
          </div>
          <p className="text-zinc-500 text-sm">© 2026 Credit Strategy AI. Built for financial freedom.</p>
        </div>
      </footer>
    </div>
  );
}
