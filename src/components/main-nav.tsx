"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { LayoutDashboard, Settings, FolderKanban } from 'lucide-react';

const links = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/settings', label: 'Settings', icon: Settings },
];

const workspaces = [
    { name: 'Primary Workspace', href: '/dashboard' },
    { name: 'Side Projects', href: '/dashboard' },
]

export function MainNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col h-full">
      <div className="flex flex-col gap-1 p-2">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              pathname.startsWith(link.href)
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted/50'
            )}
          >
            <link.icon className="h-4 w-4" />
            <span>{link.label}</span>
          </Link>
        ))}
      </div>
      <div className="mt-4 p-2">
        <h3 className="px-3 text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider mb-2">Workspaces</h3>
         <div className="flex flex-col gap-1">
            {workspaces.map((workspace) => (
                 <Link
                    key={workspace.name}
                    href={workspace.href}
                    className={cn(
                        'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors text-muted-foreground hover:bg-muted/50'
                    )}
                >
                    <FolderKanban className="h-4 w-4" />
                    <span>{workspace.name}</span>
                </Link>
            ))}
         </div>
      </div>
    </nav>
  );
}
