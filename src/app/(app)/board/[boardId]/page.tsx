
"use client"
import { DynamicBoard } from "@/components/dynamic-board";
import { useSearchParams } from 'next/navigation'

type Params = { boardId: string };

export default function BoardPage({
  params,
}: { params: Params }) {
  const { boardId } = params;
  const searchParams = useSearchParams();
  const workpanelId = searchParams.get('workpanelId') || 'default-workpanel';

  return (
    <div className="h-full flex flex-col">
      <DynamicBoard boardId={boardId} workpanelId={workpanelId} />
    </div>
  );
}
