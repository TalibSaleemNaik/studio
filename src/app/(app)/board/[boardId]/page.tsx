
'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { GripVertical, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { db } from '@/lib/firebase';
import { collection, doc, getDocs, onSnapshot, orderBy, query, updateDoc, where } from 'firebase/firestore';
import { useAuth } from '@/hooks/use-auth';

interface Task {
  id: string;
  content: string;
  order: number;
}

interface Column {
  id: string;
  name: string;
  items: Task[];
}

interface Columns {
  [key: string]: Column;
}

function Board({ params }: { params: { boardId: string } }) {
  const { user } = useAuth();
  const [columns, setColumns] = useState<Columns>({});
  const [loading, setLoading] = useState(true);

  // Hardcoded workspaceId for now. This should come from user context or props.
  const workspaceId = 'default-workspace';

  useEffect(() => {
    if (!user || !params.boardId) return;

    const groupsQuery = query(
      collection(db, `workspaces/${workspaceId}/groups`),
      where('boardId', '==', params.boardId),
      orderBy('order')
    );

    const unsubscribeGroups = onSnapshot(groupsQuery, async (querySnapshot) => {
      const groupsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as { name: string; order: number } }));
      
      const tasksQuery = query(
        collection(db, `workspaces/${workspaceId}/tasks`),
        where('boardId', '==', params.boardId)
      );

      const unsubscribeTasks = onSnapshot(tasksQuery, (tasksSnapshot) => {
        const tasksData = tasksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as { content: string; groupId: string; order: number } }));

        const newColumns: Columns = {};
        for (const group of groupsData) {
          newColumns[group.id] = {
            id: group.id,
            name: group.name,
            items: tasksData
              .filter(task => task.groupId === group.id)
              .sort((a, b) => a.order - b.order),
          };
        }

        setColumns(newColumns);
        setLoading(false);
      });

      return () => unsubscribeTasks();
    });

    return () => unsubscribeGroups();

  }, [user, params.boardId]);

  const onDragEnd = async (result: DropResult) => {
    const { source, destination } = result;

    if (!destination) return;
    
    const sourceColId = source.droppableId;
    const destColId = destination.droppableId;

    const startColumn = columns[sourceColId];
    const endColumn = columns[destColId];
    
    const sourceItems = [...startColumn.items];
    const [removed] = sourceItems.splice(source.index, 1);

    // Update local state immediately for better UX
    const newColumns = { ...columns };

    if (sourceColId === destColId) {
      // Moving within the same column
      sourceItems.splice(destination.index, 0, removed);
      newColumns[sourceColId] = {
        ...startColumn,
        items: sourceItems
      };
      setColumns(newColumns);
      
      // Update order in Firestore
      for (let i = 0; i < sourceItems.length; i++) {
        await updateDoc(doc(db, `workspaces/${workspaceId}/tasks`, sourceItems[i].id), { order: i });
      }

    } else {
      // Moving to a different column
      const destItems = [...endColumn.items];
      destItems.splice(destination.index, 0, removed);
      
      newColumns[sourceColId] = { ...startColumn, items: sourceItems };
      newColumns[destColId] = { ...endColumn, items: destItems };
      setColumns(newColumns);

      // Update groupId and order for the moved task
      await updateDoc(doc(db, `workspaces/${workspaceId}/tasks`, removed.id), {
        groupId: destColId,
        status: endColumn.name,
      });

      // Update order in source column
      for (let i = 0; i < sourceItems.length; i++) {
        await updateDoc(doc(db, `workspaces/${workspaceId}/tasks`, sourceItems[i].id), { order: i });
      }

      // Update order in destination column
       for (let i = 0; i < destItems.length; i++) {
        await updateDoc(doc(db, `workspaces/${workspaceId}/tasks`, destItems[i].id), { order: i });
      }
    }
  };

  if (loading) {
    return <BoardSkeleton />;
  }

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start h-full">
        {Object.entries(columns).map(([columnId, column]) => (
          <Droppable key={columnId} droppableId={columnId}>
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={cn(
                  "bg-muted/60 rounded-xl p-4 h-full flex flex-col transition-colors",
                  snapshot.isDraggingOver && "bg-primary/10"
                )}
              >
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-semibold text-foreground/90">{column.name}</h2>
                  <span className="text-sm font-medium bg-muted px-2 py-1 rounded-md">{column.items.length}</span>
                </div>
                <div className="space-y-4 flex-1 overflow-y-auto">
                  {column.items.map((item, index) => (
                    <Draggable key={item.id} draggableId={item.id} index={index}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          className={cn(
                            "bg-card p-4 rounded-lg shadow-sm border flex items-start gap-3 transition-shadow",
                            snapshot.isDragging && "shadow-lg"
                          )}
                          style={{
                            ...provided.draggableProps.style
                          }}
                        >
                          <GripVertical className="h-5 w-5 text-muted-foreground mt-1 cursor-grab" />
                          <div className="flex-1">
                            <p className="font-medium">{item.content}</p>
                          </div>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
                <Button variant="ghost" className="w-full mt-4 justify-start">
                  <Plus className="mr-2 h-4 w-4" /> Add Task
                </Button>
              </div>
            )}
          </Droppable>
        ))}
      </div>
    </DragDropContext>
  )
}

function BoardSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start h-full">
      {['To Do', 'In Progress', 'Done'].map((name) => (
        <div key={name} className="bg-muted/60 rounded-xl p-4 h-full flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-foreground/90">{name}</h2>
          </div>
          <div className="space-y-4 flex-1 overflow-y-auto">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        </div>
      ))}
    </div>
  )
}

const DynamicBoard = dynamic(() => Promise.resolve(Board), {
  ssr: false,
  loading: () => <BoardSkeleton />,
});

export default function BoardPage({ params }: { params: { boardId: string } }) {
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold font-headline">Website Redesign</h1>
      </div>
      <DynamicBoard params={params} />
    </div>
  );
}
