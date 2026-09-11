import React, { useState } from 'react';
import { Menu, X, MapPin, Calendar, Compass, Lock } from 'lucide-react';
import ThemeToggle from './ThemeToggle';

interface NavigationProps {
  onBookNowClick: () => void;
  activeSection: string;
  onAdminClick?: () => void;
}

export default function Navigation({ onBookNowClick, activeSection, onAdminClick }: NavigationProps) {
  const [isOpen, setIsOpen] = useState(false);

  const navLinks = [
    { name: 'About', href: '#about' },
    { name: 'Rates', href: '#rates' },
    { name: 'Services', href: '#services' },
    { name: 'FAQs', href: '#faqs' },
  ];

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    setIsOpen(false);
    const targetElement = document.querySelector(href);
    if (targetElement) {
      targetElement.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <nav className="bg-pine-950/95 sticky top-0 z-50 border-b border-pine-900/60 backdrop-blur-md" id="header_navigation">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          
          {/* Logo Brand left */}
          <div className="flex items-center gap-3">
            <a href="#" className="flex items-center gap-2 group" id="brand_logo_link">
              <div className="w-12 h-12 rounded-full bg-paper-50 border-2 border-gold-500 overflow-hidden flex items-center justify-center p-1 relative shadow-inner">
                {/* Custom circular mountain logo vector in CSS/SVG */}
                <svg className="w-full h-full text-ink" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="50" cy="50" r="42" fill="#faf9f2" stroke="#062c15" strokeWidth="4"/>
                  {/* Pines */}
                  <path d="M22 68 L28 54 L34 68 Z" fill="#0c4220" stroke="none"/>
                  <path d="M66 68 L72 54 L78 68 Z" fill="#0c4220" stroke="none"/>
                  {/* Mountains */}
                  <path d="M26 73 L50 35 L74 73 Z" fill="none" stroke="#062c15" strokeWidth="7"/>
                  <path d="M40 73 L54 50 L68 73 Z" fill="none" stroke="#062c15" strokeWidth="5"/>
                  {/* Sun */}
                  <circle cx="50" cy="27" r="6" fill="#c9a054" stroke="none" />
                </svg>
              </div>
              <div className="flex flex-col text-left">
                <span className="font-display font-black text-cream-100 text-sm tracking-widest leading-none">THE LEDGE</span>
                <span className="font-display font-bold text-[9px] text-gold-400 tracking-wider">[TAGLINE]</span>
              </div>
            </a>
          </div>

          {/* Nav links center */}
          <div className="hidden md:flex items-center space-x-8" id="desktop_nav_links">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                onClick={(e) => handleLinkClick(e, link.href)}
                className={`font-display text-sm font-medium tracking-wide transition-colors ${
                  activeSection === link.href.slice(1)
                    ? 'text-gold-400'
                    : 'text-neutral-300 hover:text-gold-300'
                }`}
              >
                {link.name}
              </a>
            ))}
          </div>

          {/* Right Address & Book Shortcut */}
          <div className="hidden lg:flex items-center gap-6" id="desktop_right_header_data">
            <span className="text-[10px] uppercase font-bold tracking-widest text-gold-300/80 font-display flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-gold-500 animate-bounce" /> [Your address]
            </span>
            <ThemeToggle />
            {onAdminClick && (
              <button
                onClick={onAdminClick}
                className="p-2.5 rounded-full bg-pine-900 border border-pine-850 hover:border-gold-500 text-gold-400 hover:text-gold-300 transition-all cursor-pointer shadow-inner flex items-center justify-center group"
                title="Admin Control Panel"
              >
                <Lock className="w-3.5 h-3.5 text-gold-400 group-hover:scale-110 transition-transform" />
              </button>
            )}
            <button
              onClick={onBookNowClick}
              className="py-2.5 px-5 rounded-full bg-gold-500 hover:bg-gold-400 text-ink font-display font-semibold text-xs tracking-wider transition-all hover:scale-105 active:scale-95 shadow-lg shadow-gold-500/10 cursor-pointer"
              id="header_quick_book_btn"
            >
              Secure Spot
            </button>
          </div>

          {/* Mobile menu trigger */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="inline-flex items-center justify-center p-2 rounded-lg text-neutral-400 hover:text-cream-100 hover:bg-pine-900 focus:outline-none transition-colors"
              id="btn_hamburger_toggle"
              aria-expanded={isOpen}
            >
              {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer menu */}
      {isOpen && (
        <div className="md:hidden border-t border-pine-900/60 bg-pine-950 px-4 pt-2 pb-6 space-y-2 relative" id="mobile_drawer_node">
          {navLinks.map((link) => (
            <a
              key={link.name}
              href={link.href}
              onClick={(e) => handleLinkClick(e, link.href)}
              className="block px-3 py-3 rounded-lg text-base font-medium text-neutral-300 hover:text-gold-400 hover:bg-pine-900 transition-colors text-left"
            >
              {link.name}
            </a>
          ))}
          <div className="pt-4 border-t border-pine-900/60 space-y-4">
            <div className="flex items-center gap-2 pl-3 text-[10px] font-display uppercase tracking-wider text-neutral-400 text-left">
              <MapPin className="w-4 h-4 text-gold-500" /> [Your address]
            </div>
            <ThemeToggle variant="full" />
            {onAdminClick && (
              <button
                onClick={() => { setIsOpen(false); onAdminClick(); }}
                className="w-full py-3 px-4 rounded-xl bg-pine-900 border border-pine-850 text-gold-400 font-display font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5 text-gold-500" />
                <span>Admin Control Panel</span>
              </button>
            )}
            <button
              onClick={() => { setIsOpen(false); onBookNowClick(); }}
              className="w-full py-3.5 px-4 rounded-xl bg-gold-500 hover:bg-gold-400 text-ink font-display font-bold text-sm tracking-wide transition-colors"
            >
              Book Reservation Now
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
