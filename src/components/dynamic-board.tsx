
'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { DragDropContext, Droppable, DropResult } from '@hello-pangea/dnd';
import { Skeleton } from '@/components/ui/skeleton';
import { db } from '@/lib/firebase';
import { collection, doc, onSnapshot, orderBy, query, updateDoc, writeBatch, getDoc, collectionGroup, where, getDocs, limit, startAfter } from 'firebase/firestore';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { isAfter, isBefore, addDays, startOfToday } from 'date-fns';
import type { Task, Columns, BoardMember, Board as BoardType, TeamRoom as TeamRoomType, WorkpanelRole, BoardRole, UserProfile } from './board/types';
import { TaskDetailsDrawer } from './board/task-details-drawer';
import { CreateGroupDialog } from './board/create-group-dialog';
import { BoardColumn } from './board/board-column';
import { logActivity } from '@/lib/activity-logger';
import { ActivityDrawer } from './board/activity-drawer';
import { TableView } from './board/table-view';
import { BoardHeader } from './board/board-header';

function Board({ boardId, workpanelId }: { boardId: string, workpanelId: string }) {
  const { user } = useAuth();
  const [columns, setColumns] = React.useState<Columns | null>(null);
  const [board, setBoard] = React.useState<BoardType | null>(null);
  const [userRole, setUserRole] = React.useState<BoardRole | 'guest'>('guest');
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedTask, setSelectedTask] = React.useState<Task | null>(null);
  const [boardMembers, setBoardMembers] = React.useState<BoardMember[]>([]);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedAssignees, setSelectedAssignees] = React.useState<string[]>([]);
  const [selectedPriorities, setSelectedPriorities] = React.useState<string[]>([]);
  const [dueDateFilter, setDueDateFilter] = React.useState('any');
  const [isActivityDrawerOpen, setIsActivityDrawerOpen] = React.useState(false);
  const [activeView, setActiveView] = React.useState('kanban');
  const { toast } = useToast();

  const allTasks = React.useMemo(() => columns ? Object.values(columns).flatMap(c => c.items) : [], [columns]);

  const filteredTasks = React.useMemo(() => {
    const asJsDate = (d: any) => (d?.toDate ? d.toDate() : d);
    
    let tasksToFilter = allTasks;

    if (userRole === 'guest' && user) {
        tasksToFilter = tasksToFilter.filter(task => task.assignees?.includes(user.uid));
    }

    return tasksToFilter.filter(item => {
        const searchMatch = item.content.toLowerCase().includes(searchTerm.toLowerCase());
        
        const assigneeMatch = selectedAssignees.length === 0 || 
            item.assignees?.some(assignee => selectedAssignees.includes(assignee));

        const priorityMatch = selectedPriorities.length === 0 ||
            (item.priority && selectedPriorities.includes(item.priority));

        const dueDateMatch = () => {
            if (dueDateFilter === 'any' || !item.dueDate) return true;
            const today = startOfToday();
            const taskDueDate = asJsDate(item.dueDate);
            if (dueDateFilter === 'overdue') {
                return isBefore(taskDueDate, today);
            }
            if (dueDateFilter === 'due-soon') {
                const threeDaysFromNow = addDays(today, 3);
                return isAfter(taskDueDate, today) && isBefore(taskDueDate, threeDaysFromNow);
            }
            return true;
        };
        
        return searchMatch && assigneeMatch && priorityMatch && dueDateMatch();
    });
  }, [allTasks, searchTerm, selectedAssignees, selectedPriorities, dueDateFilter, userRole, user]);

  const filteredColumns = React.useMemo(() => {
      if (!columns) return {};
      const taskIdsToShow = new Set(filteredTasks.map(t => t.id));

      return Object.fromEntries(
        Object.entries(columns).map(([columnId, column]) => [
            columnId,
            {
                ...column,
                items: column.items.filter(item => taskIdsToShow.has(item.id))
            }
        ])
      );
  }, [columns, filteredTasks]);

    const calculateEffectiveRole = React.useCallback((
        uid: string,
        boardData: BoardType,
        teamRoomData: TeamRoomType | null,
        workpanelData: { members: { [key: string]: WorkpanelRole } } | null
    ): BoardRole | 'guest' => {
        
        if (boardData.members && boardData.members[uid]) {
            return boardData.members[uid];
        }

        if (teamRoomData?.members && teamRoomData.members[uid]) {
            const teamRoomRole = teamRoomData.members[uid];
            if (teamRoomRole === 'manager') return 'manager';
            if (teamRoomRole === 'editor') return 'editor';
            if (teamRoomRole === 'viewer') return 'viewer';
        }
        
        if (workpanelData?.members && workpanelData.members[uid]) {
            const workpanelRole = workpanelData.members[uid];
            if (workpanelRole === 'owner' || workpanelRole === 'admin') return 'manager';
            if (workpanelRole === 'member') return 'editor';
            if (workpanelRole === 'viewer') return 'viewer';
        }
        
        return 'guest';
    }, []);

  React.useEffect(() => {
    if (!user || !boardId || !workpanelId) {
        setLoading(true);
        if (!workpanelId) {
          setError("Workpanel ID is missing. Please access this board from the dashboard.");
          setLoading(false);
        }
        return;
    }

    const boardRef = doc(db, `workspaces/${workpanelId}/boards/${boardId}`);
    
    const unsubscribeBoard = onSnapshot(boardRef, async (boardSnap) => {
        if (!boardSnap.exists()) {
            setError("Board not found or you don't have access.");
            setLoading(false);
            return;
        }
        const boardData = { id: boardSnap.id, ...boardSnap.data() } as BoardType;
        setBoard(boardData);
        setError(null);
        
        const workpanelRef = doc(db, `workspaces/${workpanelId}`);
        const workpanelSnap = await getDoc(workpanelRef);
        const workpanelData = workpanelSnap.exists() ? workpanelSnap.data() as { members: { [key: string]: WorkpanelRole } } : null;

        let teamRoomData: TeamRoomType | null = null;
        if (boardData.teamRoomId) {
            const teamRoomRef = doc(db, `workspaces/${workpanelId}/teamRooms`, boardData.teamRoomId);
            const teamRoomSnap = await getDoc(teamRoomRef);
            teamRoomData = teamRoomSnap.exists() ? {id: teamRoomSnap.id, ...teamRoomSnap.data()} as TeamRoomType : null;
        }
        
        const effectiveRole = calculateEffectiveRole(user.uid, boardData, teamRoomData, workpanelData);
        
        if (effectiveRole === 'guest' && boardData.isPrivate) {
             const directMember = boardData.members?.[user.uid];
             if(!directMember) {
                setError("You do not have permission to view this private board.");
                setLoading(false);
                return;
             }
        }
        setUserRole(effectiveRole);


        // START: Comprehensive member fetching logic
        const memberUIDs = new Set<string>();
        Object.keys(boardData.members || {}).forEach(uid => memberUIDs.add(uid));
        Object.keys(teamRoomData?.members || {}).forEach(uid => memberUIDs.add(uid));
        Object.keys(workpanelData?.members || {}).forEach(uid => memberUIDs.add(uid));

        try {
            if (memberUIDs.size > 0) {
                 const uidsToFetch = Array.from(memberUIDs);
                 const userDocs = await Promise.all(uidsToFetch.map(uid => getDoc(doc(db, 'users', uid))));
                 const membersData: BoardMember[] = userDocs
                    .filter(docSnap => docSnap.exists())
                    .map(docSnap => {
                        const userData = docSnap.data() as UserProfile;
                        const uid = docSnap.id;
                        // We calculate the *effective* role for the board for each user to display
                        const role = calculateEffectiveRole(uid, boardData, teamRoomData, workpanelData);
                        return {
                            ...userData,
                            uid: uid,
                            role: role,
                        }
                    });
                setBoardMembers(membersData);
            } else {
                 setBoardMembers([]);
            }
        } catch (e) {
             console.error("Error fetching board members:", e);
             toast({ variant: 'destructive', title: 'Error loading board members' });
        }
        // END: Comprehensive member fetching logic

        const groupsQuery = query(collection(db, `workspaces/${workpanelId}/boards/${boardId}/groups`), orderBy('order'));
        const tasksQuery = query(collection(db, `workspaces/${workpanelId}/boards/${boardId}/tasks`));

        const unsubscribeGroups = onSnapshot(groupsQuery, (groupsSnapshot) => {
             const groupsData = groupsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as { name: string; order: number } }));
             
             const unsubscribeTasks = onSnapshot(tasksQuery, (tasksSnapshot) => {
                 const tasksData = tasksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as Omit<Task, 'id'> }));
                 
                 const newColumns: Columns = {};
                 for (const group of groupsData) {
                    newColumns[group.id] = {
                        id: group.id,
                        name: group.name,
                        order: group.order,
                        items: tasksData
                            .filter(task => task.groupId === group.id)
                            .sort((a, b) => a.order - b.order),
                    };
                 }
                 setColumns(newColumns);
                 setLoading(false);
             }, (taskError) => {
                 console.error("Error fetching tasks:", taskError);
                 setError("Failed to load tasks.");
                 setLoading(false);
             });
             
             return () => unsubscribeTasks();
        }, (groupError) => {
            console.error("Error fetching groups:", groupError);
            setError("Failed to load board columns.");
            setLoading(false);
        });

        return () => unsubscribeGroups();

    }, (boardError) => {
        console.error("Error fetching board:", boardError);
        setError("An error occurred while fetching board data.");
        if (boardError.code === 'permission-denied') {
            setError("You do not have permission to view this board.");
        }
        setLoading(false);
    });

    return () => {
        unsubscribeBoard();
    };
}, [user, boardId, workpanelId, toast, calculateEffectiveRole]);

  const onDragEnd = async (result: DropResult) => {
    const { source, destination, type, draggableId } = result;
    if (!destination || !columns || !user || !workpanelId) return;
    
    if (userRole === 'viewer') return;
    if (type === 'COLUMN' && userRole !== 'manager') {
        toast({ variant: "destructive", title: "Permission Denied", description: "Only managers can reorder columns." });
        return;
    }
    if (type === 'TASK') {
        const task = allTasks.find(t => t.id === draggableId);
        const isAssigned = task?.assignees?.includes(user.uid);

        if (userRole === 'editor' && !isAssigned) {
            toast({ variant: "destructive", title: "Permission Denied", description: "You can only move tasks assigned to you." });
            return;
        }
        if (userRole === 'guest' && !isAssigned) {
            toast({ variant: "destructive", title: "Permission Denied", description: "As a guest, you can only move your own tasks." });
            return;
        }
    }

    const newColumnsState = { ...columns };

    if (type === 'COLUMN') {
        const orderedColumns = Object.values(newColumnsState).sort((a,b) => a.order - b.order);
        const [movedColumn] = orderedColumns.splice(source.index, 1);
        orderedColumns.splice(destination.index, 0, movedColumn);

        orderedColumns.forEach((col, index) => {
            newColumnsState[col.id].order = index;
        });
        
        setColumns(newColumnsState);
        
        const batch = writeBatch(db);
        orderedColumns.forEach((col) => {
            batch.update(doc(db, `workspaces/${workpanelId}/boards/${boardId}/groups`, col.id), { order: col.order });
        });
        await batch.commit();
        return;
    }
    
    const sourceColId = source.droppableId;
    const destColId = destination.droppableId;

    const startColumn = newColumnsState[sourceColId];
    const endColumn = newColumnsState[destColId];
    
    if (!startColumn || !endColumn) return;
    
    const sourceItems = [...startColumn.items];
    const [removed] = sourceItems.splice(source.index, 1);

    if (sourceColId === destColId) {
      sourceItems.splice(destination.index, 0, removed);
      const newColumn = { ...startColumn, items: sourceItems };
      newColumnsState[sourceColId] = newColumn;
      
      setColumns(newColumnsState);
      
      const batch = writeBatch(db);
      sourceItems.forEach((item, index) => {
        const taskRef = doc(db, `workspaces/${workpanelId}/boards/${boardId}/tasks`, item.id);
        batch.update(taskRef, { order: index });
      });
      await batch.commit();

    } else {
      const destItems = [...endColumn.items];
      destItems.splice(destination.index, 0, removed);
      
      newColumnsState[sourceColId] = { ...startColumn, items: sourceItems };
      newColumnsState[destColId] = { ...endColumn, items: destItems };
      
      setColumns(newColumnsState);
      
      const task = columns[source.droppableId].items[source.index];
      
      logActivity(workpanelId, boardId, { uid: user.uid, displayName: user.displayName, photoURL: user.photoURL }, `moved task "${task.content}" from "${startColumn.name}" to "${endColumn.name}".`, task.id);
      
      const batch = writeBatch(db);
      const movedTaskRef = doc(db, `workspaces/${workpanelId}/boards/${boardId}/tasks`, removed.id);
      batch.update(movedTaskRef, { groupId: destColId, order: destination.index });
      
      sourceItems.forEach((item, index) => {
        const taskRef = doc(db, `workspaces/${workpanelId}/boards/${boardId}/tasks`, item.id);
        batch.update(taskRef, { order: index });
      });
      destItems.forEach((item, index) => {
         const taskRef = doc(db, `workspaces/${workpanelId}/boards/${boardId}/tasks`, item.id);
         batch.update(taskRef, { order: index });
      });
      
      await batch.commit();
    }
  };
  
  const handleTaskDeleted = (taskId: string) => {
      setSelectedTask(null);
  }

  if (loading) {
    return <BoardSkeleton />;
  }

  if (error) {
    return (
        <div className="flex items-center justify-center h-full text-center text-destructive">
            <p>{error}</p>
        </div>
    );
  }
  
  if (!columns || !board || (userRole === 'guest' && !board.members[user!.uid])) {
     return <BoardSkeleton />;
  }

  const orderedColumns = Object.values(filteredColumns).sort((a,b) => a.order - b.order);

  const handleAssigneeSelect = (assigneeId: string) => {
    setSelectedAssignees(prev => 
        prev.includes(assigneeId) 
        ? prev.filter(id => id !== assigneeId) 
        : [...prev, assigneeId]
    );
  };

  const handlePrioritySelect = (priority: string) => {
    setSelectedPriorities(prev => 
        prev.includes(priority) 
        ? prev.filter(p => p !== priority) 
        : [...prev, priority]
    );
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedAssignees([]);
    setSelectedPriorities([]);
    setDueDateFilter('any');
  }

  const hasActiveFilters = searchTerm || selectedAssignees.length > 0 || selectedPriorities.length > 0 || dueDateFilter !== 'any';

  return (
      <>
        <BoardHeader
            workpanelId={workpanelId}
            boardId={boardId}
            board={board}
            setBoard={setBoard}
            boardMembers={boardMembers}
            userRole={userRole}
            activeView={activeView}
            setActiveView={setActiveView}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            selectedAssignees={selectedAssignees}
            handleAssigneeSelect={handleAssigneeSelect}
            selectedPriorities={selectedPriorities}
            handlePrioritySelect={handlePrioritySelect}
            dueDateFilter={dueDateFilter}
            setDueDateFilter={setDueDateFilter}
            hasActiveFilters={hasActiveFilters}
            clearFilters={clearFilters}
            setIsActivityDrawerOpen={setIsActivityDrawerOpen}
            openCreateGroupDialog={
                <CreateGroupDialog 
                    workpanelId={workpanelId}
                    boardId={boardId}
                    columnCount={orderedColumns.length}
                    userRole={userRole}
                />
            }
        />
       
        {selectedTask && (
            <TaskDetailsDrawer 
                task={selectedTask} 
                workspaceId={workpanelId}
                boardId={boardId}
                boardMembers={boardMembers}
                isOpen={!!selectedTask} 
                onOpenChange={(open) => !open && setSelectedTask(null)} 
                onDelete={handleTaskDeleted}
                userRole={userRole}
            />
        )}
        <ActivityDrawer
            workpanelId={workpanelId}
            boardId={boardId}
            isOpen={isActivityDrawerOpen}
            onOpenChange={setIsActivityDrawerOpen}
        />
        {activeView === 'kanban' ? (
            <DragDropContext onDragEnd={onDragEnd}>
                <Droppable droppableId="board" type="COLUMN" direction="horizontal">
                {(provided) => (
                    <div 
                        ref={provided.innerRef} 
                        {...provided.droppableProps}
                        className="flex-1 flex items-stretch gap-5 overflow-x-auto pb-4 -mx-8 px-8"
                    >
                    {orderedColumns.map((column, index) => (
                        <BoardColumn
                            key={column.id}
                            column={column}
                            index={index}
                            boardMembers={boardMembers}
                            onTaskClick={setSelectedTask}
                            workpanelId={workpanelId}
                            boardId={boardId}
                            userRole={userRole}
                        />
                    ))}
                    {provided.placeholder}
                    </div>
                )}
                </Droppable>
            </DragDropContext>
        ) : (
            <TableView 
                tasks={filteredTasks}
                boardMembers={boardMembers}
                onTaskClick={setSelectedTask}
            />
        )}
    </>
  )
}

function BoardSkeleton() {
  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-60" />
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-32" />
        </div>
      </div>
      <div className="flex-1 flex items-start gap-5 overflow-x-auto pb-4 -mx-8 px-8">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="shrink-0 w-80">
              <div className="bg-muted/30 rounded-lg p-3 h-full flex flex-col">
              <div className="flex justify-between items-center mb-4">
                  <Skeleton className="h-6 w-24" />
                  <Skeleton className="h-6 w-8" />
              </div>
              <div className="space-y-3 flex-1 overflow-y-auto">
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-12 w-full" />
              </div>
              </div>
          </div>
        ))}
      </div>
    </>
  )
}

export const DynamicBoard = dynamic(() => Promise.resolve(Board), {
  ssr: false,
  loading: () => <BoardSkeleton />,
});

    
