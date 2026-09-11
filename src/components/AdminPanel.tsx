import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Edit, 
  Save, 
  RotateCcw, 
  Eye, 
  Plus, 
  Trash2, 
  Image as ImageIcon, 
  Tag, 
  DollarSign, 
  CheckCircle, 
  XCircle, 
  Compass, 
  HelpCircle, 
  RefreshCw, 
  Sliders, 
  Calendar, 
  List, 
  Sparkles, 
  Check, 
  Briefcase, 
  Users, 
  TrendingUp, 
  FileText,
  Search,
  Clock
} from 'lucide-react';
import { CMSData, saveCMSData, resetToBlankSlate, seedDefaultData, HIGH_QUALITY_PRESET_IMAGES } from '../lib/cmsState';
import { Booking, Accommodation, Service, FAQ } from '../types';
import ThemeToggle from './ThemeToggle';

interface AdminPanelProps {
  currentData: CMSData;
  onDataChange: (newData: CMSData) => void;
  onClose: () => void;
  bookings: Booking[];
  onBookingsChange: (newBookings: Booking[]) => void;
  onRefreshBookings: () => void;
}

type AdminTab = 'dashboard' | 'hero' | 'accommodations' | 'backstory' | 'services' | 'bookings' | 'analytics' | 'settings';

