'use client';

import { motion } from 'framer-motion';
import { Rocket } from 'lucide-react';

export function RocketAnimation() {
  return (
    <motion.div
      initial={{ x: 0, y: 0, rotate: 45 }}
      animate={{ 
        x: window.innerWidth,
        y: -200,
        transition: { duration: 1.5, ease: "easeOut" }
      }}
      className="fixed z-50 text-red-500"
    >
      <Rocket size={48} />
    </motion.div>
  );
}