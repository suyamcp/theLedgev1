import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { HelpCircle, ChevronDown, BookOpen, Warehouse, HeartHandshake, ShieldAlert, Sparkles, Send, Loader2 } from 'lucide-react';
import { FAQ } from '../types';

interface FAQsSectionProps {
  faqs: FAQ[];
}

type ChatMsg = { role: 'user' | 'model'; text: string };

const SUGGESTED_QUESTIONS = [
  'How much is a night?',
  'How do I pay for my booking?',
  'What do you offer?',
  'Where are you located?',
];

function FaqAssistant() {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  const send = (text: string) => {
    const q = text.trim();
    if (!q || loading) return;
    setMessages(m => [...m, { role: 'user', text: q }]);
    setInput('');
    setLoading(true);

    fetch('/api/faq-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: q }),
    })
      .then(res => res.json())
      .then((data: any) => {
        setMessages(m => [...m, { role: 'model', text: data.reply || "Sorry, I couldn't answer that. Please contact us directly." }]);
      })
      .catch(() => {
        setMessages(m => [...m, { role: 'model', text: 'Something went wrong reaching the assistant. Please try again shortly.' }]);
      })
      .finally(() => setLoading(false));
  };

  return (
    <div className="mt-16 max-w-3xl mx-auto" id="faq_ai_assistant">
      <div className="bg-pine-950/50 border border-pine-800 rounded-3xl overflow-hidden shadow-2xl">
        <div className="p-5 border-b border-pine-800 flex items-center gap-3 bg-pine-950/60">
          <div className="w-9 h-9 rounded-xl bg-gold-500/15 border border-gold-500/30 flex items-center justify-center text-gold-400 shrink-0">
            <Sparkles className="w-4.5 h-4.5" />
          </div>
          <div>
            <h3 className="font-display font-bold text-sm text-cream-100">Ask The Ledge</h3>
            <p className="text-[11px] text-neutral-400">Instant answers about rates, rooms, activities, booking &amp; directions — straight from our latest info.</p>
          </div>
        </div>

        <div ref={scrollRef} className="max-h-[360px] overflow-y-auto p-5 space-y-4">
          {messages.length === 0 && (
            <div className="space-y-3">
              <p className="text-xs text-neutral-400">Try asking:</p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTED_QUESTIONS.map(s => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="text-[11px] py-1.5 px-3 rounded-full bg-pine-900 border border-pine-800 text-neutral-300 hover:border-gold-500/50 hover:text-gold-300 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-wrap ${
                m.role === 'user'
                  ? 'bg-gold-500 text-ink font-medium rounded-br-sm'
                  : 'bg-pine-900 border border-pine-800 text-neutral-200 rounded-bl-sm'
              }`}>
                {m.text}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-pine-900 border border-pine-800 text-neutral-400 rounded-2xl rounded-bl-sm px-3.5 py-2.5 text-xs flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Thinking…
              </div>
            </div>
          )}
        </div>

        <form
          onSubmit={e => { e.preventDefault(); send(input); }}
          className="p-4 border-t border-pine-800 flex gap-2 bg-pine-950/60"
        >
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Type your question…"
            maxLength={1000}
            className="flex-1 bg-pine-900 border border-pine-800 focus:border-gold-500 text-cream-50 px-4 py-2.5 rounded-xl text-xs outline-none transition-colors"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="py-2.5 px-4 rounded-xl bg-gold-500 hover:bg-gold-400 disabled:opacity-40 text-ink font-display font-bold text-xs transition-all flex items-center gap-1.5 shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
      <p className="text-[10px] text-neutral-600 text-center mt-3">
        Answers come from The Ledge's current site info. For bookings and confirmations, please use the reservation portal or contact us directly.
      </p>
    </div>
  );
}

export default function FAQsSection({ faqs }: FAQsSectionProps) {
  const [openId, setOpenId] = useState<string | null>(faqs.length > 0 ? faqs[0].id : null);
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const categories = [
    { id: 'all', name: 'All Queries', icon: <HelpCircle className="w-3.5 h-3.5" /> },
    { id: 'booking', name: 'Rates & Arrival', icon: <BookOpen className="w-3.5 h-3.5" /> },
    { id: 'stay', name: 'Weather & Gear', icon: <Warehouse className="w-3.5 h-3.5" /> },
    { id: 'amenities', name: 'Connectivity', icon: <HeartHandshake className="w-3.5 h-3.5" /> },
    { id: 'policies', name: 'Rules & Policies', icon: <ShieldAlert className="w-3.5 h-3.5" /> }
  ];

  const filteredFAQs = activeCategory === 'all' 
    ? faqs 
    : faqs.filter((faq: FAQ) => faq.category === activeCategory);

  const toggleFAQ = (id: string) => {
    if (openId === id) {
      setOpenId(null);
    } else {
      setOpenId(id);
    }
  };

  return (
    <section id="faqs" className="py-24 bg-pine-900 border-t border-pine-850 text-cream-50 scroll-mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Heading */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <span className="text-xs uppercase font-extrabold tracking-widest text-gold-400 font-display block">
            COMMON INQUIRIES
          </span>
          <h2 className="font-serif font-bold text-3xl sm:text-4xl text-cream-100">
            Frequently Asked Questions
          </h2>
          <p className="text-sm text-neutral-400 leading-relaxed">
            The things guests ask most often, answered properly. If yours is not here, the assistant above reads from our current site information.
          </p>
        </div>

        {/* Layout Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Categories Sidebar (Left 4-columns) */}
          <div className="lg:col-span-4 space-y-3 lg:sticky lg:top-28" id="faqs_sidebar_node">
            <h3 className="font-display font-semibold text-xs uppercase tracking-wider text-neutral-400 pl-3 text-left">
              Help Categories
            </h3>
            <div className="flex flex-row lg:flex-col gap-2 overflow-x-auto lg:overflow-visible pb-3 lg:pb-0 scrollbar-none" id="faqs_category_buttons">
              {categories.map((cat) => {
                const isActive = activeCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => { setActiveCategory(cat.id); setOpenId(null); }}
                    className={`py-3 px-4 rounded-xl font-display font-medium text-xs transition-all flex items-center gap-2.5 shrink-0 text-left w-auto lg:w-full ${
                      isActive
                        ? 'bg-gold-500 text-ink font-bold shadow-lg shadow-gold-500/10'
                        : 'bg-pine-950/40 border border-pine-850/60 hover:border-pine-700 text-neutral-300'
                    }`}
                  >
                    <span className={isActive ? 'text-ink' : 'text-gold-500'}>
                      {cat.icon}
                    </span>
                    <span>{cat.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Accordion list (Right 8-columns) */}
          <div className="lg:col-span-8 space-y-3" id="faqs_accordions_list">
            {faqs.length > 0 ? (
              <AnimatePresence mode="popLayout">
                {filteredFAQs.map((faq) => {
                  const isOpen = openId === faq.id;
                  return (
                    <motion.div
                      key={faq.id}
                      layout
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      className="bg-pine-950/40 border border-pine-850/60 rounded-2xl overflow-hidden transition-all duration-300"
                      id={`faq_accordion_${faq.id}`}
                    >
                      {/* Header trigger */}
                      <button
                        onClick={() => toggleFAQ(faq.id)}
                        className="w-full py-4.5 px-5 flex items-center justify-between text-left hover:bg-pine-950/80 transition-colors gap-3"
                        aria-expanded={isOpen}
                      >
                        <span className="font-display font-semibold text-xs sm:text-sm text-cream-100 pr-4">
                          {faq.question}
                        </span>
                        <ChevronDown className={`w-4 h-4 text-gold-400 transition-transform shrink-0 ${isOpen ? 'rotate-180 text-gold-500' : ''}`} />
                      </button>

                      {/* Expandable answer */}
                      {isOpen && (
                        <div className="border-t border-pine-850/50 bg-pine-950/20 p-5 text-left text-xs leading-relaxed text-neutral-300">
                          <p>{faq.answer}</p>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            ) : (
              <div className="py-12 border border-dashed border-pine-850 rounded-2xl text-center text-neutral-500 text-xs flex flex-col items-center justify-center p-6 space-y-2">
                <HelpCircle className="w-6 h-6 text-neutral-700 animate-pulse" />
                <span>No FAQ entries added by the administrator yet.</span>
                <span className="text-[10px] text-neutral-600">Populate standard FAQs instantly by seeding demo content inside the Admin Panel.</span>
              </div>
            )}

            {faqs.length > 0 && filteredFAQs.length === 0 && (
              <div className="py-12 border border-dashed border-pine-850 rounded-2xl text-center text-neutral-400 text-xs">
                No items found for the selected category.
              </div>
            )}
          </div>

        </div>

        {/* AI assistant */}
        <FaqAssistant />

      </div>
    </section>
  );
}
