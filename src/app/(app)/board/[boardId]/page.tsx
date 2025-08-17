import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { GripVertical } from 'lucide-react';

const columns = {
  'todo': {
    name: 'To Do',
    items: [
      { id: 'task-1', content: 'Design landing page' },
      { id: 'task-2', content: 'Develop API endpoints' },
    ],
  },
  'in-progress': {
    name: 'In Progress',
    items: [
      { id: 'task-3', content: 'Implement user authentication' },
    ],
  },
  'done': {
    name: 'Done',
    items: [
      { id: 'task-4', content: 'Setup database schema' },
    ],
  },
};

export default function BoardPage({ params }: { params: { boardId: string } }) {
  // A real app would fetch board data based on params.boardId
  // For now, we'll just display a static board.

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold font-headline">Website Redesign</h1>
      </div>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
        {Object.entries(columns).map(([columnId, column]) => (
          <div key={columnId} className="bg-muted/50 rounded-lg p-4 h-full">
            <h2 className="text-lg font-semibold mb-4 text-foreground/80">{column.name}</h2>
            <div className="space-y-4">
              {column.items.map((item, index) => (
                <div key={item.id} className="bg-card p-4 rounded-md shadow-sm border flex items-start gap-3">
                   <GripVertical className="h-5 w-5 text-muted-foreground mt-1 cursor-grab" />
                  <div className="flex-1">
                    <p className="font-medium">{item.content}</p>
                    <p className="text-sm text-muted-foreground">Task description snippet...</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
