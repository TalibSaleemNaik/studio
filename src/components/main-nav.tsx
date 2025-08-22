
"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { LayoutDashboard, Settings, FolderKanban, ChevronsRightLeft } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';

const workpanels = [
    { id: 'default-workpanel', name: 'Primary Workpanel' },
    { id: 'side-projects', name: 'Side Projects' },
];

export function MainNav() {
  const pathname = usePathname();
  const pathSegments = pathname.split('/').filter(Boolean);
  
  const isWorkpanelRoute = pathSegments[0] === 'workpanels' && pathSegments[1];
  const currentWorkpanelId = isWorkpanelRoute ? pathSegments[1] : workpanels[0].id;

  const topLevelLinks = [
    { href: `/workpanels/${currentWorkpanelId}`, label: 'Dashboard', icon: LayoutDashboard },
    { href: `/workpanels/${currentWorkpanelId}/settings`, label: 'Settings', icon: Settings },
  ];


  return (
    <nav className="flex flex-col h-full p-2">
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

        <Accordion type="single" collapsible defaultValue="workpanels" className="w-full mt-4">
            <AccordionItem value="workpanels" className="border-none">
                <AccordionTrigger className="text-sm font-medium text-muted-foreground hover:no-underline hover:text-foreground px-3 py-2 [&[data-state=open]>svg]:rotate-90">
                    <div className='flex items-center gap-3'>
                        <ChevronsRightLeft className="h-4 w-4" />
                        <span>Workpanels</span>
                    </div>
                </AccordionTrigger>
                <AccordionContent className="pl-6 pt-1">
                    <div className="flex flex-col gap-1">
                    {workpanels.map((panel) => (
                        <Link
                            key={panel.id}
                            href={`/workpanels/${panel.id}`}
                            className={cn(
                            'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                            pathname.includes(`/workpanels/${panel.id}`)
                                ? 'bg-primary/10 text-primary'
                                : 'text-muted-foreground hover:bg-muted/50'
                            )}
                        >
                            <FolderKanban className="h-4 w-4" />
                            <span>{panel.name}</span>
                        </Link>
                    ))}
                    </div>
                </AccordionContent>
            </AccordionItem>
        </Accordion>
    </nav>
  );
}
