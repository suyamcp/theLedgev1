import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Cookie, X } from 'lucide-react';

type Consent = 'accepted' | 'declined';

const CONSENT_KEY = 'tl_cookie_consent';
const VISITOR_COOKIE = 'tl_visitor_id';
const ID_RE = /^[A-Za-z0-9_-]{8,64}$/;

const readCookie = (name: string): string | null => {
  try {
    const hit = document.cookie.split('; ').find(r => r.startsWith(name + '='));
    return hit ? decodeURIComponent(hit.split('=').slice(1).join('=')) : null;
  } catch {
    return null;
  }
};

const writeCookie = (name: string, value: string) => {
  const secure = typeof location !== 'undefined' && location.protocol === 'https:' ? '; Secure' : '';
  // ~2 years
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${60 * 60 * 24 * 730}; Path=/; SameSite=Lax${secure}`;
};

const deleteCookie = (name: string) => {
  document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
};

const genId = (): string => {
  try {
    if (typeof crypto !== 'undefined' && (crypto as any).randomUUID) {
      return (crypto as any).randomUUID().replace(/-/g, '');
    }
  } catch { /* noop */ }
  return `id_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
};

const getConsent = (): Consent | null => {
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    return v === 'accepted' || v === 'declined' ? v : null;
  } catch {
    return null;
  }
};

const setConsent = (c: Consent) => {
  try { localStorage.setItem(CONSENT_KEY, c); } catch { /* noop */ }
};

// Fire one tracking hit. Safe to call repeatedly; the server counts a new unique
// visitor only the first time it sees a given id.
const trackVisit = () => {
  let id = readCookie(VISITOR_COOKIE);
  if (!id || !ID_RE.test(id)) {
    id = genId();
    writeCookie(VISITOR_COOKIE, id);
  }
  fetch('/api/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ visitorId: id, path: location.pathname }),
  })
    .then(r => r.json())
    .then(d => {
      if (d && typeof d.visitorId === 'string' && d.visitorId !== id) {
        writeCookie(VISITOR_COOKIE, d.visitorId);
      }
    })
    .catch(() => { /* analytics must never disrupt the page */ });
};

