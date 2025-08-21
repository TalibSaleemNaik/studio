import React from 'react';
import { UserNav } from '@/components/user-nav';
import { StreamlineLogo } from '@/components/icons';
import Link from 'next/link';

function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {

  return (
      <div className="flex min-h-screen w-full flex-col bg-background text-foreground">
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b bg-background/80 px-4 backdrop-blur-sm sm:px-6">
            <div className='flex items-center gap-4'>
                <Link href="/dashboard" className="flex items-center gap-2" prefetch={false}>
                  <StreamlineLogo className="h-6 w-6 text-primary" />
                  <h1 className="font-headline text-xl font-semibold">Streamline</h1>
                </Link>
            </div>
            <div className="ml-auto">
                <UserNav />
            </div>
        </header>
        <main className="flex-1 flex flex-col p-4 sm:p-6 md:p-8">
            {children}
        </main>
      </div>
  );
}

export default AppLayout;
