'use client';

import { motion } from 'framer-motion';
import { geist } from '@/lib/fonts';
import { cn } from '@/lib/utils';
import { Check, Zap, Sparkles, Shield, CreditCard, ArrowRight, Star } from 'lucide-react';
import Image from 'next/image';

const tiers = [
  {
    name: 'Free',
    price: '$0',
    description: 'Perfect for exploring and building personal projects with essential automation.',
    features: [
      'Essential Nodes (HTTP, Webhooks)',
      'Basic Logic & Triggers',
      '7-day Execution History',
      'Community Support',
    ],
    buttonText: 'Start for Free',
    buttonVariant: 'outline',
    icon: Zap,
    color: 'text-zinc-400',
    bgColor: 'bg-zinc-400/10',
    borderColor: 'border-zinc-800',
  },
  {
    name: 'Pro',
    price: '$29',
    description: 'Unlock the full power of AI-native automation and production-grade reliability.',
    features: [
      'Advanced AI Nodes (GPT-4o, Claude 3.5)',
      'Unlimited Execution History',
      'Priority Premium Support',
      'High Execution Limits',
      'Model Context Protocol (MCP)',
      'Secure Credential Vault',
    ],
    buttonText: 'Go Pro Now',
    buttonVariant: 'primary',
    icon: Sparkles,
    color: 'text-rose-500',
    bgColor: 'bg-rose-500/10',
    borderColor: 'border-rose-500/50',
    popular: true,
  },
];

export default function Pricing() {
  return (
    <section id="pricing" className="py-24 sm:py-32 bg-black relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 z-0 opacity-40">
        <Image 
          src="/images/pricing-bg.png" 
          alt="Background Pattern" 
          fill 
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black via-transparent to-black" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="text-center mb-16 md:mb-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h2 className={cn(
              "text-4xl md:text-7xl font-bold tracking-tighter text-white mb-6",
              geist.className
            )}>
              Simple, Transparent <br className="hidden md:block" /> Scaling.
            </h2>
            <p className="text-zinc-500 text-lg md:text-xl max-w-2xl mx-auto">
              Choose the plan that fits your current needs and scale as your automation grows.
            </p>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {tiers.map((tier, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: idx * 0.1 }}
              className={cn(
                "relative flex flex-col p-8 md:p-12 rounded-[40px] border bg-zinc-950/50 backdrop-blur-2xl group overflow-hidden",
                tier.borderColor,
                tier.popular ? "shadow-[0_0_80px_-20px_rgba(244,63,94,0.15)]" : ""
              )}
            >
              {tier.popular && (
                <div className="absolute top-0 right-0 px-6 py-2 bg-rose-500 text-white text-[10px] font-bold uppercase tracking-widest rounded-bl-3xl">
                  Recommended
                </div>
              )}

              <div className="flex items-center gap-4 mb-8">
                <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 duration-500", tier.bgColor)}>
                  <tier.icon className={cn("w-7 h-7", tier.color)} />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white">{tier.name}</h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-white">{tier.price}</span>
                    <span className="text-zinc-500 text-sm">/ month</span>
                  </div>
                </div>
              </div>

              <p className="text-zinc-400 mb-8 leading-relaxed">
                {tier.description}
              </p>

              <div className="space-y-4 mb-10 flex-grow">
                {tier.features.map((feature, fIdx) => (
                  <div key={fIdx} className="flex items-center gap-3">
                    <div className={cn("flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center", tier.popular ? "bg-rose-500/20" : "bg-zinc-800")}>
                      <Check className={cn("w-3 h-3", tier.popular ? "text-rose-500" : "text-zinc-400")} />
                    </div>
                    <span className="text-zinc-300 text-sm">{feature}</span>
                  </div>
                ))}
              </div>

              <button className={cn(
                "w-full py-4 rounded-2xl font-bold text-lg transition-all duration-300 flex items-center justify-center gap-2 group/btn",
                tier.buttonVariant === 'primary' 
                  ? "bg-rose-500 text-white hover:bg-rose-600 shadow-[0_10px_20px_-10px_rgba(244,63,94,0.3)]" 
                  : "bg-white/5 text-white border border-white/10 hover:bg-white/10"
              )}>
                {tier.buttonText}
                <ArrowRight className="w-5 h-5 transition-transform group-hover/btn:translate-x-1" />
              </button>

              {tier.popular && (
                <div className="mt-6 flex items-center justify-center gap-2 text-[10px] font-bold text-zinc-600 uppercase tracking-widest">
                  <CreditCard className="w-3 h-3" />
                  Securely processed by <span className="text-zinc-400">Polar.sh</span>
                </div>
              )}
            </motion.div>
          ))}
        </div>

        <motion.div 
          className="mt-20 text-center"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <p className="text-zinc-500 text-sm">
            Need an enterprise plan with unlimited custom nodes? 
            <button className="ml-2 text-white font-semibold hover:underline">Contact Sales</button>
          </p>
        </motion.div>
      </div>
    </section>
  );
}
