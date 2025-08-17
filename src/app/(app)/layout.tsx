"use client";

import React from 'react';
import { Sidebar, SidebarContent, SidebarHeader, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { UserNav } from '@/components/user-nav';
import { MainNav } from '@/components/main-nav';
import { StreamlineLogo } from '@/components/icons';
import Link from 'next/link';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <div className="min-h-screen w-full bg-background text-foreground flex">
        <Sidebar className="border-r">
          <SidebarHeader>
            <Link href="/dashboard" className="flex items-center gap-2" prefetch={false}>
              <StreamlineLogo className="w-6 h-6 text-primary" />
              <h1 className="font-headline text-xl font-semibold">Streamline</h1>
            </Link>
          </SidebarHeader>
          <SidebarContent>
            <MainNav />
          </SidebarContent>
        </Sidebar>
        <div className="flex flex-col flex-1">
          <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b bg-background/80 px-4 backdrop-blur-sm sm:px-6">
              <SidebarTrigger />
              <UserNav />
          </header>
          <main className="flex-1 p-4 sm:p-6 md:p-8 bg-muted/30">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
