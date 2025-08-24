
import { DynamicBoard } from "@/components/dynamic-board";

type PageProps = { 
  params: { boardId: string };
  searchParams: { workpanelId: string };
};

export default function BoardPage({ params, searchParams }: PageProps) {
  const { boardId } = params;
  const { workpanelId } = searchParams;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <DynamicBoard boardId={boardId} workpanelId={workpanelId} />
    </div>
  );
}
