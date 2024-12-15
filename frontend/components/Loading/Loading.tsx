import { motion } from 'framer-motion';
import { Satellite, Loader2, MapPin, Map, Binary } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function Loading() {
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    'Initializing satellite connection...',
    'Processing image data...',
    'Applying AI segmentation...',
    'Generating map overlays...',
    'Preparing visualization...'
  ];

  useEffect(() => {
    const progressInterval = setInterval(() => {
      setProgress((oldProgress) => {
        const increment = oldProgress < 90 ? 1 : 0.2; // Slow down progress near the end
        if (oldProgress >= 99) {
          clearInterval(progressInterval);
          return oldProgress;
        }
        return Math.min(oldProgress + increment, 99); // Never reach 100% until complete
      });
    }, 200);

    const stepInterval = setInterval(() => {
      setCurrentStep((oldStep) => {
        if (oldStep === steps.length - 1) {
          clearInterval(stepInterval);
          return oldStep;
        }
        return oldStep + 1;
      });
    }, 4000);

    return () => {
      clearInterval(progressInterval);
      clearInterval(stepInterval);
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="max-w-md w-full mx-4">
        <div className="relative">
          {/* Animated satellites */}
          <div className="absolute -top-20 left-0 right-0 flex justify-center">
            <motion.div
              animate={{
                rotate: [0, 360],
                y: [-10, 10, -10]
              }}
              transition={{
                rotate: { duration: 8, repeat: Infinity, ease: 'linear' },
                y: { duration: 2, repeat: Infinity, ease: 'easeInOut' }
              }}
              className="text-blue-400"
            >
              <Satellite size={48} className="transform -rotate-45" />
            </motion.div>
          </div>

          {/* Main content */}
          <div className="bg-slate-800 rounded-lg p-8 shadow-xl border border-slate-700">
            <div className="space-y-6">
              {/* Progress indicator */}
              <div className="flex items-center justify-center">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                >
                  <Loader2 size={32} className="text-blue-400" />
                </motion.div>
              </div>

              {/* Current step */}
              <div className="text-center">
                <motion.p
                  key={currentStep}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="text-lg font-medium text-slate-200"
                >
                  {steps[currentStep]}
                </motion.p>
              </div>

              {/* Progress bar */}
              <div className="relative pt-1">
                <div className="flex mb-2 items-center justify-between">
                  <div className="text-right">
                    <span className="text-sm font-semibold inline-block text-blue-400">
                      {progress.toFixed(0)}%
                    </span>
                  </div>
                </div>
                <div className="overflow-hidden h-2 text-xs flex rounded-full bg-slate-700">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.5 }}
                    className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-blue-400"
                  />
                </div>
              </div>

              {/* Processing indicators */}
              <div className="grid grid-cols-4 gap-4">
                {[
                  { icon: MapPin, label: 'Location' },
                  { icon: Map, label: 'Mapping' },
                  { icon: Binary, label: 'Processing' },
                  { icon: Satellite, label: 'Satellite' }
                ].map(({ icon: Icon, label }, index) => (
                  <motion.div
                    key={label}
                    animate={{
                      opacity: progress > index * 25 ? 1 : 0.3,
                      scale: progress > index * 25 ? 1 : 0.95
                    }}
                    className="flex flex-col items-center gap-2"
                  >
                    <Icon size={20} className="text-blue-400" />
                    <span className="text-xs text-slate-400">{label}</span>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}