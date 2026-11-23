import React, { useEffect, useState, useRef } from 'react';

/**
 * IntroSplash:
 * Cinematic Cyber-Escrow Splash Intro that morphs smoothly into the top-left Navbar logo.
 * Triggers on fresh session or when ?intro=1 query param is set.
 */
export const IntroSplash: React.FC = () => {
  const [phase, setPhase] = useState<'init' | 'center' | 'morph' | 'done'>('init');
  const [morphTransform, setMorphTransform] = useState<string>('translate3d(0, 0, 0) scale(1)');
  const [morphOpacity, setMorphOpacity] = useState<number>(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Check if animation should run
    const searchParams = new URLSearchParams(window.location.search);
    const forceIntro = searchParams.get('intro') === '1';
    const seen = sessionStorage.getItem('rentshield_intro_seen');
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!forceIntro && (seen || prefersReducedMotion)) {
      setPhase('done');
      return;
    }

    // Start Phase 1: Center stage
    setPhase('center');

    // Timer for Phase 2: Morph to Navbar at 1.3s
    const morphTimer = setTimeout(() => {
      if (!contentRef.current) return;

      const targetEl = document.getElementById('navbar-brand-logo');
      const targetRect = targetEl?.getBoundingClientRect() || {
        left: 24,
        top: 16,
        width: 150,
        height: 40,
      };

      const windowW = window.innerWidth;
      const windowH = window.innerHeight;
      const centerX = windowW / 2;
      const centerY = windowH / 2;
      const targetCenterX = targetRect.left + (targetRect.width / 2);
      const targetCenterY = targetRect.top + (targetRect.height / 2);

      const dx = targetCenterX - centerX;
      const dy = targetCenterY - centerY;
      const scale = Math.min(0.42, Math.max(0.28, targetRect.height / 115));

      setPhase('morph');
      setMorphTransform(`translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0) scale(${scale.toFixed(3)})`);
      setMorphOpacity(0.15); // Fade smoothly as it lands over real navbar brand
    }, 1300);

    // Timer for Phase 3: Unmount and persist session at 2.1s
    const unmountTimer = setTimeout(() => {
      sessionStorage.setItem('rentshield_intro_seen', 'true');
      setPhase('done');
    }, 2150);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        sessionStorage.setItem('rentshield_intro_seen', 'true');
        setPhase('done');
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(morphTimer);
      clearTimeout(unmountTimer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleSkip = () => {
    sessionStorage.setItem('rentshield_intro_seen', 'true');
    setPhase('done');
  };

  if (phase === 'done' || phase === 'init') {
    return null;
  }

  const isMorphing = phase === 'morph';

  return (
    <div
      ref={containerRef}
      onClick={handleSkip}
      className={`fixed inset-0 z-[9999] flex items-center justify-center transition-all duration-700 ease-out select-none ${
        isMorphing ? 'bg-transparent pointer-events-none' : 'bg-[#050912] cursor-pointer'
      }`}
      style={{
        backgroundColor: isMorphing ? 'rgba(5, 9, 18, 0)' : '#050912',
        transition: 'background-color 800ms cubic-bezier(0.22, 1, 0.36, 1)',
      }}
    >
      <style>{`
        @keyframes rsHexSpin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes rsReverseSpin {
          0% { transform: rotate(360deg); }
          100% { transform: rotate(0deg); }
        }
        @keyframes rsLaserSweep {
          0% { transform: translateY(-38px); opacity: 0; }
          25% { opacity: 0.9; }
          75% { opacity: 0.9; }
          100% { transform: translateY(38px); opacity: 0; }
        }
        @keyframes rsDrawShield {
          0% { stroke-dashoffset: 420; }
          100% { stroke-dashoffset: 0; }
        }
        @keyframes rsGlowPulse {
          0%, 100% { filter: drop-shadow(0 0 16px rgba(16, 185, 129, 0.45)); }
          50% { filter: drop-shadow(0 0 32px rgba(16, 185, 129, 0.85)); }
        }
        .rs-draw {
          stroke-dasharray: 420;
          animation: rsDrawShield 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .rs-hex-spin {
          transform-origin: center center;
          animation: rsHexSpin 12s linear infinite;
        }
        .rs-rev-spin {
          transform-origin: center center;
          animation: rsReverseSpin 18s linear infinite;
        }
        .rs-laser {
          animation: rsLaserSweep 1.1s ease-in-out infinite;
        }
        .rs-pulse-glow {
          animation: rsGlowPulse 2s ease-in-out infinite;
        }
      `}</style>

      {/* Cyber Ambient Radial Glow */}
      <div
        className={`absolute inset-0 pointer-events-none transition-opacity duration-700 ${
          isMorphing ? 'opacity-0' : 'opacity-100'
        }`}
        style={{
          background: 'radial-gradient(circle at 50% 50%, rgba(16, 185, 129, 0.16) 0%, rgba(5, 9, 18, 0.92) 75%)',
        }}
      />

      {/* Fine Background Grid Accent */}
      <div
        className={`absolute inset-0 pointer-events-none transition-opacity duration-700 ${
          isMorphing ? 'opacity-0' : 'opacity-30'
        }`}
        style={{
          backgroundImage:
            'linear-gradient(rgba(16, 185, 129, 0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(16, 185, 129, 0.08) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      {/* Center Stage & Morphing Brand Element */}
      <div
        ref={contentRef}
        style={{
          transform: morphTransform,
          opacity: morphOpacity,
          transformOrigin: 'center center',
          transition: isMorphing
            ? 'transform 820ms cubic-bezier(0.22, 1, 0.36, 1), opacity 750ms ease-out'
            : 'none',
        }}
        className="relative z-10 flex flex-col items-center justify-center"
      >
        {/* Holographic Shield Container */}
        <div className="relative w-28 h-28 flex items-center justify-center rs-pulse-glow">
          {/* Rotating Cryptographic Outer Ring */}
          <svg className="absolute inset-0 w-full h-full rs-hex-spin" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="46"
              fill="none"
              stroke="#10b981"
              strokeWidth="1.2"
              strokeDasharray="5 5"
              strokeOpacity="0.45"
            />
            {/* Cardinal Circuit Nodes */}
            <circle cx="50" cy="4" r="2" fill="#34d399" />
            <circle cx="96" cy="50" r="2" fill="#34d399" />
            <circle cx="50" cy="96" r="2" fill="#34d399" />
            <circle cx="4" cy="50" r="2" fill="#34d399" />
          </svg>

          {/* Counter-rotating Inner Hex Ring */}
          <svg className="absolute inset-0 w-full h-full rs-rev-spin" viewBox="0 0 100 100">
            <polygon
              points="50,10 85,28 85,72 50,90 15,72 15,28"
              fill="none"
              stroke="#06b6d4"
              strokeWidth="0.8"
              strokeDasharray="3 4"
              strokeOpacity="0.3"
            />
          </svg>

          {/* Primary RentShield Vector Emblem */}
          <svg
            className="w-20 h-20 relative z-10"
            viewBox="0 0 64 64"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="rsShieldGrad" x1="8" y1="4" x2="56" y2="60" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="50%" stopColor="#059669" />
                <stop offset="100%" stopColor="#064e3b" />
              </linearGradient>
              <linearGradient id="rsStrokeGrad" x1="10" y1="4" x2="54" y2="58" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#6ee7b7" />
                <stop offset="50%" stopColor="#10b981" />
                <stop offset="100%" stopColor="#047857" />
              </linearGradient>
            </defs>

            {/* Shield Outline with SVG Stroke Animation */}
            <path
              d="M32 6 L52 14 C52 34 44 48 32 58 C20 48 12 34 12 14 Z"
              fill="url(#rsShieldGrad)"
              fillOpacity="0.25"
              stroke="url(#rsStrokeGrad)"
              strokeWidth="2.5"
              strokeLinejoin="round"
              className="rs-draw"
            />

            {/* Inner Cyber-Lock Shackle */}
            <path
              d="M26 28 V22 C26 18.686 28.686 16 32 16 C35.314 16 38 18.686 38 22 V28"
              stroke="#a7f3d0"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
            {/* Lock Body */}
            <rect
              x="23"
              y="28"
              width="18"
              height="15"
              rx="3"
              fill="#064e3b"
              stroke="#34d399"
              strokeWidth="1.8"
            />
            {/* Keyhole */}
            <circle cx="32" cy="34" r="2" fill="#ecfdf5" />
            <path d="M32 35 V39" stroke="#ecfdf5" strokeWidth="1.6" strokeLinecap="round" />
          </svg>

          {/* Sweeping Laser Beam */}
          <div className="absolute w-24 h-[2px] bg-gradient-to-r from-transparent via-emerald-300 to-transparent shadow-[0_0_12px_#34d399] rs-laser pointer-events-none" />
        </div>

        {/* Wordmark & Subtitle */}
        <div className="mt-4 text-center">
          <div className="text-2xl sm:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-emerald-400 via-emerald-200 to-white bg-clip-text text-transparent">
            RentShield
          </div>
          <div className="flex items-center justify-center space-x-2 mt-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] font-mono tracking-widest text-emerald-400/90 uppercase font-semibold">
              SHA-256 ESCROW PROTOCOL
            </span>
          </div>
        </div>

        {/* Skip Tip */}
        <div
          className={`mt-4 text-[11px] font-mono text-slate-500 transition-opacity duration-300 ${
            isMorphing ? 'opacity-0' : 'opacity-70'
          }`}
        >
          Click anywhere or press Esc to skip
        </div>
      </div>
    </div>
  );
};
