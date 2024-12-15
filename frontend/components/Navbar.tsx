'use client';

import { Button } from './ui/button';
import { LogIn, UserPlus } from 'lucide-react';

export function Navbar() {
  return (
    <nav className="fixed top-0 w-full z-50 bg-black/50 backdrop-blur-md border-b border-red-900/20">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between mt-4">
        {/* Logo Section */}
        <div className="flex items-center gap-2">
          <img src="/logo.jpg" alt="Logo" className="h-[80px]" />
          <div className="text-red-500 font-bold text-xl">NakshaGyaan</div>
        </div>
        
        <div className="flex gap-4">
          <Button variant="ghost" className="text-white hover:text-red-500">
            <LogIn className="mr-2 h-4 w-4" />
            Login
          </Button>
          <Button className="bg-red-600 hover:bg-red-700">
            <UserPlus className="mr-2 h-4 w-4" />
            Sign Up
          </Button>
        </div>
      </div>
    </nav>
  );
}
