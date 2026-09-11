import React from 'react';
import { Compass, Cloud, Wind, Sunrise, Quote, HelpCircle } from 'lucide-react';
import { AboutCMS } from '../lib/cmsState';

interface AboutSectionProps {
  data: AboutCMS;
}

export default function AboutSection({ data }: AboutSectionProps) {
  // Use properties or placeholder defaults
  const tagline = data.tagline || 'OUR MOUNTAIN STORY';
  const title = data.title || 'Add Custom Backstory Title';
  const desc1 = data.desc1 || 'This is a placeholder for your mountain story paragraph 1. To customize this text, log into the Admin Control Panel at the top of the page. You can configure any native copy, description, rates, or amenities without editing any code.';
  const desc2 = data.desc2 || 'This is a placeholder for your story paragraph 2. Describe your facilities, the surroundings, safety notes, how to get here, and general atmosphere.';
  
  const elevation = data.elevation || '5,140 FT ASL';
  const climate = data.climate || '14°C — 19°C';
  const latitude = data.latitude || '16.3792° N';
  const longitude = data.longitude || '120.5755° E';

  const highlights = [
    {
      icon: <Cloud className="w-5 h-5 text-gold-400" />,
      title: data.title ? '[Highlight 1]' : 'Dynamic highlight 1',
      description: data.title ? 'Wake up at 5,000 ft altitude to a heavy, majestic blanket of white ocean mist rolling across the valleys.' : 'Configure custom highlight title & details in the Admin dashboard.'
    },
    {
      icon: <Wind className="w-5 h-5 text-gold-400" />,
      title: data.title ? '[Highlight 2]' : 'Dynamic highlight 2',
      description: data.title ? '[Describe this highlight.]' : 'Configure custom highlight title & details in the Admin dashboard.'
    },
    {
      icon: <Compass className="w-5 h-5 text-gold-400" />,
      title: data.title ? 'Pristine Ridges' : 'Dynamic highlight 3',
      description: data.title ? '[Describe this highlight.]' : 'Configure custom highlight title & details in the Admin dashboard.'
    },
    {
      icon: <Sunrise className="w-5 h-5 text-gold-400" />,
      title: data.title ? '[Highlight 4]' : 'Dynamic highlight 4',
      description: data.title ? '[Describe this highlight.]' : 'Configure custom highlight title & details in the Admin dashboard.'
    }
  ];

  return (
    <section id="about" className="py-24 bg-pine-900 border-t border-pine-800 text-cream-50 scroll-mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* About Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Text Backstory (Left 7-columns) */}
          <div className="lg:col-span-7 space-y-6 text-left" id="about_intro_text">
            <span className="text-xs uppercase font-extrabold tracking-widest text-gold-400 font-display block">
              {tagline}
            </span>
            <h2 className="font-serif font-black text-3xl sm:text-4xl text-cream-100 leading-tight">
              {title}
            </h2>
            
            <p className="text-sm text-neutral-300 leading-relaxed">
              {desc1}
            </p>
            
            <p className="text-sm text-neutral-400 leading-relaxed">
              {desc2}
            </p>

            {/* Highlights Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4" id="about_features_grid">
              {highlights.map((feat, idx) => (
                <div key={idx} className="p-4 rounded-2xl bg-pine-950/40 border border-pine-850 flex gap-3 text-left">
                  <div className="p-2 bg-pine-900 rounded-xl border border-pine-800 shrink-0 h-fit">
                    {feat.icon}
                  </div>
                  <div>
                    <h4 className="font-display font-bold text-xs text-cream-100">{feat.title}</h4>
                    <p className="text-[11px] text-neutral-400 mt-1 leading-normal">{feat.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Graphical Bento Grid / Quote card (Right 5-columns) */}
          <div className="lg:col-span-5 space-y-6" id="about_visuals_panel">
            {/* Ambient coordinates plaque */}
            <div className="bg-pine-950 rounded-2xl p-6 border border-pine-850 text-left relative overflow-hidden group">
              <div className="absolute right-4 top-4 text-cream-50/10 font-mono font-black text-6xl select-none group-hover:scale-110 transition-transform">
                {latitude ? latitude.split(' ')[0] : '16.38°N'}
              </div>
              
              <div className="space-y-4 relative z-10">
                <span className="text-[9px] uppercase font-bold tracking-widest text-gold-400 py-1 px-2.5 rounded-full bg-gold-500/10 border border-gold-500/20 inline-block font-display">
                  LOCATION
                </span>
                <div>
                  <h3 className="font-display font-medium text-xs text-neutral-400 uppercase">LOCATION GEO-SLOT</h3>
                  <p className="font-mono font-bold text-base text-cream-100">{latitude}, {longitude}</p>
                </div>
                <div className="flex justify-between items-center bg-pine-900/60 p-3.5 rounded-xl border border-pine-850">
                  <span className="text-xs text-neutral-300">Elevation Height</span>
                  <span className="font-display font-extrabold text-xs text-gold-300">{elevation}</span>
                </div>
                <div className="flex justify-between items-center bg-pine-900/60 p-3.5 rounded-xl border border-pine-850">
                  <span className="text-xs text-neutral-300">Average Climate</span>
                  <span className="font-display font-extrabold text-xs text-gold-300">{climate}</span>
                </div>
              </div>
            </div>

            {/* Testimonial Quote */}
            {data.quoteText ? (
              <div className="bg-gold-500/5 border border-gold-500/10 rounded-2xl p-6 text-left space-y-4 relative" id="about_comment_quote">
                <Quote className="absolute right-6 top-6 w-12 h-12 text-gold-500/10 rotate-180" />
                <p className="text-xs text-neutral-300 leading-relaxed italic relative z-10">
                  "{data.quoteText}"
                </p>
                <div className="flex items-center gap-3 relative z-10" id="quote_author">
                  <div className="w-8 h-8 rounded-full bg-gold-500 flex items-center justify-center font-display font-bold text-xs text-ink">
                    {data.quoteAuthor ? data.quoteAuthor.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : 'TL'}
                  </div>
                  <div>
                    <h4 className="text-xs font-display font-bold text-cream-100">{data.quoteAuthor}</h4>
                    <span className="text-[10px] text-neutral-500">{data.quoteMeta}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-pine-950/40 border border-dashed border-pine-850 rounded-2xl p-8 text-center text-neutral-500 text-xs flex flex-col items-center justify-center space-y-2">
                <Quote className="w-6 h-6 text-neutral-700" />
                <span>No customer testimonial added yet. Fill this in the Admin Panel to showcase positive reviews.</span>
              </div>
            )}

          </div>

        </div>

      </div>
    </section>
  );
}
