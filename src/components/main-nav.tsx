
"use client";

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import { LayoutDashboard, Settings, ChevronsRightLeft } from 'lucide-react';
import { WorkpanelSwitcher } from './workpanel/workpanel-switcher';
import { useAuth } from '@/hooks/use-auth';
import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export function MainNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const pathSegments = pathname.split('/').filter(Boolean);
  
  const isWorkpanelRoute = pathSegments[0] === 'workpanels' && pathSegments[1];
  
  let currentWorkpanelId: string;
  if (isWorkpanelRoute) {
    currentWorkpanelId = pathSegments[1];
  } else if (pathSegments[0] === 'board' && searchParams.has('workpanelId')) {
    currentWorkpanelId = searchParams.get('workpanelId')!;
  } else {
    currentWorkpanelId = 'default-workpanel';
  }
  
  const [currentWorkpanelName, setCurrentWorkpanelName] = useState('Primary Workpanel');

  useEffect(() => {
    async function fetchWorkpanelName() {
      if (user && currentWorkpanelId) {
        // Handle case where a user might not have a default-workpanel yet.
        if (currentWorkpanelId === 'default-workpanel' && user) {
            setCurrentWorkpanelName('Primary Workpanel');
            return;
        }
        const workpanelRef = doc(db, 'workspaces', currentWorkpanelId);
        const docSnap = await getDoc(workpanelRef);
        if (docSnap.exists()) {
          setCurrentWorkpanelName(docSnap.data().name);
        }
      }
    }
    fetchWorkpanelName();
  }, [currentWorkpanelId, user]);


  const topLevelLinks = [
    { href: `/workpanels/${currentWorkpanelId}`, label: 'Dashboard', icon: LayoutDashboard },
    { href: `/workpanels/${currentWorkpanelId}/settings`, label: 'Settings', icon: Settings },
  ];

  const isSettingsPage = pathname.includes('/settings');
  const isDashboardPage = !isSettingsPage && (pathname.startsWith('/workpanels') || pathname.startsWith('/dashboard'));


  return (
    <nav className="flex flex-col h-full p-2">
        <WorkpanelSwitcher currentWorkpanelId={currentWorkpanelId} currentWorkpanelName={currentWorkpanelName} />
        
        <div className="mt-4 space-y-1">
          {topLevelLinks.map((link) => {
            const isActive = link.label === 'Settings' 
                ? isSettingsPage 
                : isDashboardPage;

            return (
                <Link
                  key={link.label}
                  href={link.href}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-muted/50'
                  )}
                >
                  <link.icon className="h-4 w-4" />
                  <span>{link.label}</span>
                </Link>
            )
           })}
        </div>
    </nav>
  );
}
