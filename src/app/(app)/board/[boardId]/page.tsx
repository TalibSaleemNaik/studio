
import { DynamicBoard } from "@/components/dynamic-board";

export default async function BoardPage({ params }: { params: { boardId: string } }) {
  const { boardId } = params;
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold font-headline">Website Redesign</h1>
      </div>
      <DynamicBoard boardId={boardId} />
    </div>
  );
}
