
'use client';

import React from 'react';
import { Draggable, Droppable } from '@hello-pangea/dnd';
import { MoreHorizontal, Plus, Edit, Trash2, Loader2, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { doc, updateDoc, writeBatch, collection, getDocs, query, where, addDoc, serverTimestamp } from 'firebase/firestore';
import { Task, Column, BoardMember, BoardRole } from './types';
import { TaskCard } from './task-card';
import { useAuth } from '@/hooks/use-auth';
import { logActivity, SimpleUser } from '@/lib/activity-logger';


function ColumnMenu({ column, workpanelId, boardId, userRole }: { column: Column, workpanelId: string, boardId: string, userRole: BoardRole }) {
    const { toast } = useToast();
    const { user } = useAuth();
    const [isRenameOpen, setIsRenameOpen] = React.useState(false);
    const [newName, setNewName] = React.useState(column.name);
    const [originalName, setOriginalName] = React.useState(column.name);
    const [isConfirmOpen, setIsConfirmOpen] = React.useState(false);
    const [isDeleting, setIsDeleting] = React.useState(false);
    
    const canEdit = userRole === 'manager';

    const handleRename = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canEdit || !newName.trim() || newName === column.name || !user) {
            setIsRenameOpen(false);
            return;
        }
        try {
            await updateDoc(doc(db, `workspaces/${workpanelId}/boards/${boardId}/groups`, column.id), { name: newName });
             if (user) {
                const simpleUser: SimpleUser = {
                    uid: user.uid,
                    displayName: user.displayName,
                    photoURL: user.photoURL,
                };
                await logActivity(workpanelId, boardId, simpleUser, `renamed list to "${newName}" (from "${originalName}")`);
            }
            toast({ title: "List renamed" });
            setOriginalName(newName);
            setIsRenameOpen(false);
        } catch (error) {
            toast({ variant: 'destructive', title: 'Failed to rename list' });
        }
    }

    const handleDelete = async () => {
        if (!canEdit || !user) return;
        setIsDeleting(true);
        const batch = writeBatch(db);
        
        // Delete the group itself
        batch.delete(doc(db, `workspaces/${workpanelId}/boards/${boardId}/groups`, column.id));

        // Delete all tasks within that group
        const tasksQuery = query(collection(db, `workspaces/${workpanelId}/boards/${boardId}/tasks`), where('groupId', '==', column.id));
        
        try {
            const tasksSnapshot = await getDocs(tasksQuery);
            tasksSnapshot.forEach(taskDoc => {
                batch.delete(taskDoc.ref);
            });
            await batch.commit();

            if (user) {
                const simpleUser: SimpleUser = {
                    uid: user.uid,
                    displayName: user.displayName,
                    photoURL: user.photoURL,
                };
                await logActivity(workpanelId, boardId, simpleUser, `deleted list "${column.name}"`);
            }
            toast({ title: "List deleted" });
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Failed to delete list' });
        } finally {
            setIsDeleting(false);
            setIsConfirmOpen(false);
        }
    }

    if (!canEdit) {
        return null;
    }

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-white/80 hover:text-white hover:bg-white/20">
                        <MoreHorizontal className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    <DropdownMenuItem onSelect={() => setIsRenameOpen(true)}>
                        <Edit className="mr-2 h-4 w-4" /> Rename
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive" onSelect={() => setIsConfirmOpen(true)}>
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <Dialog open={isRenameOpen} onOpenChange={setIsRenameOpen}>
                <DialogContent>
                    <form onSubmit={handleRename}>
                        <DialogHeader>
                            <DialogTitle>Rename List</DialogTitle>
                        </DialogHeader>
                        <Input value={newName} onChange={(e) => setNewName(e.target.value)} className="my-4" />
                        <DialogFooter>
                            <Button type="button" variant="secondary" onClick={() => setIsRenameOpen(false)}>Cancel</Button>
                            <Button type="submit">Save</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

             <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
                <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                             <AlertDialogDescription>
                               This will delete the list "{column.name}" and all of its tasks. This action cannot be undone.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDelete} disabled={isDeleting}>
                                {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Delete
                            </AlertDialogAction>
                        </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}

