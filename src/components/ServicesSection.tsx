import React from 'react';
import { Coffee, Sun, Sparkles, ShieldCheck, Check, Image as ImageIcon } from 'lucide-react';
import { Service } from '../types';

interface ServicesSectionProps {
  services: Service[];
}

export default function ServicesSection({ services }: ServicesSectionProps) {
  const getIcon = (idx: number) => {
    switch (idx % 4) {
      case 0: return <Coffee className="w-5 h-5 text-gold-500" />;
      case 1: return <Sun className="w-5 h-5 text-gold-500" />;
      case 2: return <Sparkles className="w-5 h-5 text-gold-500" />;
      default: return <ShieldCheck className="w-5 h-5 text-gold-500" />;
    }
  };

  return (
    <section id="services" className="py-24 bg-pine-950 border-t border-pine-900/60 text-cream-50 scroll-mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Heading */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <span className="text-xs uppercase font-extrabold tracking-widest text-gold-400 font-display block">
            WHAT WE OFFER
          </span>
          <h2 className="font-serif font-bold text-3xl sm:text-4xl text-cream-100">
            Everything Else We Do
          </h2>
          <p className="text-sm text-neutral-400 leading-relaxed">
            Three things we put real effort into: feeding you well, giving you somewhere extraordinary to sit, and leaving you alone when that is what you came for.
          </p>
        </div>

        {/* Services Showcase Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8" id="services_cards_grid">
          {services.map((srv, idx) => {
            const hasContent = srv.name || srv.description || srv.image;
            
            return (
              <div
                key={srv.id}
                className="bg-pine-900/30 border border-pine-850 hover:border-gold-500/30 hover:bg-pine-900/60 rounded-3xl overflow-hidden transition-all flex flex-col justify-between group"
                id={`service_container_${srv.id}`}
              >
                <div>
                  {/* Responsive visual header image */}
                  <div className="aspect-video w-full overflow-hidden relative border-b border-pine-850">
                    {srv.image ? (
                      <img
                        src={srv.image}
                        alt={srv.name || 'Service Image'}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-full h-full border border-dashed border-pine-800 flex flex-col items-center justify-center bg-pine-950/40 text-neutral-500 text-xs gap-1.5 p-4">
                        <ImageIcon className="w-6 h-6 text-neutral-600 animate-pulse" />
                        <span className="font-display font-bold text-[10px] tracking-wider uppercase text-neutral-500">Service Image Placeholder</span>
                        <span className="text-[9px] text-neutral-600 font-medium">Upload via Admin UI</span>
                      </div>
                    )}
                    <div className="img-fade absolute inset-0 bg-gradient-to-t from-pine-950 via-pine-950/20 to-transparent" />
                    
                    {/* Floating price tag badge */}
                    {srv.price && (
                      <span className="absolute bottom-4 left-4 py-1 px-2.5 rounded-lg bg-pine-950/90 backdrop-blur border border-pine-800 text-[10px] font-bold text-gold-400 tracking-wide font-display">
                        {srv.price}
                      </span>
                    )}
                  </div>

                  {/* Body details */}
                  <div className="p-6 space-y-4 text-left">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 bg-pine-900 rounded-lg border border-pine-800 shrink-0">
                        {getIcon(idx)}
                      </span>
                      <h3 className="font-display font-bold text-sm text-cream-100 group-hover:text-gold-400 transition-colors">
                        {srv.name || `Service Plot #${idx + 1} Placeholder`}
                      </h3>
                    </div>

                    <p className="text-xs text-neutral-400 leading-relaxed min-h-[36px]">
                      {srv.description || 'This service has not been detailed by the admin yet. Log into the Admin Panel to write a description, configure rates, and list key feature sets.'}
                    </p>

                    {srv.details && srv.details.length > 0 ? (
                      <ul className="space-y-2 pt-2" id={`service_details_list_${srv.id}`}>
                        {srv.details.map((detail, dIdx) => (
                          <li key={dIdx} className="flex items-start gap-2 text-[11px] text-neutral-300">
                            <Check className="w-4 h-4 text-emerald-500 shrink-0 stroke-[2.5] mt-0.5" />
                            <span>{detail}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <ul className="space-y-2 pt-2 text-[11px] text-neutral-600">
                        <li className="flex items-start gap-2">
                          <Check className="w-4 h-4 text-neutral-700 shrink-0 stroke-[2.5] mt-0.5" />
                          <span>Detail bullet point placeholder A</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Check className="w-4 h-4 text-neutral-700 shrink-0 stroke-[2.5] mt-0.5" />
                          <span>Detail bullet point placeholder B</span>
                        </li>
                      </ul>
                    )}
                  </div>
                </div>

                {/* Styled anchor footer */}
                <div className="p-6 pt-0 border-t border-transparent" />
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
}
