
"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { LayoutDashboard, Settings, ChevronsRightLeft } from 'lucide-react';
import { WorkpanelSwitcher } from './workpanel/workpanel-switcher';
import { useAuth } from '@/hooks/use-auth';
import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export function MainNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const pathSegments = pathname.split('/').filter(Boolean);
  
  const isWorkpanelRoute = pathSegments[0] === 'workpanels' && pathSegments[1];
  const currentWorkpanelId = isWorkpanelRoute ? pathSegments[1] : 'default-workpanel';
  
  const [currentWorkpanelName, setCurrentWorkpanelName] = useState('Primary Workpanel');

  useEffect(() => {
    async function fetchWorkpanelName() {
      if (user && currentWorkpanelId) {
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


  return (
    <nav className="flex flex-col h-full p-2">
        <WorkpanelSwitcher currentWorkpanelId={currentWorkpanelId} currentWorkpanelName={currentWorkpanelName} />
        
        <div className="mt-4 space-y-1">
          {topLevelLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                (pathname === link.href || (link.label === 'Dashboard' && pathname.startsWith('/workpanels') && !pathname.includes('settings')))
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted/50'
              )}
            >
              <link.icon className="h-4 w-4" />
              <span>{link.label}</span>
            </Link>
          ))}
        </div>
    </nav>
  );
}
