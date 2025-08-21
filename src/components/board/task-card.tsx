
'use client';

import React from 'react';
import { Draggable } from '@hello-pangea/dnd';
import { Calendar, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { format } from 'date-fns';
import { Task, BoardMember } from './types';
import { Button } from '../ui/button';

const asJsDate = (d: any) => (d?.toDate ? d.toDate() : d);

const priorityColors = {
    low: 'bg-green-500/20 text-green-400 border-green-500/30',
    medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    urgent: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const tagColors = [
    'bg-purple-500/20 text-purple-400 border-purple-500/30',
    'bg-blue-500/20 text-blue-400 border-blue-500/30',
    'bg-pink-500/20 text-pink-400 border-pink-500/30',
    'bg-teal-500/20 text-teal-400 border-teal-500/30',
];


export function TaskCard({ task, index, boardMembers, onClick }: { task: Task; index: number; boardMembers: BoardMember[]; onClick: () => void; }) {
    
    const getAssignee = (uid: string) => boardMembers.find(m => m.uid === uid);

    return (
        <Draggable draggableId={task.id} index={index}>
            {(provided, snapshot) => (
                <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    onClick={onClick}
                    className={cn(
                        "bg-card p-3.5 rounded-lg border flex flex-col gap-3 transition-shadow cursor-pointer relative",
                        snapshot.isDragging && "shadow-lg"
                    )}
                    style={{
                        ...provided.draggableProps.style
                    }}
                >
                     <Button variant="ghost" size="icon" className="absolute top-2 right-2 h-6 w-6">
                        <MoreHorizontal className="h-4 w-4" />
                    </Button>
                    <p className="font-semibold pr-6">{task.content}</p>
                   
                    <div className="flex flex-wrap gap-2">
                        {task.tags?.map((tag, index) => (
                            <Badge key={tag} className={cn('text-xs border font-medium', tagColors[index % tagColors.length])}>#{tag}</Badge>
                        ))}
                    </div>

                    <div className="flex justify-between items-center text-muted-foreground mt-2">
                         <div className='flex items-center gap-4 text-xs font-medium'>
                            {task.dueDate && (
                                <div className='flex items-center gap-1.5'>
                                    <Calendar className='h-3.5 w-3.5' />
                                    <span>{format(asJsDate(task.dueDate), 'd/MM/yyyy')}</span>
                                </div>
                            )}
                             {task.assignees?.[0] && (
                                <div className='flex items-center gap-1.5'>
                                    <Avatar className="h-5 w-5 border-2 border-card">
                                        <AvatarImage src={getAssignee(task.assignees[0])?.photoURL} />
                                        <AvatarFallback>{getAssignee(task.assignees[0])?.displayName?.charAt(0) || '?'}</AvatarFallback>
                                    </Avatar>
                                    <span>{getAssignee(task.assignees[0])?.displayName}</span>
                                </div>
                            )}
                        </div>
                       {task.priority && (
                           <Badge variant="outline" className={cn("capitalize text-xs", priorityColors[task.priority])}>
                               {task.priority}
                            </Badge>
                       )}
                    </div>
                </div>
            )}
        </Draggable>
    );
}
