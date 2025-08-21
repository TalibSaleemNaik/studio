import { DynamicBoard } from "@/components/dynamic-board";

type Params = { boardId: string };

export default async function BoardPage({
  params,
}: { params: Promise<Params> }) {
  const { boardId } = await params; // ✅ must await
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold font-headline">Website Redesign</h1>
      </div>
      <DynamicBoard boardId={boardId} />
    </div>
  );
}
