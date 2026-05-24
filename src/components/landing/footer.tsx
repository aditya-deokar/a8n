'use client';

import { motion } from 'framer-motion';
import { geist } from '@/lib/fonts';
import { cn } from '@/lib/utils';
import { FileText, Code, Shield, ArrowRight, Zap, Globe, Share2 } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

const footerLinks = [
  { name: 'Docs', href: '/docs', icon: FileText },
  { name: 'GitHub', href: 'https://github.com', logo: '/logos/github.svg' },
  { name: 'API Reference', href: '/api', icon: Code },
  { name: 'Terms', href: '/terms', icon: Shield },
  { name: 'Privacy', href: '/privacy', icon: Shield },
];

export default function Footer() {
  return (
    <footer className="relative bg-black pt-24 overflow-hidden">
      {/* Final CTA Section */}
      <div className="container mx-auto px-4 mb-24">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="relative rounded-[40px] overflow-hidden border border-white/10 bg-zinc-950 p-12 md:p-24 text-center group"
        >
          {/* Background Image */}
          <div className="absolute inset-0 z-0 opacity-40 group-hover:opacity-60 transition-opacity duration-1000">
            <Image 
              src="/images/footer-bg.png" 
              alt="CTA Background" 
              fill 
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
          </div>

          <div className="relative z-10 max-w-3xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-medium mb-8 uppercase tracking-widest">
                <Zap className="w-3 h-3" /> Get Started Today
              </div>
              
              <h2 className={cn(
                "text-4xl md:text-7xl font-bold tracking-tighter text-white mb-8",
                geist.className
              )}>
                Ready to automate <br /> your world?
              </h2>
              
              <p className="text-zinc-400 text-lg md:text-xl mb-12 max-w-xl mx-auto leading-relaxed">
                Join 200k+ developers building the next generation of automation. 
                Visual, durable, and AI-native.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <button className="w-full sm:w-auto px-10 py-5 rounded-2xl bg-white text-black font-bold text-xl hover:bg-zinc-200 transition-all flex items-center justify-center gap-2 group/btn shadow-[0_20px_40px_-10px_rgba(255,255,255,0.2)]">
                  Start Building Now <ArrowRight className="w-6 h-6 transition-transform group-hover/btn:translate-x-1" />
                </button>
                <button className="w-full sm:w-auto px-10 py-5 rounded-2xl bg-zinc-900 text-white font-bold text-xl border border-white/10 hover:bg-zinc-800 transition-all">
                  View Demo
                </button>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>

      {/* Footer Links & Credits */}
      <div className="border-t border-white/5 bg-zinc-950/50 backdrop-blur-md pt-16 pb-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-12 mb-16">
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-rose-500 rounded-lg flex items-center justify-center font-bold text-white">N</div>
                <span className="text-2xl font-bold text-white tracking-tighter">a8n</span>
              </div>
              <p className="text-zinc-500 max-w-xs text-sm leading-relaxed">
                The open-source alternative for high-performance AI-native workflow orchestration.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:flex gap-x-12 gap-y-8">
              <div className="flex flex-col gap-4">
                <h4 className="text-white font-bold text-sm uppercase tracking-widest">Platform</h4>
                {footerLinks.slice(0, 3).map((link) => (
                  <Link key={link.name} href={link.href} className="text-zinc-500 hover:text-white transition-colors text-sm flex items-center gap-2">
                    {link.icon ? <link.icon className="w-4 h-4" /> : <Image src={link.logo!} alt={link.name} width={16} height={16} className="invert opacity-50" />} {link.name}
                  </Link>
                ))}
              </div>
              <div className="flex flex-col gap-4">
                <h4 className="text-white font-bold text-sm uppercase tracking-widest">Legal</h4>
                {footerLinks.slice(3).map((link) => (
                  <Link key={link.name} href={link.href} className="text-zinc-500 hover:text-white transition-colors text-sm">
                    {link.name}
                  </Link>
                ))}
              </div>
              <div className="flex flex-col gap-4">
                <h4 className="text-white font-bold text-sm uppercase tracking-widest">Social</h4>
                <div className="flex gap-4">
                  <Link href="#" className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center text-zinc-500 hover:text-white hover:border-white/30 transition-all">
                    <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                  </Link>
                  <Link href="#" className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center text-zinc-500 hover:text-white hover:border-white/30 transition-all">
                    <Image src="/logos/github.svg" alt="GitHub" width={20} height={20} className="invert opacity-50 group-hover:opacity-100 transition-opacity" />
                  </Link>
                  <Link href="#" className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center text-zinc-500 hover:text-white hover:border-white/30 transition-all">
                    <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
                  </Link>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-zinc-600 font-medium tracking-tight">
            <p>© 2026 a8n Inc. All rights reserved.</p>
            <div className="flex gap-6">
              <span>Built with Next.js & Tailwind</span>
              <span className="flex items-center gap-1">Status: <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Operational</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