export default function CookieConsent() {
  const [consent, setConsentState] = useState<Consent | null>(() => getConsent());
  const [showBanner, setShowBanner] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsAnalytics, setSettingsAnalytics] = useState(true);

  // Decide whether to show the first-visit banner, and track if already accepted.
  useEffect(() => {
    const c = getConsent();
    if (!c) {
      setShowBanner(true);
    } else if (c === 'accepted') {
      trackVisit();
    }
  }, []);

  // Footer "Cookie Settings" link opens the modal.
  useEffect(() => {
    const open = () => {
      setSettingsAnalytics(getConsent() === 'accepted');
      setShowSettings(true);
    };
    window.addEventListener('open-cookie-settings', open);
    return () => window.removeEventListener('open-cookie-settings', open);
  }, []);

  const acceptAll = useCallback(() => {
    setConsent('accepted');
    setConsentState('accepted');
    setShowBanner(false);
    setShowSettings(false);
    trackVisit();
  }, []);

  const declineAll = useCallback(() => {
    setConsent('declined');
    setConsentState('declined');
    setShowBanner(false);
    setShowSettings(false);
    deleteCookie(VISITOR_COOKIE);
  }, []);

  const saveSettings = useCallback(() => {
    if (settingsAnalytics) acceptAll();
    else declineAll();
  }, [settingsAnalytics, acceptAll, declineAll]);

  const description = (
    <>
      By clicking <span className="font-semibold text-cream-100">"Accept all cookies"</span>, you agree to let
      The Ledge store cookies on your device. We use a single anonymous cookie that holds a random ID
      (for example, <span className="font-mono text-gold-300">id_847294</span>) so we can count how many different
      people visit our website. It contains <span className="font-semibold">no personal information</span> — not your
      name, email, or location — it is never shared, and it is not used for advertising. You can decline, or change
      this later from <span className="font-semibold">"Cookie Settings"</span> in the footer.
    </>
  );

  return (
    <>
      {/* First-visit banner */}
      <AnimatePresence>
        {showBanner && !showSettings && (
          <motion.div
            initial={{ y: 120, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 120, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 28 }}
            className="fixed bottom-0 inset-x-0 z-[100] p-3 sm:p-5"
            role="dialog"
            aria-label="Cookie consent"
          >
            <div className="max-w-4xl mx-auto bg-pine-900 border border-pine-700 rounded-2xl shadow-2xl p-5 sm:p-6">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-gold-500/15 border border-gold-500/30 flex items-center justify-center text-gold-400 shrink-0">
                  <Cookie className="w-4.5 h-4.5" />
                </div>
                <div className="space-y-3 min-w-0">
                  <h3 className="font-display font-bold text-sm text-cream-100">We use one small cookie to count visitors</h3>
                  <p className="text-[11px] sm:text-xs text-neutral-400 leading-relaxed">{description}</p>
                  <div className="flex flex-wrap gap-2.5 pt-1">
                    <button
                      onClick={acceptAll}
                      className="py-2.5 px-5 rounded-xl bg-gold-500 hover:bg-gold-400 text-ink font-display font-bold text-xs transition-colors cursor-pointer"
                    >
                      Accept all cookies
                    </button>
                    <button
                      onClick={declineAll}
                      className="py-2.5 px-5 rounded-xl bg-pine-800 hover:bg-pine-700 border border-pine-700 text-neutral-200 font-display font-bold text-xs transition-colors cursor-pointer"
                    >
                      Decline
                    </button>
                    <button
                      onClick={() => { setSettingsAnalytics(true); setShowSettings(true); }}
                      className="py-2.5 px-4 rounded-xl text-neutral-400 hover:text-neutral-200 font-display font-semibold text-xs transition-colors cursor-pointer"
                    >
                      Cookie settings
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings modal */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowSettings(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-lg bg-pine-900 border border-pine-700 rounded-2xl shadow-2xl overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-5 border-b border-pine-800">
                <h3 className="font-display font-bold text-sm text-cream-100 flex items-center gap-2">
                  <Cookie className="w-4 h-4 text-gold-400" /> Cookie Settings
                </h3>
                <button onClick={() => setShowSettings(false)} className="text-neutral-500 hover:text-neutral-200">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-5">
                <p className="text-xs text-neutral-400 leading-relaxed">{description}</p>

                <div className="rounded-xl border border-pine-800 bg-pine-950/50 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <span className="font-display font-bold text-xs text-cream-100 block">Essential cookies</span>
                      <span className="text-[11px] text-neutral-500">Needed for the site to work. Always on.</span>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 py-1 px-2 rounded-full border border-pine-700">Always on</span>
                  </div>
                  <div className="flex items-center justify-between gap-4 pt-3 border-t border-pine-800">
                    <div>
                      <span className="font-display font-bold text-xs text-cream-100 block">Analytics cookie (visitor counter)</span>
                      <span className="text-[11px] text-neutral-500">One anonymous ID so we can count unique visitors.</span>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={settingsAnalytics}
                      onClick={() => setSettingsAnalytics(v => !v)}
                      className={`w-11 h-6 rounded-full transition-colors shrink-0 relative ${settingsAnalytics ? 'bg-gold-500' : 'bg-pine-700'}`}
                    >
                      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${settingsAnalytics ? 'left-[22px]' : 'left-0.5'}`} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2.5 p-5 border-t border-pine-800">
                <button
                  onClick={() => setShowSettings(false)}
                  className="py-2.5 px-4 rounded-xl bg-pine-800 hover:bg-pine-700 border border-pine-700 text-neutral-200 font-display font-bold text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={saveSettings}
                  className="py-2.5 px-5 rounded-xl bg-gold-500 hover:bg-gold-400 text-ink font-display font-bold text-xs transition-colors"
                >
                  Save choices
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
