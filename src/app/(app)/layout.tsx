import React from 'react';
import { UserNav } from '@/components/user-nav';
import { StreamlineLogo } from '@/components/icons';
import Link from 'next/link';
import { Sidebar, SidebarContent, SidebarHeader, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { MainNav } from '@/components/main-nav';

function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full flex-col bg-muted/40">
        <Sidebar>
          <SidebarHeader>
             <Link href="/dashboard" className="flex items-center gap-2" prefetch={false}>
                <StreamlineLogo className="h-6 w-6 text-primary" />
                <h1 className="font-headline text-xl font-semibold">Streamline</h1>
              </Link>
          </SidebarHeader>
          <SidebarContent>
            <MainNav />
          </SidebarContent>
        </Sidebar>
        <div className="flex flex-col sm:gap-4 sm:py-4 sm:pl-72">
           <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
             <SidebarTrigger />
             <div className="ml-auto flex items-center gap-2">
                <UserNav />
             </div>
           </header>
           <main className="grid flex-1 items-start gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
             {children}
           </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

export default AppLayout;
