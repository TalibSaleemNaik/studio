import { DynamicBoard } from "@/components/dynamic-board";

type Params = { boardId: string };

export default async function BoardPage({
  params,
}: { params: Promise<Params> }) {
  const { boardId } = await params; // ✅ must await
  return (
    <div className="h-full flex flex-col">
      <DynamicBoard boardId={boardId} />
    </div>
  );
}
