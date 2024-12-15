'use client';

import { motion } from 'framer-motion';
import { RocketScene } from '@/components/RocketScene';
import { Button } from '@/components/ui/button';
import { ArrowRight, Globe2 } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Features } from '@/components/Features';
import { usePageTransition } from '@/hooks/usePageTransition';

export default function LandingPage() {
  const { handleNavigation } = usePageTransition();

  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden">
      <Navbar />

      {/* Hero Section */}
      <div className="relative min-h-screen">
        <div className="absolute inset-0 right-0 w-full lg:w-1/2 ml-auto">
          <RocketScene />
        </div>

        <div className="relative z-10 container mx-auto px-4 min-h-screen flex items-center">
          <div className="max-w-xl pt-16 lg:ml-20 mx-auto lg:mx-0">
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
              className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 bg-gradient-to-r from-red-500 to-red-700 bg-clip-text text-transparent leading-tight text-center lg:text-left"
            >
              Explore Maps Like Never Before
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="text-lg md:text-xl text-gray-400 mb-8 leading-relaxed text-center lg:text-left"
            >
              Experience advanced mapping solutions with powerful WMS integration
              and interactive features for seamless geospatial visualization.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start"
            >
              <Button
                size="lg"
                className="bg-red-600 hover:bg-red-700 text-white transform transition-transform hover:scale-105 active:scale-95"
                onClick={() => handleNavigation('/maps', true)}
              >
                Get Started <ArrowRight className="ml-2" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-red-600 text-red-600 hover:bg-red-600/10 transform transition-transform hover:scale-105 active:scale-95"
                onClick={() => handleNavigation('/maps')}
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
            className="text-3xl md:text-4xl font-bold mb-6 bg-gradient-to-r from-red-500 to-red-700 bg-clip-text text-transparent"
          >
            Ready to Get Started?
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-lg md:text-xl text-gray-400 mb-8 max-w-2xl mx-auto px-4"
          >
            Join thousands of users who are already experiencing the next generation of mapping technology.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <Button
              size="lg"
              className="bg-red-600 hover:bg-red-700 text-white transform transition-transform hover:scale-105 active:scale-95"
              onClick={() => handleNavigation('/maps', true)}
            >
              Start Mapping Now <ArrowRight className="ml-2" />
            </Button>
          </motion.div>
        </div>
      </section>
    </div>
  );
}