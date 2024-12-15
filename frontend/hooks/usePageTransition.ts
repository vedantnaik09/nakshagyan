'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import NProgress from 'nprogress';

// Custom hook to handle page transitions with progress bar
export const usePageTransition = () => {
  const router = useRouter();

  const handleNavigation = useCallback((path: string, withAnimation = false) => {
    NProgress.start();
    
    if (withAnimation) {
      // Let the loading component handle animation, otherwise just navigate
      router.push(path);
    } else {
      router.push(path);
    }
  }, [router]);

  return { handleNavigation };
};
