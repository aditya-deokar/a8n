'use client';

import React from 'react';
import { motion } from 'framer-motion';

export default function Globe({ baseColor, markerColor, glowColor, dark }: any) {
  return (
    <div className="relative w-[300px] h-[300px] flex items-center justify-center">
      {/* Outer Glow */}
      <div 
        className="absolute inset-0 rounded-full blur-[60px] opacity-20"
        style={{ backgroundColor: `rgb(${glowColor?.join(',') || '244, 63, 94'})` }}
      />
      
      {/* Globe Sphere */}
      <motion.div
        animate={{ rotateY: 360 }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        className="relative w-48 h-48 rounded-full border border-white/10 shadow-2xl overflow-hidden bg-zinc-900/50 backdrop-blur-sm"
        style={{ 
          transformStyle: 'preserve-3d',
          perspective: '1000px'
        }}
      >
        {/* Grid Lines */}
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20" />
        <div className="absolute inset-0 bg-gradient-to-tr from-rose-500/10 to-transparent" />
        
        {/* Latitude Lines */}
        {[...Array(6)].map((_, i) => (
          <div 
            key={i}
            className="absolute w-full h-px bg-white/5"
            style={{ top: `${(i + 1) * 16.6}%` }}
          />
        ))}
        
        {/* Longitude Lines */}
        {[...Array(6)].map((_, i) => (
          <div 
            key={i}
            className="absolute h-full w-px bg-white/5"
            style={{ left: `${(i + 1) * 16.6}%` }}
          />
        ))}
      </motion.div>

      {/* Floating Rings */}
      <motion.div
        animate={{ rotate: 360, scale: [1, 1.1, 1] }}
        transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
        className="absolute w-64 h-64 rounded-full border border-rose-500/20"
      />
    </div>
  );
}
