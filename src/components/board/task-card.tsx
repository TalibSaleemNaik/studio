
'use client';

import React from 'react';
import { Draggable } from '@hello-pangea/dnd';
import { Calendar, Flag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { format } from 'date-fns';
import { Task, BoardMember } from './types';

const asJsDate = (d: any) => (d?.toDate ? d.toDate() : d);

const priorityConfig = {
    low: { label: 'Low', icon: Flag, color: 'text-gray-500' },
    medium: { label: 'Medium', icon: Flag, color: 'text-yellow-500' },
    high: { label: 'High', icon: Flag, color: 'text-orange-500' },
    urgent: { label: 'Urgent', icon: Flag, color: 'text-red-500' },
};

export function TaskCard({ task, index, boardMembers, onClick }: { task: Task; index: number; boardMembers: BoardMember[]; onClick: () => void; }) {
    return (
        <Draggable draggableId={task.id} index={index}>
            {(provided, snapshot) => (
                <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    onClick={onClick}
                    className={cn(
                        "bg-card p-4 rounded-lg shadow-sm border flex flex-col gap-3 transition-shadow cursor-pointer",
                        snapshot.isDragging && "shadow-lg"
                    )}
                    style={{
                        ...provided.draggableProps.style
                    }}
                >
                    <p className="font-medium">{task.content}</p>
                    <div className="flex flex-wrap gap-1">
                        {task.tags?.map(tag => (
                            <Badge key={tag} variant="secondary" className='text-xs'>{tag}</Badge>
                        ))}
                    </div>
                    <div className='flex justify-between items-center text-muted-foreground'>
                        <div className='flex items-center gap-2'>
                            {task.dueDate && (
                                <div className='flex items-center gap-1 text-xs'>
                                    <Calendar className='h-3 w-3' />
                                    <span>{format(asJsDate(task.dueDate), 'MMM d')}</span>
                                </div>
                            )}
                            {task.priority && priorityConfig[task.priority] && (() => {
                                const { icon: Icon, color } = priorityConfig[task.priority];
                                return <Icon className={cn('h-4 w-4', color)} />;
                            })()}
                        </div>
                        <div className="flex -space-x-2 overflow-hidden">
                            {task.assignees?.map(uid => {
                                const member = boardMembers.find(m => m.uid === uid);
                                return (
                                    <Avatar key={uid} className="h-6 w-6 border-2 border-card">
                                        <AvatarImage src={member?.photoURL} />
                                        <AvatarFallback>{member?.displayName?.charAt(0) || '?'}</AvatarFallback>
                                    </Avatar>
                                )
                            })}
                        </div>
                    </div>
                </div>
            )}
        </Draggable>
    );
}