export default function AdminPanel({
  currentData,
  onDataChange,
  onClose,
  bookings,
  onBookingsChange,
  onRefreshBookings,
}: AdminPanelProps) {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    return !!sessionStorage.getItem('ledge_admin_token');
  });
  const [usernameInput, setUsernameInput] = useState<string>('');
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [loginError, setLoginError] = useState<string>('');
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);

  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [tempData, setTempData] = useState<CMSData>(currentData);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Manual-payment instructions shown on the reservation ticket + emailed to guests.
  const EMPTY_PAY_INSTR = {
    headline: 'Send your payment to confirm this reservation',
    accounts: [{ method: '', accountName: '', accountNumber: '', qrImageUrl: '' }],
    proofEmail: '',
    note: '',
  };
  const [payInstr, setPayInstr] = useState<any>(EMPTY_PAY_INSTR);
  const [savingPayInstr, setSavingPayInstr] = useState(false);

  // Manage Bookings: which sub-tab is open, plus the reference/name search box.
  const [bookingFilter, setBookingFilter] = useState<'unconfirmed' | 'confirmed' | 'archived'>('unconfirmed');
  const [bookingSearch, setBookingSearch] = useState('');
  const [holdHours, setHoldHours] = useState<number | ''>(48);
  const [savingHold, setSavingHold] = useState(false);

  // Visitor analytics
  const [analytics, setAnalytics] = useState<any>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const loadAnalytics = () => {
    const token = sessionStorage.getItem('ledge_admin_token') || '';
    setAnalyticsLoading(true);
    fetch('/api/admin/analytics', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error('failed'))))
      .then(setAnalytics)
      .catch(() => setAnalytics(null))
      .finally(() => setAnalyticsLoading(false));
  };

  useEffect(() => {
    if (activeTab === 'analytics') loadAnalytics();
    // Bookings can be created from the public site while this panel sits open,
    // so re-pull the list every time the tab is opened rather than only on login.
    if (activeTab === 'bookings' && isLoggedIn) onRefreshBookings();
  }, [activeTab]);

  useEffect(() => {
    if (!isLoggedIn) return;
    const token = sessionStorage.getItem('ledge_admin_token') || '';
    fetch('/api/admin/ops-settings', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error('failed'))))
      .then(d => setHoldHours(Number(d.pendingHoldHours) || 48))
      .catch(() => { /* keep the default */ });
  }, [isLoggedIn]);

  const saveHoldWindow = () => {
    const token = sessionStorage.getItem('ledge_admin_token') || '';
    setSavingHold(true);
    fetch('/api/admin/ops-settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ pendingHoldHours: Number(holdHours) }),
    })
      .then(r => (r.ok ? r.json() : r.json().then(e => Promise.reject(new Error(e.error)))))
      .then(d => { triggerToast(`Unpaid reservations now expire after ${d.pendingHoldHours} hours.`); onRefreshBookings(); })
      .catch(err => alert(err.message || 'Could not save the hold window.'))
      .finally(() => setSavingHold(false));
  };

  // Pull the authoritative booking list from the server whenever the admin is logged in.
  useEffect(() => {
    if (isLoggedIn) onRefreshBookings();
  }, [isLoggedIn]);

  // Holding a token string is not the same as holding a VALID one. Verify it on
  // mount, and drop straight back to the login form if the server rejects it.
  useEffect(() => {
    if (!isLoggedIn) return;
    const token = sessionStorage.getItem('ledge_admin_token') || '';
    fetch('/api/admin/ops-settings', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => {
        if (r.status === 401) {
          sessionStorage.removeItem('ledge_admin_token');
          setIsLoggedIn(false);
          setLoginError('Your session expired. Please log in again.');
        }
      })
      .catch(() => { /* offline - leave the panel alone */ });
  }, []);

  useEffect(() => {
    const expired = () => {
      setIsLoggedIn(false);
      setLoginError('Your session expired. Please log in again.');
    };
    window.addEventListener('vp-admin-session-expired', expired);
    return () => window.removeEventListener('vp-admin-session-expired', expired);
  }, []);

  useEffect(() => {
    if (!isLoggedIn) return;
    fetch('/api/content')
      .then(res => res.json())
      .then(data => {
        if (data && data.payment_instructions) {
          const p = data.payment_instructions;
          setPayInstr({
            headline: p.headline || EMPTY_PAY_INSTR.headline,
            accounts: Array.isArray(p.accounts) && p.accounts.length ? p.accounts : EMPTY_PAY_INSTR.accounts,
            proofEmail: p.proofEmail || '',
            note: p.note || '',
          });
        }
      })
      .catch(err => console.error('Failed to load payment instructions:', err));
  }, [isLoggedIn]);

  const savePaymentInstructions = () => {
    const token = sessionStorage.getItem('ledge_admin_token') || '';
    setSavingPayInstr(true);
    fetch('/api/content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ key: 'payment_instructions', value: payInstr }),
    })
      .then(res => { if (!res.ok) throw new Error('save failed'); return res.json(); })
      .then(() => triggerToast('Payment instructions published!'))
      .catch(err => { console.error(err); alert('Failed to save payment instructions.'); })
      .finally(() => setSavingPayInstr(false));
  };

  const updatePayAccount = (idx: number, field: string, value: string) => {
    setPayInstr((prev: any) => ({
      ...prev,
      accounts: prev.accounts.map((a: any, i: number) => (i === idx ? { ...a, [field]: value } : a)),
    }));
  };
  const addPayAccount = () =>
    setPayInstr((prev: any) => ({ ...prev, accounts: [...prev.accounts, { method: '', accountName: '', accountNumber: '', qrImageUrl: '' }] }));
  const removePayAccount = (idx: number) =>
    setPayInstr((prev: any) => ({ ...prev, accounts: prev.accounts.filter((_: any, i: number) => i !== idx) }));

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameInput || !passwordInput) {
      setLoginError('Both email and password are required.');
      return;
    }
    setLoginError('');
    setIsLoggingIn(true);
    fetch('/api/admin/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username: usernameInput, password: passwordInput }),
    })
    .then(res => {
      if (!res.ok) {
        return res.json().then(err => {
          throw new Error(err.error || 'Invalid username or password.');
        });
      }
      return res.json();
    })
    .then(data => {
      if (data.token) {
        sessionStorage.setItem('ledge_admin_token', data.token);
        setIsLoggedIn(true);
      } else {
        setLoginError('Invalid login response from server.');
      }
      setIsLoggingIn(false);
    })
    .catch(err => {
      setLoginError(err.message || 'Verification failed. Please check your network.');
      setIsLoggingIn(false);
    });
  };

  // Sync temp data when currentData changes externally
  useEffect(() => {
    setTempData(currentData);
  }, [currentData]);

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg(null);
    }, 3000);
  };

  const [customImages, setCustomImages] = useState<{ url: string; name: string }[]>([]);
  const [isUploading, setIsUploading] = useState<boolean>(false);

  const fetchCustomImages = () => {
    const token = sessionStorage.getItem('ledge_admin_token') || '';
    fetch('/api/uploaded-images', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setCustomImages(data);
        }
      })
      .catch(err => console.error('Error fetching custom gallery images:', err));
  };

  useEffect(() => {
    if (isLoggedIn) {
      fetchCustomImages();
    }
  }, [isLoggedIn]);

  const handleImageUpload = (file: File, callback: (url: string) => void) => {
    if (!file) return;
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64Data = reader.result as string;
      setIsUploading(true);
      const token = sessionStorage.getItem('ledge_admin_token') || '';
      fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: file.name,
          mimeType: file.type,
          base64: base64Data
        })
      })
      .then(res => {
        if (!res.ok) throw new Error('Upload failed.');
        return res.json();
      })
      .then(data => {
        if (data.success && data.url) {
          triggerToast('Image uploaded to cloud successfully!');
          callback(data.url);
          fetchCustomImages(); // Refresh custom list
        } else {
          alert('Upload failed: ' + (data.error || 'Unknown error'));
        }
      })
      .catch(err => {
        console.error(err);
        alert('Image upload failed: ' + err.message);
      })
      .finally(() => {
        setIsUploading(false);
      });
    };
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-[500px] flex items-center justify-center bg-pine-950 p-6 rounded-3xl border border-pine-800 text-left font-sans">
        <div className="w-full max-w-md bg-pine-900 border border-pine-850 p-8 rounded-2xl shadow-2xl relative space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex p-3 bg-gold-500/10 rounded-2xl border border-gold-500/20 text-gold-400 mb-2">
              <Settings className="w-6 h-6 animate-spin" style={{ animationDuration: '10s' }} />
            </div>
            <h3 className="font-serif font-black text-2xl text-cream-100">The Ledge Admin Portal</h3>
            <p className="text-xs text-neutral-400">
              Please enter your credentials to open administrative workspace panels.
            </p>
          </div>

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs uppercase font-bold tracking-widest text-neutral-400 font-display block">Username (Email)</label>
              <input
                type="email"
                required
                value={usernameInput}
                onChange={e => setUsernameInput(e.target.value)}
                placeholder="Enter admin email"
                autoComplete="off"
                className="w-full bg-pine-950 border border-pine-850 rounded-xl py-2.5 px-4 text-sm text-cream-100 focus:outline-none focus:border-gold-500 transition-all font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs uppercase font-bold tracking-widest text-neutral-400 font-display block">Password</label>
              <input
                type="password"
                required
                value={passwordInput}
                onChange={e => setPasswordInput(e.target.value)}
                placeholder="Enter password"
                autoComplete="off"
                className="w-full bg-pine-950 border border-pine-850 rounded-xl py-2.5 px-4 text-sm text-cream-100 focus:outline-none focus:border-gold-500 transition-all font-mono"
              />
            </div>

            {loginError && (
              <div className="p-3.5 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl flex items-center gap-2">
                <span>⚠️ {loginError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-3 rounded-xl bg-gold-500 text-ink font-display font-black text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 hover:bg-gold-400 active:scale-[0.99] disabled:opacity-50 font-bold"
            >
              <span>{isLoggingIn ? 'Verifying Workspace Access...' : 'Open Workspace Control'}</span>
            </button>
          </form>
          
          <div className="text-center">
            <button
              onClick={onClose}
              className="text-[11px] font-bold text-neutral-500 hover:text-neutral-400 uppercase tracking-wider transition-all"
            >
              Cancel and Return to Customer UI
            </button>
          </div>
        </div>
      </div>
    );
  }

  const syncCMSWithServer = (data: CMSData) => {
    const token = sessionStorage.getItem('ledge_admin_token') || '';
    const keys: (keyof CMSData)[] = ['hero', 'about', 'accommodations', 'services', 'faqs'];
    
    Promise.all(
      keys.map(key => 
        fetch('/api/content', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ key, value: data[key] })
        }).then(res => {
          if (!res.ok) {
            console.error(`Failed to sync CMS key: ${key}`);
          }
        })
      )
    ).catch(err => {
      console.error('Failed to sync CMS with server:', err);
    });
  };

  const handleSave = (updatedData: CMSData) => {
    saveCMSData(updatedData);
    onDataChange(updatedData);
    syncCMSWithServer(updatedData);
    triggerToast('All website contents updated and published successfully!');
  };

  const handleResetToBlank = () => {
    if (confirm('Are you sure you want to reset all content to blank placeholders? This will clear the customer UI of all details but preserve layout frames.')) {
      const blank = resetToBlankSlate();
      setTempData(blank);
      onDataChange(blank);
      syncCMSWithServer(blank);
      triggerToast('Reset to Blank Slate! Explore the empty Customer UI placeholders.');
    }
  };

  const handleSeedDefaults = () => {
    if (confirm('Load pre-configured The Ledge default images, pricing, and mountain stories?')) {
      const seeded = seedDefaultData();
      setTempData(seeded);
      onDataChange(seeded);
      syncCMSWithServer(seeded);
      triggerToast('Seeded standard website demo content successfully!');
    }
  };

  // Helper to calculate statistics
  const totalSales = bookings
    .filter(b => b.status === 'confirmed')
    .reduce((sum, b) => sum + b.totalAmount, 0);

  const activeBookingsCount = bookings.filter(b => b.status === 'confirmed').length;
  const pendingBookingsCount = bookings.filter(b => b.status === 'pending').length;

  // Booking actions
  const handleUpdateBookingStatus = (bookingId: string, status: 'confirmed' | 'cancelled' | 'pending' | 'paid_pending_review') => {
    const token = sessionStorage.getItem('ledge_admin_token') || '';
    
    fetch(`/api/bookings/${bookingId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ status })
    })
    .then(res => {
      if (!res.ok) throw new Error('Failed to update status on server');
      return res.json();
    })
    .then(() => {
      triggerToast(`Booking ${bookingId} updated to ${status}.`);
      onRefreshBookings();
    })
    .catch(err => {
      console.error('Error updating booking status:', err);
      triggerToast('Error: Failed to sync status with server.');
    });
  };

  // Verify the guest's payment: confirm the booking AND mark the payment record received.
  const handleMarkPaid = (bookingId: string) => {
    if (!confirm(`Confirm that payment for reservation ${bookingId} has been received and verified?`)) return;
    const token = sessionStorage.getItem('ledge_admin_token') || '';
    fetch(`/api/bookings/${bookingId}/mark-paid`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
    })
      .then(res => { if (!res.ok) throw new Error('mark-paid failed'); return res.json(); })
      .then(() => {
        triggerToast(`Reservation ${bookingId} confirmed — payment verified.`);
        onRefreshBookings();
      })
      .catch(err => {
        console.error('Error marking booking paid:', err);
        triggerToast('Error: could not update payment status.');
      });
  };

  // Permanently purges an already-cancelled booking from the database. Not reversible.
  const handleDeleteBooking = (bookingId: string, reference?: string) => {
    const label = reference || `#${bookingId}`;
    if (!confirm(`Permanently DELETE reservation ${label}?

This erases the booking, its payment record and its room hold from the database. It cannot be undone — use Cancel instead if you only want to free up the dates.`)) return;
    const token = sessionStorage.getItem('ledge_admin_token') || '';

    fetch(`/api/bookings/${bookingId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    })
    .then(res => {
      if (!res.ok) throw new Error('Failed to delete/reject on server');
      return res.json();
    })
    .then(() => {
      triggerToast(`Reservation ${label} permanently deleted.`);
      onRefreshBookings();
    })
    .catch(err => {
      console.error('Error rejecting booking:', err);
      triggerToast('Error: Failed to delete/reject booking on server.');
    });
  };

  return (
    <div className="bg-pine-950 border border-pine-800 rounded-3xl overflow-hidden shadow-2xl text-left font-sans">
      
      {/* Toast Notification HUD */}
      {toastMsg && (
        <div className="fixed top-28 right-8 z-[120] bg-gold-500 text-ink px-5 py-3 rounded-xl font-display font-bold text-xs uppercase tracking-wider shadow-2xl flex items-center gap-2 animate-bounce border border-gold-300">
          <Sparkles className="w-4 h-4 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Main Admin Header */}
      <div className="bg-pine-900 border-b border-pine-850 p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gold-500 rounded-2xl text-ink shadow-lg shadow-gold-500/15">
            <Settings className="w-6 h-6 animate-spin" style={{ animationDuration: '8s' }} />
          </div>
          <div>
            <h2 className="font-serif font-black text-xl text-cream-100 flex items-center gap-2">
              The Ledge Admin Control Panel
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest bg-gold-500/10 text-gold-400 py-0.5 px-2.5 rounded-full border border-gold-500/20">
                Live CMS v1.1
              </span>
            </h2>
            <p className="text-xs text-neutral-400 mt-0.5">
              Modify rates, update imagery placeholders, configure services, and review live reservation records.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <ThemeToggle />
          <button 
            onClick={onClose}
            className="flex-1 sm:flex-none py-2.5 px-5 rounded-xl bg-pine-950 border border-pine-800 text-neutral-300 hover:text-cream-50 font-display font-bold text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <Eye className="w-4 h-4 text-emerald-500" />
            <span>Customer View</span>
          </button>
        </div>
      </div>

      {/* Admin Panel Body Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[640px]">
        
        {/* Navigation Sidebar (3 columns) */}
        <div className="lg:col-span-3 bg-pine-950 p-4 border-r border-pine-900/60 flex flex-col justify-between">
          <div className="space-y-1.5">
            <span className="text-[9px] uppercase font-bold tracking-widest text-neutral-500 font-display block pl-3.5 mb-2">
              ADMIN SERVICES
            </span>
            
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`w-full py-3 px-4 rounded-xl text-xs font-semibold flex items-center gap-3 transition-all ${
                activeTab === 'dashboard'
                  ? 'bg-gold-500 text-ink font-bold shadow-lg shadow-gold-500/10'
                  : 'text-neutral-400 hover:text-cream-100 hover:bg-pine-900/40'
              }`}
            >
              <TrendingUp className="w-4 h-4 shrink-0" />
              <span>Dashboard & Seeding</span>
            </button>

            <button
              onClick={() => setActiveTab('hero')}
              className={`w-full py-3 px-4 rounded-xl text-xs font-semibold flex items-center gap-3 transition-all ${
                activeTab === 'hero'
                  ? 'bg-gold-500 text-ink font-bold shadow-lg shadow-gold-500/10'
                  : 'text-neutral-400 hover:text-cream-100 hover:bg-pine-900/40'
              }`}
            >
              <ImageIcon className="w-4 h-4 shrink-0" />
              <span>Hero Billboard</span>
            </button>

            <button
              onClick={() => setActiveTab('accommodations')}
              className={`w-full py-3 px-4 rounded-xl text-xs font-semibold flex items-center gap-3 transition-all ${
                activeTab === 'accommodations'
                  ? 'bg-gold-500 text-ink font-bold shadow-lg shadow-gold-500/10'
                  : 'text-neutral-400 hover:text-cream-100 hover:bg-pine-900/40'
              }`}
            >
              <Sliders className="w-4 h-4 shrink-0" />
              <span>Accommodation Schemes</span>
            </button>

            <button
              onClick={() => setActiveTab('backstory')}
              className={`w-full py-3 px-4 rounded-xl text-xs font-semibold flex items-center gap-3 transition-all ${
                activeTab === 'backstory'
                  ? 'bg-gold-500 text-ink font-bold shadow-lg shadow-gold-500/10'
                  : 'text-neutral-400 hover:text-cream-100 hover:bg-pine-900/40'
              }`}
            >
              <FileText className="w-4 h-4 shrink-0" />
              <span>Mountain Story</span>
            </button>

            <button
              onClick={() => setActiveTab('services')}
              className={`w-full py-3 px-4 rounded-xl text-xs font-semibold flex items-center gap-3 transition-all ${
                activeTab === 'services'
                  ? 'bg-gold-500 text-ink font-bold shadow-lg shadow-gold-500/10'
                  : 'text-neutral-400 hover:text-cream-100 hover:bg-pine-900/40'
              }`}
            >
              <Briefcase className="w-4 h-4 shrink-0" />
              <span>Hospitality Services</span>
            </button>

            <button
              onClick={() => setActiveTab('bookings')}
              className={`w-full py-3 px-4 rounded-xl text-xs font-semibold flex items-center gap-3 transition-all relative ${
                activeTab === 'bookings'
                  ? 'bg-gold-500 text-ink font-bold shadow-lg shadow-gold-500/10'
                  : 'text-neutral-400 hover:text-cream-100 hover:bg-pine-900/40'
              }`}
            >
              <Calendar className="w-4 h-4 shrink-0" />
              <span className="flex-1 text-left">Manage Bookings</span>
              {pendingBookingsCount > 0 && (
                <span className="absolute right-3 bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded-full font-bold">
                  {pendingBookingsCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('analytics')}
              className={`w-full py-3 px-4 rounded-xl text-xs font-semibold flex items-center gap-3 transition-all ${
                activeTab === 'analytics'
                  ? 'bg-gold-500 text-ink font-bold shadow-lg shadow-gold-500/10'
                  : 'text-neutral-400 hover:text-cream-100 hover:bg-pine-900/40'
              }`}
            >
              <Users className="w-4 h-4 shrink-0" />
              <span>Visitor Analytics</span>
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`w-full py-3 px-4 rounded-xl text-xs font-semibold flex items-center gap-3 transition-all ${
                activeTab === 'settings'
                  ? 'bg-gold-500 text-ink font-bold shadow-lg shadow-gold-500/10'
                  : 'text-neutral-400 hover:text-cream-100 hover:bg-pine-900/40'
              }`}
            >
              <Settings className="w-4 h-4 shrink-0" />
              <span>Admin Settings</span>
            </button>
          </div>

          <div className="border-t border-pine-900/60 pt-4 space-y-2 mt-8">
            <span className="text-[9px] uppercase font-bold tracking-widest text-neutral-500 font-display block pl-3.5 mb-2">
              SLATE DEPLOYS
            </span>
            <button
              onClick={handleResetToBlank}
              className="w-full py-2 px-3.5 rounded-xl border border-dashed border-red-500/30 hover:border-red-500/60 bg-red-500/5 text-red-400 hover:text-red-300 font-display font-bold text-[10px] uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset to Blank Slate</span>
            </button>
            <button
              onClick={handleSeedDefaults}
              className="w-full py-2 px-3.5 rounded-xl border border-dashed border-gold-500/30 hover:border-gold-500/60 bg-gold-500/5 text-gold-400 hover:text-gold-300 font-display font-bold text-[10px] uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Seed Demo Content</span>
            </button>
          </div>
        </div>

        {/* CMS Configuration Pane (9 columns) */}
        <div className="lg:col-span-9 bg-pine-900/40 p-6 sm:p-8 overflow-y-auto max-h-[700px] border-b lg:border-b-0 border-pine-900">
          
          {/* TAB 1: DASHBOARD STATS & SEEDING */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6 animate-fadeIn" id="admin_tab_dashboard">
              <div>
                <h3 className="font-serif font-black text-xl text-cream-100">Campsite Overview & Deployment</h3>
                <p className="text-xs text-neutral-400 mt-1">
                  Assess how your The Ledge web integration is currently behaving, seed rich data, and view real-time reservation indices.
                </p>
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="bg-pine-950 p-5 rounded-2xl border border-pine-850">
                  <span className="text-[9px] font-mono font-bold text-neutral-500 uppercase tracking-widest block">Total Sales Revenue</span>
                  <span className="font-display font-black text-2xl text-gold-400 block mt-1">
                    ₱{totalSales.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-neutral-400 block mt-1">From confirmed bookings</span>
                </div>
                <div className="bg-pine-950 p-5 rounded-2xl border border-pine-850">
                  <span className="text-[9px] font-mono font-bold text-neutral-500 uppercase tracking-widest block">Confirmed Stays</span>
                  <span className="font-display font-black text-2xl text-emerald-400 block mt-1">
                    {activeBookingsCount}
                  </span>
                  <span className="text-[10px] text-neutral-400 block mt-1">Active reservations</span>
                </div>
                <div className="bg-pine-950 p-5 rounded-2xl border border-pine-850">
                  <span className="text-[9px] font-mono font-bold text-neutral-500 uppercase tracking-widest block">Pending Reviews</span>
                  <span className="font-display font-black text-2xl text-amber-500 block mt-1">
                    {pendingBookingsCount}
                  </span>
                  <span className="text-[10px] text-neutral-400 block mt-1">Awaiting confirmations</span>
                </div>
                <div className="bg-pine-950 p-5 rounded-2xl border border-pine-850">
                  <span className="text-[9px] font-mono font-bold text-neutral-500 uppercase tracking-widest block">CMS Sync Status</span>
                  <span className="font-display font-black text-sm text-sky-400 uppercase tracking-wide block mt-2.5 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 animate-pulse text-sky-400" /> SYNCED LOCAL
                  </span>
                  <span className="text-[10px] text-neutral-400 block mt-1">Reactive save enabled</span>
                </div>
              </div>

              {/* System State Warning / Explainer */}
              <div className="bg-pine-950 rounded-2xl p-6 border border-pine-850 space-y-4">
                <h4 className="font-display font-bold text-xs text-cream-100 uppercase tracking-wider flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-gold-500" />
                  Understanding The Ledge's Two Systems
                </h4>
                <div className="text-xs text-neutral-400 space-y-2.5 leading-relaxed">
                  <p>
                    Your website operates with <strong>strict modular boundaries</strong>. Under the user's direction, the Customer UI is designed to remain completely blank of static content (displaying elegant wireframe image blocks and empty typography frames) until you, the administrator, upload details through this control panel.
                  </p>
                  <p>
                    The layout, typography (fonts, sizes), and backing pine forest colors remain solid and high-contrast, but the content is entirely in your hands! You can test this workflow in two ways:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div className="p-4 bg-red-500/5 rounded-xl border border-red-500/10 space-y-1">
                      <h5 className="font-bold text-xs text-red-400 flex items-center gap-1.5">
                        <RotateCcw className="w-3.5 h-3.5" /> 1. Reset to Blank Slate
                      </h5>
                      <p className="text-[11px] text-neutral-500">
                        Wipes all dynamic content. Returning to the Customer UI will show realistic wireframe placeholders where images, prices, and descriptions will go once entered.
                      </p>
                    </div>
                    <div className="p-4 bg-gold-500/5 rounded-xl border border-gold-500/10 space-y-1">
                      <h5 className="font-bold text-xs text-gold-400 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" /> 2. Seed Default Content
                      </h5>
                      <p className="text-[11px] text-neutral-500">
                        Instantly populates the system with The Ledge's premium default setup so you can observe what a fully styled, finished website feels like immediately!
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Pre-seeded Gallery Shortcut */}
              <div className="space-y-3">
                <h4 className="font-display font-bold text-xs text-cream-100 uppercase tracking-wider pl-1">
                  Quick Image Preset Gallery
                </h4>
                <p className="text-[11px] text-neutral-400 leading-normal pl-1">
                  Copy any of these carefully curated high-resolution mountain camping images from Unsplash to easily paste into your image sections:
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {HIGH_QUALITY_PRESET_IMAGES.map((img, idx) => (
                    <div 
                      key={idx} 
                      className="group bg-pine-950 border border-pine-850 hover:border-gold-500/40 rounded-xl overflow-hidden cursor-pointer p-1.5 transition-all"
                      onClick={() => {
                        navigator.clipboard.writeText(img.url);
                        triggerToast(`Copied image link for "${img.name}"!`);
                      }}
                      title="Click to copy Unsplash image URL"
                    >
                      <div className="aspect-video rounded-lg overflow-hidden bg-pine-900 relative">
                        <img src={img.url} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                        <span className="absolute bottom-1 right-1 text-[8px] bg-black/75 px-1 py-0.5 rounded font-mono text-neutral-300">Copy</span>
                      </div>
                      <span className="text-[10px] text-neutral-400 font-display font-semibold mt-1 block truncate px-0.5">
                        {img.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Custom Cloud Storage Image Library */}
              <div className="space-y-3 border-t border-pine-850/50 pt-5">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 px-1">
                  <div>
                    <h4 className="font-display font-bold text-xs text-cream-100 uppercase tracking-wider">
                      Your Cloud Storage Image Library
                    </h4>
                    <p className="text-[11px] text-neutral-400 leading-normal mt-0.5">
                      Upload and store your own custom images directly on The Ledge Cloud Storage. Click any card to copy its URL!
                    </p>
                  </div>
                  
                  <label className="py-2 px-3.5 rounded-xl bg-gold-500 hover:bg-gold-400 text-ink font-display font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5 shrink-0 self-stretch sm:self-auto justify-center">
                    <span>{isUploading ? 'Uploading Image...' : 'Upload Image File'}</span>
                    <Plus className="w-3.5 h-3.5" />
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          handleImageUpload(file, (url) => {
                            // Automatically updates via state refresh
                          });
                        }
                      }}
                    />
                  </label>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {customImages.length === 0 && (
                    <div className="col-span-full py-8 text-center bg-pine-950 border border-dashed border-pine-850 rounded-2xl text-neutral-500 text-xs">
                      No custom cloud storage images yet. Click "Upload Image File" above to add your own!
                    </div>
                  )}

                  {customImages.map((img, idx) => (
                    <div 
                      key={idx} 
                      className="group bg-pine-950 border border-pine-850 hover:border-gold-500/40 rounded-xl overflow-hidden cursor-pointer p-1.5 transition-all"
                      onClick={() => {
                        navigator.clipboard.writeText(img.url);
                        triggerToast(`Copied public cloud URL for "${img.name}"!`);
                      }}
                      title="Click to copy cloud storage URL"
                    >
                      <div className="aspect-video rounded-lg overflow-hidden bg-pine-900 relative">
                        <img src={img.url} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                        <span className="absolute bottom-1 right-1 text-[8px] bg-emerald-500/90 text-white px-1 py-0.5 rounded font-mono font-bold">Copy URL</span>
                      </div>
                      <span className="text-[10px] text-cream-100 font-display font-semibold mt-1 block truncate px-0.5">
                        {img.name}
                      </span>
                      <span className="text-[8px] text-neutral-500 font-mono block truncate px-0.5">
                        Cloud Storage Path
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: HERO CONFIGURATION */}
          {activeTab === 'hero' && (
            <div className="space-y-6 animate-fadeIn" id="admin_tab_hero">
              <div className="flex justify-between items-center pb-4 border-b border-pine-850">
                <div>
                  <h3 className="font-serif font-black text-xl text-cream-100">Hero Section Content</h3>
                  <p className="text-xs text-neutral-400 mt-1">Configure your main billboard title, tagline badge, and big backdrop image.</p>
                </div>
                <button 
                  onClick={() => handleSave(tempData)}
                  className="py-2.5 px-4 rounded-xl bg-gold-500 hover:bg-gold-400 text-ink font-display font-black text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-lg cursor-pointer"
                >
                  <Save className="w-4 h-4" /> Save Billboard
                </button>
              </div>

              <div className="space-y-4">
                {/* Backdrop Image */}
                <div className="bg-pine-950 p-5 rounded-2xl border border-pine-850 space-y-3 text-left">
                  <label className="text-xs font-bold text-cream-100 uppercase tracking-wider font-display block">
                    Hero Billboard Background Image URL
                  </label>
                  <div className="flex flex-col sm:flex-row gap-3 items-center">
                    <input 
                      type="text"
                      placeholder="Paste Unsplash image URL or use a preset..."
                      value={tempData.hero.backgroundImage}
                      onChange={(e) => setTempData({
                        ...tempData,
                        hero: { ...tempData.hero, backgroundImage: e.target.value }
                      })}
                      className="flex-1 bg-pine-900 border border-pine-800 focus:border-gold-500/80 rounded-xl px-4 py-2.5 text-xs text-cream-50 placeholder-neutral-600 focus:outline-none font-mono w-full"
                    />
                    <div className="flex gap-2 shrink-0 self-stretch sm:self-auto justify-end">
                      <button 
                        onClick={() => setTempData({
                          ...tempData,
                          hero: { ...tempData.hero, backgroundImage: HIGH_QUALITY_PRESET_IMAGES[0].url }
                        })}
                        type="button"
                        className="py-2.5 px-4 rounded-xl bg-pine-900 border border-pine-805 text-gold-400 hover:text-gold-300 font-display font-semibold text-xs transition-all cursor-pointer"
                      >
                        Use Default Preset
                      </button>
                      <label className="py-2.5 px-4 rounded-xl bg-gold-500 hover:bg-gold-400 text-ink font-display font-bold text-xs transition-all cursor-pointer flex items-center gap-1">
                        <span>{isUploading ? '...' : 'Upload'}</span>
                        <input 
                          type="file" 
                          accept="image/*" 
                          className="hidden" 
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              handleImageUpload(file, (url) => {
                                setTempData({
                                  ...tempData,
                                  hero: { ...tempData.hero, backgroundImage: url }
                                });
                              });
                            }
                          }}
                        />
                      </label>
                    </div>
                  </div>
                  {tempData.hero.backgroundImage ? (
                    <div className="mt-2 aspect-[21/9] w-full rounded-xl overflow-hidden border border-pine-850">
                      <img src={tempData.hero.backgroundImage} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="mt-2 aspect-[21/9] w-full rounded-xl border border-dashed border-pine-800 flex items-center justify-center bg-pine-900/30 text-neutral-500 text-xs">
                      No background image specified. Customer UI will display a solid dark fallback.
                    </div>
                  )}
                </div>

                {/* Subheader and Titles */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-pine-950 p-5 rounded-2xl border border-pine-850 space-y-1.5 text-left">
                    <label className="text-xs font-bold text-cream-100 uppercase tracking-wider font-display block">
                      Tagline Badge Text (Small Caps)
                    </label>
                    <input 
                      type="text"
                      placeholder="e.g. A SHORT TAGLINE"
                      value={tempData.hero.tagline}
                      onChange={(e) => setTempData({
                        ...tempData,
                        hero: { ...tempData.hero, tagline: e.target.value }
                      })}
                      className="w-full bg-pine-900 border border-pine-800 focus:border-gold-500/80 rounded-xl px-4 py-2.5 text-xs text-cream-50 focus:outline-none"
                    />
                  </div>

                  <div className="bg-pine-950 p-5 rounded-2xl border border-pine-850 space-y-1.5 text-left">
                    <label className="text-xs font-bold text-cream-100 uppercase tracking-wider font-display block">
                      Main Brand Title
                    </label>
                    <input 
                      type="text"
                      placeholder="e.g. The Ledge"
                      value={tempData.hero.title}
                      onChange={(e) => setTempData({
                        ...tempData,
                        hero: { ...tempData.hero, title: e.target.value }
                      })}
                      className="w-full bg-pine-900 border border-pine-800 focus:border-gold-500/80 rounded-xl px-4 py-2.5 text-xs text-cream-50 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Main description */}
                <div className="bg-pine-950 p-5 rounded-2xl border border-pine-850 space-y-1.5 text-left">
                  <label className="text-xs font-bold text-cream-100 uppercase tracking-wider font-display block">
                    Hero Subtitle & Introduction Paragraph
                  </label>
                  <textarea 
                    rows={3}
                    placeholder="Provide a welcoming sentence describing your venue..."
                    value={tempData.hero.description}
                    onChange={(e) => setTempData({
                      ...tempData,
                      hero: { ...tempData.hero, description: e.target.value }
                    })}
                    className="w-full bg-pine-900 border border-pine-800 focus:border-gold-500/80 rounded-xl px-4 py-3 text-xs text-cream-50 focus:outline-none leading-relaxed"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: ACCOMMODATIONS */}
          {activeTab === 'accommodations' && (
            <div className="space-y-6 animate-fadeIn" id="admin_tab_accommodations">
              <div className="flex justify-between items-center pb-4 border-b border-pine-850">
                <div>
                  <h3 className="font-serif font-black text-xl text-cream-100">Accommodation Schemes</h3>
                  <p className="text-xs text-neutral-400 mt-1">Configure pricing, details, available quantities, and images for stay packages.</p>
                </div>
                <button 
                  onClick={() => handleSave(tempData)}
                  className="py-2.5 px-4 rounded-xl bg-gold-500 hover:bg-gold-400 text-ink font-display font-black text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-lg cursor-pointer"
                >
                  <Save className="w-4 h-4" /> Save Stays
                </button>
              </div>

              <div className="space-y-6">
                {tempData.accommodations.map((acc, index) => (
                  <div key={acc.id} className="bg-pine-950 p-6 rounded-2xl border border-pine-850 space-y-4 text-left">
                    <div className="flex justify-between items-center border-b border-pine-900 pb-3">
                      <span className="text-xs font-black tracking-widest text-gold-400 font-display uppercase">
                        Unit Type #{index + 1} — {acc.type === 'premium' ? 'Premium' : acc.type === 'standard' ? 'Standard' : 'Basic'}
                      </span>
                      <span className="text-[10px] font-mono text-neutral-500 uppercase font-semibold">ID: {acc.id}</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-4">
                        {/* Accommodation Name */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-cream-100 uppercase tracking-widest font-display block">
                            Accommodation Title
                          </label>
                          <input 
                            type="text"
                            placeholder="e.g. Glass-Front Luxury Cabin"
                            value={acc.name}
                            onChange={(e) => {
                              const list = [...tempData.accommodations];
                              list[index].name = e.target.value;
                              setTempData({ ...tempData, accommodations: list });
                            }}
                            className="w-full bg-pine-900 border border-pine-800 focus:border-gold-500/80 rounded-xl px-4 py-2 text-xs text-cream-50 focus:outline-none"
                          />
                        </div>

                        {/* Capacity and plot limit */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-cream-100 uppercase tracking-widest font-display block">
                              Max Capacity (Pax)
                            </label>
                            <input 
                              type="number"
                              min={1}
                              value={acc.capacity || ''}
                              onChange={(e) => {
                                const list = [...tempData.accommodations];
                                list[index].capacity = parseInt(e.target.value) || 0;
                                setTempData({ ...tempData, accommodations: list });
                              }}
                              className="w-full bg-pine-900 border border-pine-800 focus:border-gold-500/80 rounded-xl px-4 py-2 text-xs text-cream-50 focus:outline-none"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-cream-100 uppercase tracking-widest font-display block">
                              Total Plot Plots Available
                            </label>
                            <input 
                              type="number"
                              min={0}
                              value={acc.quantity || ''}
                              onChange={(e) => {
                                const list = [...tempData.accommodations];
                                list[index].quantity = parseInt(e.target.value) || 0;
                                setTempData({ ...tempData, accommodations: list });
                              }}
                              className="w-full bg-pine-900 border border-pine-800 focus:border-gold-500/80 rounded-xl px-4 py-2 text-xs text-cream-50 focus:outline-none"
                            />
                          </div>
                        </div>

                        {/* Rate Price */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-cream-100 uppercase tracking-widest font-display block">
                            Price per Night (₱)
                          </label>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gold-500">
                              <span className="text-xs font-semibold">₱</span>
                            </div>
                            <input 
                              type="number"
                              min={0}
                              value={acc.price || ''}
                              onChange={(e) => {
                                const list = [...tempData.accommodations];
                                list[index].price = parseInt(e.target.value) || 0;
                                setTempData({ ...tempData, accommodations: list });
                              }}
                              className="w-full bg-pine-900 border border-pine-800 focus:border-gold-500/80 rounded-xl pl-8 pr-4 py-2 text-xs text-cream-50 focus:outline-none font-mono font-bold"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        {/* Image URL */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-cream-100 uppercase tracking-widest font-display block">
                            Cover Image URL (Unsplash or custom URL)
                          </label>
                          <div className="flex gap-2">
                            <input 
                              type="text"
                              placeholder="https://images.unsplash.com/photo-..."
                              value={acc.imageUrl}
                              onChange={(e) => {
                                const list = [...tempData.accommodations];
                                list[index].imageUrl = e.target.value;
                                setTempData({ ...tempData, accommodations: list });
                              }}
                              className="flex-1 bg-pine-900 border border-pine-800 focus:border-gold-500/80 rounded-xl px-4 py-2 text-xs text-cream-50 focus:outline-none font-mono"
                            />
                            <label className="py-2 px-3 rounded-xl bg-gold-500 hover:bg-gold-400 text-ink font-display font-bold text-xs transition-all cursor-pointer flex items-center justify-center shrink-0">
                              <span>{isUploading ? '...' : 'Upload'}</span>
                              <input 
                                type="file" 
                                accept="image/*" 
                                className="hidden" 
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    handleImageUpload(file, (url) => {
                                      const list = [...tempData.accommodations];
                                      list[index].imageUrl = url;
                                      setTempData({ ...tempData, accommodations: list });
                                    });
                                  }
                                }}
                              />
                            </label>
                          </div>
                        </div>

                        {/* Thumbnail Preview */}
                        {acc.imageUrl ? (
                          <div className="aspect-video w-full rounded-xl overflow-hidden border border-pine-850 bg-pine-900 relative">
                            <img src={acc.imageUrl} className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <div className="aspect-video w-full rounded-xl border border-dashed border-pine-800 flex flex-col items-center justify-center bg-pine-900/30 text-neutral-500 text-[10px] p-4 text-center">
                            <ImageIcon className="w-6 h-6 text-neutral-600 mb-1" />
                            <span>No cover image uploaded. Displays blank outline card in customer UI.</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Accommodation description */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-cream-100 uppercase tracking-widest font-display block">
                        Description Specs
                      </label>
                      <textarea 
                        rows={2}
                        placeholder="Detail the cabin specifications, bedding, scenery, views, and washroom details..."
                        value={acc.description}
                        onChange={(e) => {
                          const list = [...tempData.accommodations];
                          list[index].description = e.target.value;
                          setTempData({ ...tempData, accommodations: list });
                        }}
                        className="w-full bg-pine-900 border border-pine-800 focus:border-gold-500/80 rounded-xl px-4 py-2.5 text-xs text-cream-50 focus:outline-none leading-relaxed"
                      />
                    </div>

                    {/* Features Tagging */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-cream-100 uppercase tracking-widest font-display block">
                        Amenities Checklist Index (Features list separated by commas)
                      </label>
                      <input 
                        type="text"
                        placeholder="Queen Bed, High-speed Wi-Fi, Private Bathroom, Balcony view..."
                        value={acc.features.join(', ')}
                        onChange={(e) => {
                          const list = [...tempData.accommodations];
                          list[index].features = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                          setTempData({ ...tempData, accommodations: list });
                        }}
                        className="w-full bg-pine-900 border border-pine-800 focus:border-gold-500/80 rounded-xl px-4 py-2 text-xs text-cream-50 focus:outline-none"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: BACKSTORY */}
          {activeTab === 'backstory' && (
            <div className="space-y-6 animate-fadeIn" id="admin_tab_backstory">
              <div className="flex justify-between items-center pb-4 border-b border-pine-850">
                <div>
                  <h3 className="font-serif font-black text-xl text-cream-100">Campsite Story, Geo-coordinates, & Reviews</h3>
                  <p className="text-xs text-neutral-400 mt-1">Configure your mountain story description paragraphs, elevations, and author testimonials.</p>
                </div>
                <button 
                  onClick={() => handleSave(tempData)}
                  className="py-2.5 px-4 rounded-xl bg-gold-500 hover:bg-gold-400 text-ink font-display font-black text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-lg cursor-pointer"
                >
                  <Save className="w-4 h-4" /> Save Backstory
                </button>
              </div>

              <div className="space-y-4">
                {/* Headers and Taglines */}
                <div className="bg-pine-950 p-5 rounded-2xl border border-pine-850 space-y-4 text-left">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-cream-100 uppercase tracking-wider font-display block">
                        Story Subtitle Tagline
                      </label>
                      <input 
                        type="text"
                        placeholder="OUR MOUNTAIN STORY"
                        value={tempData.about.tagline}
                        onChange={(e) => setTempData({
                          ...tempData,
                          about: { ...tempData.about, tagline: e.target.value }
                        })}
                        className="w-full bg-pine-900 border border-pine-800 focus:border-gold-500/80 rounded-xl px-4 py-2 text-xs text-cream-50 focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-cream-100 uppercase tracking-wider font-display block">
                        Story Section Title
                      </label>
                      <input 
                        type="text"
                        placeholder="e.g. Cozy Mountain Cabins Meet the Wilderness"
                        value={tempData.about.title}
                        onChange={(e) => setTempData({
                          ...tempData,
                          about: { ...tempData.about, title: e.target.value }
                        })}
                        className="w-full bg-pine-900 border border-pine-800 focus:border-gold-500/80 rounded-xl px-4 py-2 text-xs text-cream-50 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Paragraphs */}
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-cream-100 uppercase tracking-wider font-display block">
                        Description Paragraph 1
                      </label>
                      <textarea 
                        rows={3}
                        placeholder="First story paragraph describing where you are..."
                        value={tempData.about.desc1}
                        onChange={(e) => setTempData({
                          ...tempData,
                          about: { ...tempData.about, desc1: e.target.value }
                        })}
                        className="w-full bg-pine-900 border border-pine-800 focus:border-gold-500/80 rounded-xl px-4 py-2.5 text-xs text-cream-50 focus:outline-none leading-relaxed"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-cream-100 uppercase tracking-wider font-display block">
                        Description Paragraph 2
                      </label>
                      <textarea 
                        rows={3}
                        placeholder="Second story paragraph detailing activities and cafe hospitality..."
                        value={tempData.about.desc2}
                        onChange={(e) => setTempData({
                          ...tempData,
                          about: { ...tempData.about, desc2: e.target.value }
                        })}
                        className="w-full bg-pine-900 border border-pine-800 focus:border-gold-500/80 rounded-xl px-4 py-2.5 text-xs text-cream-50 focus:outline-none leading-relaxed"
                      />
                    </div>
                  </div>
                </div>

                {/* Geographical Stats Plaque */}
                <div className="bg-pine-950 p-5 rounded-2xl border border-pine-850 space-y-4 text-left">
                  <h4 className="text-xs font-bold text-cream-100 uppercase tracking-wider font-display block border-b border-pine-900 pb-2">
                    Geo-Coordinates & Plaque Specs
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] text-neutral-400 font-display font-semibold uppercase">Elevation height</label>
                      <input 
                        type="text"
                        placeholder="5,140 FT ASL"
                        value={tempData.about.elevation}
                        onChange={(e) => setTempData({
                          ...tempData,
                          about: { ...tempData.about, elevation: e.target.value }
                        })}
                        className="w-full bg-pine-900 border border-pine-800 focus:border-gold-500/80 rounded-xl px-3.5 py-2 text-xs text-cream-50 focus:outline-none font-mono font-bold text-gold-400"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-neutral-400 font-display font-semibold uppercase">Climate Average</label>
                      <input 
                        type="text"
                        placeholder="14°C — 19°C"
                        value={tempData.about.climate}
                        onChange={(e) => setTempData({
                          ...tempData,
                          about: { ...tempData.about, climate: e.target.value }
                        })}
                        className="w-full bg-pine-900 border border-pine-800 focus:border-gold-500/80 rounded-xl px-3.5 py-2 text-xs text-cream-50 focus:outline-none font-mono font-bold text-gold-400"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-neutral-400 font-display font-semibold uppercase">latitude</label>
                      <input 
                        type="text"
                        placeholder="16.3792° N"
                        value={tempData.about.latitude}
                        onChange={(e) => setTempData({
                          ...tempData,
                          about: { ...tempData.about, latitude: e.target.value }
                        })}
                        className="w-full bg-pine-900 border border-pine-800 focus:border-gold-500/80 rounded-xl px-3.5 py-2 text-xs text-cream-50 focus:outline-none font-mono font-bold text-cream-200"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-neutral-400 font-display font-semibold uppercase">longitude</label>
                      <input 
                        type="text"
                        placeholder="120.5755° E"
                        value={tempData.about.longitude}
                        onChange={(e) => setTempData({
                          ...tempData,
                          about: { ...tempData.about, longitude: e.target.value }
                        })}
                        className="w-full bg-pine-900 border border-pine-800 focus:border-gold-500/80 rounded-xl px-3.5 py-2 text-xs text-cream-50 focus:outline-none font-mono font-bold text-cream-200"
                      />
                    </div>
                  </div>
                </div>

                {/* Testimonial Quote */}
                <div className="bg-pine-950 p-5 rounded-2xl border border-pine-850 space-y-4 text-left">
                  <h4 className="text-xs font-bold text-cream-100 uppercase tracking-wider font-display block border-b border-pine-900 pb-2">
                    Testimonial Quote Card
                  </h4>
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-neutral-400 font-display font-semibold uppercase">Quote Text</label>
                      <textarea 
                        rows={2}
                        placeholder="Review or custom customer feedback text..."
                        value={tempData.about.quoteText}
                        onChange={(e) => setTempData({
                          ...tempData,
                          about: { ...tempData.about, quoteText: e.target.value }
                        })}
                        className="w-full bg-pine-900 border border-pine-800 focus:border-gold-500/80 rounded-xl px-4 py-2 text-xs text-cream-50 focus:outline-none italic leading-relaxed"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] text-neutral-400 font-display font-semibold uppercase">Quote Author Name</label>
                        <input 
                          type="text"
                          placeholder="e.g. Maverick Villanueva"
                          value={tempData.about.quoteAuthor}
                          onChange={(e) => setTempData({
                            ...tempData,
                            about: { ...tempData.about, quoteAuthor: e.target.value }
                          })}
                          className="w-full bg-pine-900 border border-pine-800 focus:border-gold-500/80 rounded-xl px-4 py-2 text-xs text-cream-50 focus:outline-none"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] text-neutral-400 font-display font-semibold uppercase">Author Meta Location / Year</label>
                        <input 
                          type="text"
                          placeholder="e.g. Manila, Philippines (Stayed May 2026)"
                          value={tempData.about.quoteMeta}
                          onChange={(e) => setTempData({
                            ...tempData,
                            about: { ...tempData.about, quoteMeta: e.target.value }
                          })}
                          className="w-full bg-pine-900 border border-pine-800 focus:border-gold-500/80 rounded-xl px-4 py-2 text-xs text-cream-50 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: SERVICES */}
          {activeTab === 'services' && (
            <div className="space-y-6 animate-fadeIn" id="admin_tab_services">
              <div className="flex justify-between items-center pb-4 border-b border-pine-850">
                <div>
                  <h3 className="font-serif font-black text-xl text-cream-100">Hospitality Services</h3>
                  <p className="text-xs text-neutral-400 mt-1">Configure pricing tags, image covers, and feature indices for key amenities.</p>
                </div>
                <button 
                  onClick={() => handleSave(tempData)}
                  className="py-2.5 px-4 rounded-xl bg-gold-500 hover:bg-gold-400 text-ink font-display font-black text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-lg cursor-pointer"
                >
                  <Save className="w-4 h-4" /> Save Services
                </button>
              </div>

              <div className="space-y-6">
                {tempData.services.map((srv, index) => (
                  <div key={srv.id} className="bg-pine-950 p-6 rounded-2xl border border-pine-850 space-y-4 text-left">
                    <div className="flex justify-between items-center border-b border-pine-900 pb-3">
                      <span className="text-xs font-black tracking-widest text-gold-400 font-display uppercase">
                        Hospitality Service #{index + 1}
                      </span>
                      <span className="text-[10px] font-mono text-neutral-500 uppercase font-semibold">ID: {srv.id}</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-4">
                        {/* Service Title */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-cream-100 uppercase tracking-widest font-display block">
                            Service Name
                          </label>
                          <input 
                            type="text"
                            placeholder="e.g. Cafe & Restaurant"
                            value={srv.name}
                            onChange={(e) => {
                              const list = [...tempData.services];
                              list[index].name = e.target.value;
                              setTempData({ ...tempData, services: list });
                            }}
                            className="w-full bg-pine-900 border border-pine-800 focus:border-gold-500/80 rounded-xl px-4 py-2 text-xs text-cream-50 focus:outline-none"
                          />
                        </div>

                        {/* Rate Price Indicator */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-cream-100 uppercase tracking-widest font-display block">
                            Service Price Tag Label
                          </label>
                          <input 
                            type="text"
                            placeholder="e.g. Included in stay or A la carte (from ₱0)"
                            value={srv.price}
                            onChange={(e) => {
                              const list = [...tempData.services];
                              list[index].price = e.target.value;
                              setTempData({ ...tempData, services: list });
                            }}
                            className="w-full bg-pine-900 border border-pine-800 focus:border-gold-500/80 rounded-xl px-4 py-2 text-xs text-cream-50 focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="space-y-4">
                        {/* Cover Image URL */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-cream-100 uppercase tracking-widest font-display block">
                            Service Card Image URL
                          </label>
                          <div className="flex gap-2">
                            <input 
                              type="text"
                              placeholder="https://images.unsplash.com/photo-..."
                              value={srv.image}
                              onChange={(e) => {
                                const list = [...tempData.services];
                                list[index].image = e.target.value;
                                setTempData({ ...tempData, services: list });
                              }}
                              className="flex-1 bg-pine-900 border border-pine-800 focus:border-gold-500/80 rounded-xl px-4 py-2 text-xs text-cream-50 focus:outline-none font-mono"
                            />
                            <label className="py-2 px-3 rounded-xl bg-gold-500 hover:bg-gold-400 text-ink font-display font-bold text-xs transition-all cursor-pointer flex items-center justify-center shrink-0">
                              <span>{isUploading ? '...' : 'Upload'}</span>
                              <input 
                                type="file" 
                                accept="image/*" 
                                className="hidden" 
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    handleImageUpload(file, (url) => {
                                      const list = [...tempData.services];
                                      list[index].image = url;
                                      setTempData({ ...tempData, services: list });
                                    });
                                  }
                                }}
                              />
                            </label>
                          </div>
                        </div>

                        {/* Image Preview */}
                        {srv.image ? (
                          <div className="aspect-video w-full rounded-xl overflow-hidden border border-pine-850 bg-pine-900">
                            <img src={srv.image} className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <div className="aspect-video w-full rounded-xl border border-dashed border-pine-800 flex flex-col items-center justify-center bg-pine-900/30 text-neutral-500 text-[10px] p-4 text-center">
                            <ImageIcon className="w-5 h-5 text-neutral-600 mb-1" />
                            <span>No cover image uploaded. Displays blank outline card in customer UI.</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Description Paragraph */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-cream-100 uppercase tracking-widest font-display block">
                        Service Description
                      </label>
                      <textarea 
                        rows={2}
                        placeholder="Short summary of what this service includes..."
                        value={srv.description}
                        onChange={(e) => {
                          const list = [...tempData.services];
                          list[index].description = e.target.value;
                          setTempData({ ...tempData, services: list });
                        }}
                        className="w-full bg-pine-900 border border-pine-800 focus:border-gold-500/80 rounded-xl px-4 py-2 text-xs text-cream-50 focus:outline-none leading-relaxed"
                      />
                    </div>

                    {/* Features checklist details */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-cream-100 uppercase tracking-widest font-display block">
                        Details Bullet Points checklist (Separated by commas)
                      </label>
                      <input 
                        type="text"
                        placeholder="Indoor lounge, Scenic deck, Cold brew coffee, Hot cocoa mugs..."
                        value={srv.details.join(', ')}
                        onChange={(e) => {
                          const list = [...tempData.services];
                          list[index].details = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                          setTempData({ ...tempData, services: list });
                        }}
                        className="w-full bg-pine-900 border border-pine-800 focus:border-gold-500/80 rounded-xl px-4 py-2 text-xs text-cream-50 focus:outline-none"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 6: BOOKINGS LIST */}
          {activeTab === 'bookings' && (() => {
            const unconfirmed = bookings.filter(b => b.status === 'pending');
            const confirmed   = bookings.filter(b => b.status === 'confirmed');
            const archived    = bookings.filter(b => b.status === 'cancelled' || b.status === 'rejected');

            const q = bookingSearch.trim().toLowerCase();
            const matches = (b: Booking) =>
              String(b.reference || '').toLowerCase().includes(q) ||
              String(b.customerName || '').toLowerCase().includes(q) ||
              String(b.customerEmail || '').toLowerCase().includes(q) ||
              String(b.customerPhone || '').toLowerCase().includes(q);

            // A search looks across every tab, so a reference is always findable
            // no matter which list it currently sits in.
            const searching = q.length > 0;
            const source = bookingFilter === 'confirmed' ? confirmed
                         : bookingFilter === 'archived'  ? archived
                         : unconfirmed;
            const rows = searching ? bookings.filter(matches) : source;

            const TABS = [
              { key: 'unconfirmed' as const, label: 'Unconfirmed', sub: 'Awaiting payment', count: unconfirmed.length },
              { key: 'confirmed'   as const, label: 'Confirmed',   sub: 'Payment verified', count: confirmed.length },
              { key: 'archived'    as const, label: 'Cancelled / Removed', sub: 'No longer active', count: archived.length },
            ];

            const emptyCopy = searching
              ? 'No booking matches that search.'
              : bookingFilter === 'unconfirmed' ? 'No bookings awaiting payment.'
              : bookingFilter === 'confirmed'   ? 'No confirmed bookings yet.'
              : 'Nothing cancelled or removed.';

            return (
            <div className="space-y-5 animate-fadeIn" id="admin_tab_bookings">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h3 className="font-serif font-black text-xl text-cream-100">Live Customer Bookings Dashboard</h3>
                  <p className="text-xs text-neutral-400 mt-1">Verify payments, approve reservations, and manage cancellations.</p>
                </div>
                <button
                  onClick={onRefreshBookings}
                  className="py-2 px-3 rounded-xl bg-pine-900 border border-pine-800 hover:border-gold-500/50 text-neutral-300 font-display font-bold text-[10px] uppercase tracking-wider transition-all inline-flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3 h-3" /> Refresh
                </button>
              </div>

              {/* Sub-tabs */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {TABS.map(t => {
                  const active = !searching && bookingFilter === t.key;
                  return (
                    <button
                      key={t.key}
                      onClick={() => { setBookingFilter(t.key); setBookingSearch(''); }}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        active
                          ? 'bg-gold-500/10 border-gold-500'
                          : 'bg-pine-950 border-pine-850 hover:border-pine-700'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className={`font-display font-bold text-xs ${active ? 'text-gold-300' : 'text-cream-100'}`}>{t.label}</span>
                        <span className={`text-[10px] font-black py-0.5 px-2 rounded-full ${
                          t.key === 'unconfirmed' && t.count > 0
                            ? 'bg-amber-500/20 text-amber-300'
                            : active ? 'bg-gold-500/20 text-gold-300' : 'bg-pine-900 text-neutral-400'
                        }`}>{t.count}</span>
                      </div>
                      <span className="text-[10px] text-neutral-500 block mt-0.5">{t.sub}</span>
                    </button>
                  );
                })}
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={bookingSearch}
                  onChange={e => setBookingSearch(e.target.value)}
                  placeholder="Search all bookings by reference (TL-XXXXXX), name, email, or phone..."
                  className="w-full bg-pine-950 border border-pine-850 focus:border-gold-500 rounded-xl py-2.5 pl-10 pr-24 text-xs text-cream-100 outline-none transition-colors"
                />
                {!searching && bookingFilter === 'archived' && (
                <div className="text-[11px] text-neutral-400 bg-pine-950 border border-pine-850 rounded-xl px-3 py-2">
                  These reservations no longer hold any dates. <span className="text-gold-400 font-semibold">Restore</span> puts one back in Unconfirmed;
                  <span className="text-red-400 font-semibold"> Delete</span> erases it from the database permanently.
                </div>
              )}

              {searching && (
                  <button
                    onClick={() => setBookingSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] uppercase font-bold tracking-wider text-neutral-400 hover:text-gold-400 py-1 px-2 rounded-lg border border-pine-800"
                  >
                    Clear
                  </button>
                )}
              </div>

              {searching && (
                <div className="text-[11px] text-gold-400/90 bg-gold-500/5 border border-gold-500/20 rounded-xl px-3 py-2">
                  Showing <span className="font-bold">{rows.length}</span> result{rows.length === 1 ? '' : 's'} across <span className="font-bold">all</span> bookings.
                </div>
              )}

              {rows.length === 0 ? (
                <div className="py-16 border border-dashed border-pine-800 rounded-3xl text-center text-neutral-400 text-xs flex flex-col items-center justify-center space-y-2">
                  <Calendar className="w-8 h-8 text-neutral-600" />
                  <span>{emptyCopy}</span>
                  {!searching && bookings.length > 0 && (
                    <span className="text-[11px] text-neutral-500">
                      You have {bookings.length} reservation{bookings.length === 1 ? '' : 's'} in the other tabs above.
                    </span>
                  )}
                </div>
              ) : (
                <div className="bg-pine-950 border border-pine-850 rounded-2xl overflow-hidden" id="bookings_table_wrapper">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] border-collapse text-xs">
                      <thead>
                        <tr className="bg-pine-900/80 text-neutral-400 text-[10px] uppercase tracking-widest font-display font-black border-b border-pine-850">
                          <th className="p-4 text-left">Reference</th>
                          <th className="p-4 text-left">Customer</th>
                          <th className="p-4 text-left">Stay Plot</th>
                          <th className="p-4 text-left">Check In/Out</th>
                          <th className="p-4 text-right">Amount</th>
                          <th className="p-4 text-center">Status</th>
                          <th className="p-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-pine-900/60 font-medium">
                        {rows.map((b) => {
                          const cabinName = currentData.accommodations.find(a => a.id === b.accommodationId)?.name || 'Custom Accommodation';
                          const isArchived = b.status === 'cancelled' || b.status === 'rejected';
                          return (
                            <tr key={b.id} className={`hover:bg-pine-900/25 transition-colors ${isArchived ? 'opacity-60' : ''}`} id={`booking_row_${b.id}`}>
                              <td className="p-4">
                                <div className="font-mono font-bold text-gold-400">{b.reference || b.id}</div>
                                <div className="text-[9px] text-neutral-600 font-mono">id {b.id}</div>
                              </td>
                              <td className="p-4 text-left">
                                <div className="font-bold text-cream-100">{b.customerName}</div>
                                <div className="text-[10px] text-neutral-500 font-mono">{b.customerEmail} | {b.customerPhone}</div>
                              </td>
                              <td className="p-4 text-neutral-300 font-display font-semibold">{cabinName}</td>
                              <td className="p-4 text-neutral-300 font-mono">
                                <div>In: {b.checkIn}</div>
                                <div className="text-[10px] text-neutral-500">Out: {b.checkOut}</div>
                              </td>
                              <td className="p-4 text-right font-mono font-bold text-cream-100">
                                ₱{b.totalAmount.toLocaleString()}
                              </td>
                              <td className="p-4 text-center">
                                <span className={`inline-block px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider font-display whitespace-nowrap ${
                                  b.status === 'confirmed'
                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                    : b.status === 'pending'
                                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                    : 'bg-neutral-500/10 text-neutral-400 border border-neutral-500/20'
                                }`}>
                                  {b.status === 'pending' ? 'unpaid' : b.status}
                                </span>
                              </td>
                              <td className="p-4 text-right space-x-1.5 whitespace-nowrap">
                                {b.status === 'pending' && (
                                  <button
                                    onClick={() => handleMarkPaid(b.id)}
                                    className="p-1 px-2 rounded bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-ink font-display font-black text-[9px] uppercase tracking-wider transition-all cursor-pointer inline-flex items-center gap-1 border border-emerald-500/20"
                                    title="Confirm payment received"
                                  >
                                    <CheckCircle className="w-3 h-3" />
                                    <span>Confirm Payment</span>
                                  </button>
                                )}
                                {isArchived ? (
                                  <>
                                    <button
                                      onClick={() => handleUpdateBookingStatus(b.id, 'pending')}
                                      className="p-1 px-2 rounded bg-pine-900 border border-pine-800 hover:border-gold-500/50 text-neutral-400 hover:text-gold-400 font-display font-black text-[9px] uppercase tracking-wider transition-all cursor-pointer inline-flex items-center gap-1"
                                      title="Send back to Unconfirmed"
                                    >
                                      <RotateCcw className="w-3 h-3" />
                                      <span>Restore</span>
                                    </button>
                                    <button
                                      onClick={() => handleDeleteBooking(b.id, b.reference)}
                                      className="p-1 px-2 rounded bg-red-500/10 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/30 font-display font-black text-[9px] uppercase tracking-wider transition-all cursor-pointer inline-flex items-center gap-1"
                                      title="Permanently delete this record from the database"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                      <span>Delete</span>
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    onClick={() => handleUpdateBookingStatus(b.id, 'cancelled')}
                                    className="p-1 px-2 rounded bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white font-display font-black text-[9px] uppercase tracking-wider transition-all cursor-pointer inline-flex items-center gap-1 border border-red-500/20"
                                    title="Cancel this reservation (reversible)"
                                  >
                                    <XCircle className="w-3 h-3" />
                                    <span>Cancel</span>
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
            );
          })()}

          {activeTab === 'analytics' && (
            <div className="space-y-6 animate-fadeIn" id="admin_tab_analytics">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h3 className="font-serif font-black text-xl text-cream-100">Visitor Analytics</h3>
                  <p className="text-xs text-neutral-400 mt-1">
                    Unique visitors are counted using one anonymous cookie per browser, only for visitors who accepted cookies. Daily figures use Philippine time.
                  </p>
                </div>
                <button
                  onClick={loadAnalytics}
                  disabled={analyticsLoading}
                  className="py-2 px-4 rounded-xl bg-pine-900 border border-pine-800 hover:border-gold-500/50 text-neutral-300 font-display font-bold text-xs transition-all disabled:opacity-50 inline-flex items-center gap-2"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${analyticsLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>

              {analyticsLoading && !analytics ? (
                <div className="py-16 text-center text-neutral-500 text-xs">Loading visitor data…</div>
              ) : !analytics ? (
                <div className="py-16 border border-dashed border-pine-800 rounded-2xl text-center text-neutral-400 text-xs">
                  Couldn't load analytics. Try refreshing.
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {[
                      { label: 'Unique visitors today', value: analytics.uniqueToday },
                      { label: 'Unique visitors (7 days)', value: analytics.unique7d },
                      { label: 'Total unique visitors', value: analytics.totalUnique },
                      { label: 'Page views today', value: analytics.pageViewsToday },
                    ].map((s) => (
                      <div key={s.label} className="bg-pine-950 border border-pine-850 rounded-2xl p-4">
                        <div className="font-display font-black text-2xl text-gold-400">{Number(s.value).toLocaleString()}</div>
                        <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-display font-bold mt-1">{s.label}</div>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                    <div className="bg-pine-950 border border-pine-850 rounded-2xl p-4">
                      <span className="text-neutral-500 block">Unique visitors (30 days)</span>
                      <span className="font-display font-bold text-cream-100 text-lg">{Number(analytics.unique30d).toLocaleString()}</span>
                    </div>
                    <div className="bg-pine-950 border border-pine-850 rounded-2xl p-4">
                      <span className="text-neutral-500 block">Page views (7 days)</span>
                      <span className="font-display font-bold text-cream-100 text-lg">{Number(analytics.pageViews7d).toLocaleString()}</span>
                    </div>
                    <div className="bg-pine-950 border border-pine-850 rounded-2xl p-4">
                      <span className="text-neutral-500 block">Page views (all time)</span>
                      <span className="font-display font-bold text-cream-100 text-lg">{Number(analytics.pageViewsTotal).toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Last 14 days */}
                  <div className="bg-pine-950 border border-pine-850 rounded-2xl p-5">
                    <h4 className="font-display font-bold text-xs uppercase tracking-wider text-neutral-400 mb-4">Last 14 days</h4>
                    {(!analytics.daily || analytics.daily.length === 0) ? (
                      <div className="text-xs text-neutral-500 py-6 text-center">No visits recorded yet.</div>
                    ) : (
                      <div className="space-y-2">
                        {(() => {
                          const maxPv = Math.max(1, ...analytics.daily.map((d: any) => d.pageViews));
                          return analytics.daily.map((d: any) => (
                            <div key={d.day} className="flex items-center gap-3 text-[11px]">
                              <span className="w-20 shrink-0 text-neutral-500 font-mono">{d.day.slice(5)}</span>
                              <div className="flex-1 bg-pine-900 rounded-full h-4 overflow-hidden">
                                <div className="bg-gold-500/70 h-full rounded-full" style={{ width: `${(d.pageViews / maxPv) * 100}%` }} />
                              </div>
                              <span className="w-28 shrink-0 text-right text-neutral-300">
                                {d.newVisitors} new · {d.pageViews} views
                              </span>
                            </div>
                          ));
                        })()}
                      </div>
                    )}
                  </div>

                  {/* Recent visitors */}
                  <div className="bg-pine-950 border border-pine-850 rounded-2xl overflow-hidden">
                    <h4 className="font-display font-bold text-xs uppercase tracking-wider text-neutral-400 p-5 pb-3">Most recent visitors</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[520px] text-xs">
                        <thead>
                          <tr className="bg-pine-900/80 text-neutral-500 text-[10px] uppercase tracking-widest font-display font-black">
                            <th className="p-3 text-left">Anonymous ID</th>
                            <th className="p-3 text-left">First visit</th>
                            <th className="p-3 text-left">Last visit</th>
                            <th className="p-3 text-right">Page views</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-pine-900/60">
                          {(analytics.recentVisitors || []).map((v: any) => (
                            <tr key={v.visitorId}>
                              <td className="p-3 font-mono text-gold-400/80">{String(v.visitorId).slice(0, 12)}…</td>
                              <td className="p-3 text-neutral-400 font-mono">{v.firstSeen}</td>
                              <td className="p-3 text-neutral-400 font-mono">{v.lastSeen}</td>
                              <td className="p-3 text-right text-neutral-300 font-bold">{v.pageViews}</td>
                            </tr>
                          ))}
                          {(!analytics.recentVisitors || analytics.recentVisitors.length === 0) && (
                            <tr><td colSpan={4} className="p-6 text-center text-neutral-500">No visitors yet.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-10 animate-fadeIn" id="admin_tab_settings">

              {/* ---- PAYMENT INSTRUCTIONS ---- */}
              <div className="space-y-4">
                <div>
                  <h3 className="font-serif font-black text-xl text-cream-100">Payment Instructions</h3>
                  <p className="text-xs text-neutral-400 mt-1">
                    Shown on every reservation ticket and emailed to guests. Fill in your real account numbers, upload a QR per method if you have one, and set the email address where guests send proof of payment.
                  </p>
                </div>

                <div className="bg-pine-950 p-6 rounded-2xl border border-pine-850 space-y-5 max-w-2xl text-left">
                  <div className="space-y-1.5">
                    <label className="text-[11px] uppercase font-bold tracking-widest text-neutral-400 font-display block">Headline</label>
                    <input
                      type="text"
                      value={payInstr.headline}
                      onChange={e => setPayInstr((p: any) => ({ ...p, headline: e.target.value }))}
                      className="w-full bg-pine-900 border border-pine-800 rounded-xl py-2.5 px-4 text-sm text-cream-100 focus:outline-none focus:border-gold-500"
                    />
                  </div>

                  <div className="space-y-3">
                    <label className="text-[11px] uppercase font-bold tracking-widest text-neutral-400 font-display block">Accounts</label>
                    {payInstr.accounts.map((acc: any, idx: number) => (
                      <div key={idx} className="bg-pine-900 border border-pine-800 rounded-xl p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase font-bold text-gold-400 font-display">Account {idx + 1}</span>
                          {payInstr.accounts.length > 1 && (
                            <button type="button" onClick={() => removePayAccount(idx)} className="text-rose-400 hover:text-rose-300 text-xs flex items-center gap-1">
                              <Trash2 className="w-3.5 h-3.5" /> Remove
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <input type="text" placeholder="Method (GCash, Maya, BDO...)" value={acc.method} onChange={e => updatePayAccount(idx, 'method', e.target.value)} className="bg-pine-950 border border-pine-800 rounded-lg py-2 px-3 text-xs text-cream-100 focus:outline-none focus:border-gold-500" />
                          <input type="text" placeholder="Account name" value={acc.accountName} onChange={e => updatePayAccount(idx, 'accountName', e.target.value)} className="bg-pine-950 border border-pine-800 rounded-lg py-2 px-3 text-xs text-cream-100 focus:outline-none focus:border-gold-500" />
                          <input type="text" placeholder="Account number" value={acc.accountNumber} onChange={e => updatePayAccount(idx, 'accountNumber', e.target.value)} className="bg-pine-950 border border-pine-800 rounded-lg py-2 px-3 text-xs text-cream-100 font-mono focus:outline-none focus:border-gold-500" />
                        </div>
                        <div className="flex items-center gap-3">
                          {acc.qrImageUrl ? (
                            <img src={acc.qrImageUrl} alt="QR" className="w-14 h-14 rounded-lg object-contain border border-pine-800 bg-white" />
                          ) : null}
                          <label className="text-[11px] text-gold-400 hover:text-gold-300 cursor-pointer border border-dashed border-pine-700 rounded-lg px-3 py-2">
                            {acc.qrImageUrl ? 'Replace QR image' : 'Upload QR image'}
                            <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(f, url => updatePayAccount(idx, 'qrImageUrl', url)); }} />
                          </label>
                          {acc.qrImageUrl && (
                            <button type="button" onClick={() => updatePayAccount(idx, 'qrImageUrl', '')} className="text-[11px] text-neutral-500 hover:text-neutral-300">Clear</button>
                          )}
                        </div>
                      </div>
                    ))}
                    <button type="button" onClick={addPayAccount} className="text-xs text-gold-400 hover:text-gold-300 flex items-center gap-1 font-display font-bold">
                      <Plus className="w-4 h-4" /> Add another account
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] uppercase font-bold tracking-widest text-neutral-400 font-display block">Proof-of-payment email (The Ledge receives this)</label>
                    <input
                      type="email"
                      value={payInstr.proofEmail}
                      onChange={e => setPayInstr((p: any) => ({ ...p, proofEmail: e.target.value }))}
                      placeholder="payments@theledge.example"
                      className="w-full bg-pine-900 border border-pine-800 rounded-xl py-2.5 px-4 text-sm text-cream-100 font-mono focus:outline-none focus:border-gold-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] uppercase font-bold tracking-widest text-neutral-400 font-display block">Note to the guest</label>
                    <textarea
                      rows={4}
                      value={payInstr.note}
                      onChange={e => setPayInstr((p: any) => ({ ...p, note: e.target.value }))}
                      className="w-full bg-pine-900 border border-pine-800 rounded-xl py-2.5 px-4 text-sm text-cream-100 focus:outline-none focus:border-gold-500 resize-none"
                    />
                  </div>

                  <button
                    onClick={savePaymentInstructions}
                    disabled={savingPayInstr}
                    className="py-2.5 px-5 rounded-xl bg-gold-500 hover:bg-gold-400 text-ink font-display font-black text-xs uppercase tracking-wider transition-all cursor-pointer inline-flex items-center gap-2 disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    <span>{savingPayInstr ? 'Saving...' : 'Publish Payment Instructions'}</span>
                  </button>
                </div>
              </div>

              {/* ---- RESERVATION HOLD WINDOW ---- */}
              <div className="space-y-4">
                <div>
                  <h3 className="font-serif font-black text-xl text-cream-100">Unpaid Reservation Hold</h3>
                  <p className="text-xs text-neutral-400 mt-1">
                    How long a reservation keeps its dates while waiting for payment. Once this passes, the booking is
                    cancelled automatically and the room goes back on sale. Checked every 15 minutes.
                  </p>
                </div>
                <div className="bg-pine-950 p-6 rounded-2xl border border-pine-850 space-y-4 max-w-md text-left">
                  <label className="text-[11px] uppercase font-bold tracking-widest text-neutral-400 font-display block">Hold window (hours)</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min={1}
                      max={720}
                      value={holdHours}
                      onChange={e => setHoldHours(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-32 bg-pine-900 border border-pine-800 rounded-xl py-2.5 px-4 text-sm text-cream-100 font-mono focus:outline-none focus:border-gold-500"
                    />
                    <span className="text-xs text-neutral-500">= {holdHours ? (Number(holdHours) / 24).toFixed(1) : '0'} days</span>
                  </div>
                  <p className="text-[11px] text-neutral-500">
                    Keep this in step with the wording on your payment instructions, which currently promises release after 48 hours.
                  </p>
                  <button
                    onClick={saveHoldWindow}
                    disabled={savingHold || !holdHours}
                    className="py-2.5 px-5 rounded-xl bg-gold-500 hover:bg-gold-400 text-ink font-display font-black text-xs uppercase tracking-wider transition-all cursor-pointer inline-flex items-center gap-2 disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    <span>{savingHold ? 'Saving...' : 'Save Hold Window'}</span>
                  </button>
                </div>
              </div>

              {/* ---- PASSWORD ---- */}
              <div>
                <h3 className="font-serif font-black text-xl text-cream-100">Admin Password Management</h3>
                <p className="text-xs text-neutral-400 mt-1">
                  Change the password required to open the The Ledge Admin Control Panel.
                </p>
              </div>

              <div className="bg-pine-950 p-6 rounded-2xl border border-pine-850 space-y-4 max-w-md text-left">
                <div className="space-y-1.5">
                  <label className="text-xs uppercase font-bold tracking-widest text-neutral-400 font-display block">New Password</label>
                  <input
                    type="password"
                    placeholder="Enter new admin password"
                    id="new_password_input"
                    className="w-full bg-pine-900 border border-pine-800 rounded-xl py-2.5 px-4 text-sm text-cream-100 focus:outline-none focus:border-gold-500 transition-all font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs uppercase font-bold tracking-widest text-neutral-400 font-display block">Confirm Password</label>
                  <input
                    type="password"
                    placeholder="Confirm new password"
                    id="confirm_password_input"
                    className="w-full bg-pine-900 border border-pine-800 rounded-xl py-2.5 px-4 text-sm text-cream-100 focus:outline-none focus:border-gold-500 transition-all font-mono"
                  />
                </div>
                <button
                  onClick={() => {
                    const newPass = (document.getElementById('new_password_input') as HTMLInputElement)?.value;
                    const confirmPass = (document.getElementById('confirm_password_input') as HTMLInputElement)?.value;
                    if (!newPass) {
                      alert('Please enter a new password.');
                      return;
                    }
                    if (newPass !== confirmPass) {
                      alert('Passwords do not match.');
                      return;
                    }
                    fetch('/api/admin/change-password', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({ newPassword: newPass }),
                    })
                    .then(res => {
                      if (!res.ok) throw new Error('Failed to update password.');
                      return res.json();
                    })
                    .then(() => {
                      triggerToast('Password changed successfully!');
                      (document.getElementById('new_password_input') as HTMLInputElement).value = '';
                      (document.getElementById('confirm_password_input') as HTMLInputElement).value = '';
                    })
                    .catch(err => {
                      console.error(err);
                      alert('Failed to change password. Please check your connection.');
                    });
                  }}
                  className="py-2.5 px-5 rounded-xl bg-gold-500 hover:bg-gold-400 text-ink font-display font-black text-xs uppercase tracking-wider transition-all cursor-pointer inline-flex items-center gap-2 font-bold font-sans"
                >
                  <Save className="w-4 h-4 text-ink" />
                  <span>Update Password</span>
                </button>
              </div>
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
