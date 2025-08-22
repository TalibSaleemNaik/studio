
import { DynamicBoard } from "@/components/dynamic-board";

type Params = { boardId: string };
type SearchParams = { workpanelId?: string };

export default function BoardPage({
  params,
  searchParams
}: { params: Params, searchParams: SearchParams }) {
  const { boardId } = params;
  const workpanelId = searchParams.workpanelId || 'default-workpanel';

  return (
    <div className="h-full flex flex-col">
      <DynamicBoard boardId={boardId} workpanelId={workpanelId} />
    </div>
  );
}