function QuickAdd({ column, workpanelId, boardId, userRole }: { column: Column, workpanelId: string, boardId: string, userRole: BoardRole }) {
    const [content, setContent] = React.useState('');
    const { toast } = useToast();
    const { user } = useAuth();
    
    if (userRole === 'viewer' || userRole === 'guest') {
        return null;
    }

    const handleCreateTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!content.trim() || !user) {
            return;
        }
        
        try {
            const taskRef = await addDoc(collection(db, `workspaces/${workpanelId}/boards/${boardId}/tasks`), {
                groupId: column.id,
                content: content,
                order: column.items.length,
                createdAt: serverTimestamp(),
                // If editor creates a task, assign it to them by default
                assignees: userRole === 'editor' ? [user.uid] : [],
            });

            if(user) {
                const simpleUser: SimpleUser = {
                    uid: user.uid,
                    displayName: user.displayName,
                    photoURL: user.photoURL,
                };
                await logActivity(workpanelId, boardId, simpleUser, `created task "${content}"`, taskRef.id);
            }
            setContent('');
        } catch (error: any) {
            toast({ variant: "destructive", title: "Failed to create task", description: error.message });
        } 
    };

    return (
        <form onSubmit={handleCreateTask}>
            <div className="relative mt-2">
                <Input 
                    value={content} 
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Quick add..."
                    className="bg-background/50 pr-8"
                />
                 <Button type="submit" size="icon" variant="ghost" className="absolute right-0 top-0 h-full w-10 text-muted-foreground">
                    <Plus className="h-4 w-4" />
                </Button>
            </div>
        </form>
    )
}

const columnColors = [
    'bg-sky-500',
    'bg-amber-500',
    'bg-emerald-500',
    'bg-rose-500',
    'bg-indigo-500',
];

export function BoardColumn({ column, index, boardMembers, onTaskClick, workpanelId, boardId, userRole, cardRotation }: { column: Column; index: number; boardMembers: BoardMember[]; onTaskClick: (task: Task) => void; workpanelId: string; boardId: string; userRole: BoardRole; cardRotation: number; }) {
    const color = columnColors[index % columnColors.length];
    const { user } = useAuth();
    
    // A manager can drop any task anywhere.
    // An editor or guest can also drop anywhere, but the individual task cards will control if they can be picked up.
    const isDroppable = userRole === 'manager' || userRole === 'editor' || userRole === 'guest';
    
    return (
        <Draggable draggableId={column.id} index={index} isDragDisabled={userRole !== 'manager'}>
            {(provided) => (
                <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    className="shrink-0 w-80 flex flex-col rounded-lg overflow-hidden"
                >
                    <div
                        {...provided.dragHandleProps}
                        className={cn("flex justify-between items-center p-3", color)}
                    >
                        <div className='flex items-center gap-2'>
                            <h2 className="text-md font-semibold text-white">{column.name}</h2>
                            <span className="text-sm font-medium bg-white/20 text-white px-2 py-0.5 rounded-md">{column.items.length}</span>
                        </div>
                        <ColumnMenu column={column} workpanelId={workpanelId} boardId={boardId} userRole={userRole} />
                    </div>
                    <div
                        className="flex flex-col h-full"
                        style={{ backgroundColor: '#373955' }}
                    >
                        <div className="flex-1 flex flex-col min-h-0 p-3">
                            <Droppable droppableId={column.id} type="TASK" isDropDisabled={!isDroppable}>
                                {(provided, snapshot) => (
                                    <div
                                        ref={provided.innerRef}
                                        {...provided.droppableProps}
                                        className={cn(
                                            'flex-1 space-y-3 overflow-y-auto transition-colors rounded-lg min-h-[150px] p-2',
                                            snapshot.isDraggingOver && "bg-primary/10"
                                        )}
                                    >
                                        {column.items.map((item, index) => {
                                            const isAssigned = item.assignees?.includes(user!.uid);
                                            const isDraggable = userRole === 'manager' || (userRole === 'editor' && isAssigned) || (userRole === 'guest' && isAssigned);
                                            return (
                                                <TaskCard
                                                    key={item.id}
                                                    task={item}
                                                    index={index}
                                                    boardMembers={boardMembers}
                                                    onClick={() => onTaskClick(item)}
                                                    isDraggable={isDraggable}
                                                    rotation={cardRotation}
                                                />
                                            );
                                        })}
                                        {provided.placeholder}
                                        <QuickAdd column={column} workpanelId={workpanelId} boardId={boardId} userRole={userRole} />
                                    </div>
                                )}
                            </Droppable>
                        </div>
                    </div>
                </div>
            )}
        </Draggable>
    );
}
