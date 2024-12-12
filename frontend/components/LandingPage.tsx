'use client';

import { motion } from 'framer-motion';
import { RocketScene } from './RocketScene';
import { Button } from './ui/button';
import { ArrowRight, Globe2 } from 'lucide-react';
import { Navbar } from './Navbar';
import { Features } from './Features';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />
      
      {/* Hero Section */}
      <div className="relative h-screen">
        <div className="absolute inset-0 right-0 w-1/2 ml-auto">
          <RocketScene />
        </div>
        
        <div className="relative z-10 container mx-auto px-4 h-full flex items-center">
          <div className="max-w-xl pt-16">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.15 }}
              transition={{ duration: 1.5 }}
              className="absolute top-1/2 left-0 -translate-y-1/2 w-full h-[200%] bg-gradient-to-r from-red-500/10 to-transparent -z-10"
            />
            
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="text-7xl font-bold mb-6 bg-gradient-to-r from-red-500 to-red-700 bg-clip-text text-transparent leading-tight"
            >
              Explore Maps Like Never Before
            </motion.h1>
            
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="text-xl text-gray-400 mb-8 leading-relaxed"
            >
              Experience advanced mapping solutions with powerful WMS integration 
              and interactive features for seamless geospatial visualization.
            </motion.p>
            
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="flex gap-4"
            >
              <Button 
                size="lg" 
                className="bg-red-600 hover:bg-red-700 text-white"
                onClick={() => {
                  window.location.href = '/maps';
                }}
              >
                Get Started <ArrowRight className="ml-2" />
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="border-red-600 text-red-600 hover:bg-red-600/10"
                onClick={() => {
                  window.location.href = '/maps';
                }}
              >
                <Globe2 className="mr-2" /> View Demo
              </Button>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <Features />
      
      {/* Call to Action */}
      <section className="py-24 bg-gradient-to-b from-black to-red-950/20">
        <div className="container mx-auto px-4 text-center">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-4xl font-bold mb-6 bg-gradient-to-r from-red-500 to-red-700 bg-clip-text text-transparent"
          >
            Ready to Get Started?
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-xl text-gray-400 mb-8 max-w-2xl mx-auto"
          >
            Join thousands of users who are already experiencing the next generation of mapping technology.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <Button size="lg" className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => {
                window.location.href = '/maps';
              }}
            >
              Start Mapping Now <ArrowRight className="ml-2" />
            </Button>
          </motion.div>
        </div>
      </section>
    </div>
  );
}