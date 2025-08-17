
'use client';

import React, { useState } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { GripVertical, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

interface Task {
  id: string;
  content: string;
}

interface Column {
  name: string;
  items: Task[];
}

interface Columns {
  [key: string]: Column;
}

const initialColumns: Columns = {
  'todo': {
    name: 'To Do',
    items: [
      { id: 'task-1', content: 'Design landing page' },
      { id: 'task-2', content: 'Develop API endpoints' },
      { id: 'task-3', content: 'Create marketing materials' },
    ],
  },
  'in-progress': {
    name: 'In Progress',
    items: [
      { id: 'task-4', content: 'Implement user authentication' },
      { id: 'task-5', content: 'Build dashboard components' },
    ],
  },
  'done': {
    name: 'Done',
    items: [
      { id: 'task-6', content: 'Setup database schema' },
      { id: 'task-7', content: 'Configure CI/CD pipeline' },
    ],
  },
};

export default function BoardPage({ params }: { params: { boardId: string } }) {
  const [columns, setColumns] = useState<Columns>(initialColumns);

  const onDragEnd = (result: DropResult) => {
    const { source, destination } = result;

    if (!destination) {
      return;
    }

    if (source.droppableId === destination.droppableId && source.index === destination.index) {
      return;
    }

    const startColumn = columns[source.droppableId];
    const endColumn = columns[destination.droppableId];

    if (startColumn === endColumn) {
      // Moving within the same column
      const newItems = Array.from(startColumn.items);
      const [removed] = newItems.splice(source.index, 1);
      newItems.splice(destination.index, 0, removed);

      const newColumn = {
        ...startColumn,
        items: newItems,
      };

      setColumns({
        ...columns,
        [source.droppableId]: newColumn,
      });
    } else {
      // Moving to a different column
      const startItems = Array.from(startColumn.items);
      const [removed] = startItems.splice(source.index, 1);
      const newStartColumn = {
        ...startColumn,
        items: startItems,
      };

      const endItems = Array.from(endColumn.items);
      endItems.splice(destination.index, 0, removed);
      const newEndColumn = {
        ...endColumn,
        items: endItems,
      };

      setColumns({
        ...columns,
        [source.droppableId]: newStartColumn,
        [destination.droppableId]: newEndColumn,
      });
    }
  };


  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold font-headline">Website Redesign</h1>
        {/* Add board-level actions here, e.g., filter, sort, etc. */}
      </div>

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
    </div>
  );
}

function cn(...classes: string[]) {
    return classes.filter(Boolean).join(' ');
}
