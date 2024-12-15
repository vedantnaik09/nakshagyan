'use client';

import { motion } from 'framer-motion';
import { Rocket } from 'lucide-react';

export default function Loading() {
    return (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex flex-col items-center justify-center z-50">
            <motion.div
                animate={{
                    rotate: 360,
                    y: [-10, 10, -10]
                }}
                transition={{
                    rotate: { duration: 2, repeat: Infinity, ease: "linear" },
                    y: { duration: 2, repeat: Infinity, ease: "easeInOut" }
                }}
                className="text-red-500 mb-4"
            >
                <Rocket size={48} />
            </motion.div>
            <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="text-white/80 text-lg"
            >
                Preparing your mapping experience...
            </motion.p>
        </div>
    );
}