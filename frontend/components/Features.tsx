'use client';

import { motion } from 'framer-motion';
import { Map, Layers, Download, Maximize } from 'lucide-react';

const features = [
  {
    icon: <Map className="h-8 w-8" />,
    title: 'Advanced Mapping',
    description: 'Powerful WMS integration for seamless geospatial visualization',
  },
  {
    icon: <Layers className="h-8 w-8" />,
    title: 'Multiple Layers',
    description: 'Support for various map layers and satellite imagery',
  },
  {
    icon: <Download className="h-8 w-8" />,
    title: 'Easy Export',
    description: 'Download high-resolution map tiles with a single click',
  },
  {
    icon: <Maximize className="h-8 w-8" />,
    title: 'Area Selection',
    description: 'Precise rectangular area selection tool',
  },
];

export function Features() {
  return (
    <section className="py-24 bg-black">
      <div className="container mx-auto px-4">
        <motion.h2 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-3xl font-bold text-center mb-12 bg-gradient-to-r from-red-500 to-red-700 bg-clip-text text-transparent"
        >
          Powerful Features
        </motion.h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              className="p-6 rounded-lg bg-red-950/20 border border-red-900/20"
            >
              <div className="text-red-500 mb-4">{feature.icon}</div>
              <h3 className="text-xl font-semibold text-white mb-2">{feature.title}</h3>
              <p className="text-gray-400">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}