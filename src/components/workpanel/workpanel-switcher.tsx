
'use client';

import React, { useState, useEffect } from 'react';
import { ChevronsUpDown, PlusCircle, Check, FolderKanban, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '@/components/ui/command';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, addDoc, doc, setDoc, updateDoc, arrayUnion, getDoc } from 'firebase/firestore';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { UserProfile } from '../board/types';

interface Workpanel {
    id: string;
    name: string;
}

function CreateWorkpanelDialog({ onClose }: { onClose: () => void }) {
    const [name, setName] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const { toast } = useToast();
    const { user } = useAuth();
    const router = useRouter();

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || !user) {
            toast({ variant: 'destructive', title: 'Workpanel name is required.' });
            return;
        }

        setIsCreating(true);
        try {
            // Create the workpanel document
            const workpanelRef = doc(collection(db, 'workspaces'));
            await setDoc(workpanelRef, {
                name: name,
                ownerId: user.uid,
                members: {
                    [user.uid]: 'owner'
                }
            });
            
            // Add the new workpanel to the user's accessible list
            const userRef = doc(db, 'users', user.uid);
            await updateDoc(userRef, {
                accessibleWorkpanels: arrayUnion(workpanelRef.id)
            });

            // Create a default board in the new workpanel
            const boardRef = doc(collection(db, `workspaces/${workpanelRef.id}/boards`));
            await setDoc(boardRef, {
                 name: 'My First Board',
                 description: 'This is your first board in your new workpanel!',
                 ownerId: user.uid,
                 members: {
                     [user.uid]: 'manager'
                 },
                 memberUids: [user.uid],
                 isPrivate: false,
                 workpanelId: workpanelRef.id
            });

            toast({ title: 'Workpanel created!', description: `"${name}" is ready.` });
            onClose();
            router.push(`/workpanels/${workpanelRef.id}`);

        } catch (error) {
            console.error("Failed to create workpanel:", error);
            toast({ variant: 'destructive', title: 'Failed to create workpanel' });
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <DialogContent>
            <form onSubmit={handleCreate}>
                <DialogHeader>
                    <DialogTitle>Create New Workpanel</DialogTitle>
                    <DialogDescription>
                        A workpanel is a collection of teamboards for you and your team.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="name" className="text-right">
                            Name
                        </Label>
                        <Input id="name" placeholder="e.g. Marketing Team" className="col-span-3" value={name} onChange={(e) => setName(e.target.value)} disabled={isCreating} />
                    </div>
                </div>
                <DialogFooter>
                    <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button type="submit" disabled={isCreating}>
                         {isCreating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...</> : 'Create'}
                    </Button>
                </DialogFooter>
            </form>
        </DialogContent>
    );
}

export function WorkpanelSwitcher({ currentWorkpanelId, currentWorkpanelName }: { currentWorkpanelId: string, currentWorkpanelName: string }) {
    const [open, setOpen] = useState(false);
    const [createOpen, setCreateOpen] = useState(false);
    const [workpanels, setWorkpanels] = useState<Workpanel[]>([]);
    const [loading, setLoading] = useState(true);
    const { user } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!user) return;

        setLoading(true);
        // Listen to the user's document for accessible workpanels
        const userDocRef = doc(db, 'users', user.uid);
        const unsubscribe = onSnapshot(userDocRef, async (userDocSnap) => {
            if (userDocSnap.exists()) {
                const userData = userDocSnap.data() as UserProfile;
                const accessibleIds = new Set(userData.accessibleWorkpanels || []);
                
                // Also include panels where user is a direct member, just in case
                const directMemberQuery = query(collection(db, 'workspaces'), where(`members.${user.uid}`, 'in', ['owner', 'admin', 'member', 'viewer']));
                const directMemberSnap = await getDocs(directMemberQuery);
                directMemberSnap.forEach(doc => accessibleIds.add(doc.id));

                if (accessibleIds.size > 0) {
                    const workpanelDocs = await Promise.all(
                        Array.from(accessibleIds).map(id => getDoc(doc(db, 'workspaces', id)))
                    );
                    const userWorkpanels = workpanelDocs
                        .filter(doc => doc.exists())
                        .map(doc => ({
                            id: doc.id,
                            name: doc.data()!.name
                        }));
                    setWorkpanels(userWorkpanels);
                } else {
                    setWorkpanels([]);
                }
            }
            setLoading(false);
        }, (error) => {
            console.error("Error fetching user's workpanels:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user]);

    const handleSelect = (workpanelId: string) => {
        setOpen(false);
        if (workpanelId !== currentWorkpanelId) {
            router.push(`/workpanels/${workpanelId}`);
        }
    };
    
    return (
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className="w-full justify-between h-12"
                    >
                        <div className="flex items-center gap-3">
                             <FolderKanban className="h-5 w-5" />
                             <span className="font-semibold">{currentWorkpanelName}</span>
                        </div>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[270px] p-0">
                    <Command>
                        <CommandInput placeholder="Search workpanels..." />
                        <CommandList>
                             {loading && <div className="p-4 text-center text-sm">Loading...</div>}
                             {!loading && workpanels.length === 0 && <CommandEmpty>No workpanels found.</CommandEmpty>}
                             {!loading && workpanels.length > 0 && (
                                <CommandGroup>
                                    {workpanels.map((panel) => (
                                        <CommandItem
                                            key={panel.id}
                                            value={panel.name}
                                            onSelect={() => handleSelect(panel.id)}
                                        >
                                            <Check
                                                className={cn(
                                                    "mr-2 h-4 w-4",
                                                    currentWorkpanelId === panel.id ? "opacity-100" : "opacity-0"
                                                )}
                                            />
                                            {panel.name}
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                             )}
                        </CommandList>
                        <CommandSeparator />
                         <CommandList>
                            <CommandGroup>
                                <DialogTrigger asChild>
                                    <CommandItem onSelect={() => setCreateOpen(true)}>
                                         <PlusCircle className="mr-2 h-4 w-4" />
                                         Create Workpanel
                                    </CommandItem>
                                </DialogTrigger>
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
            <CreateWorkpanelDialog onClose={() => setCreateOpen(false)} />
        </Dialog>
    );
}
