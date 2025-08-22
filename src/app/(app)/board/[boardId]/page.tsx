
import { DynamicBoard } from "@/components/dynamic-board";

type PageProps = { 
  params: { boardId: string };
  searchParams: { workpanelId?: string };
};

export default function BoardPage({ params, searchParams }: PageProps) {
  return (
    <div className="h-full flex flex-col">
      <DynamicBoard boardId={params.boardId} workpanelId={searchParams?.workpanelId} />
    </div>
  );
}
