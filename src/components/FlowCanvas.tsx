// 흐름 캔버스 (React Flow): 카드 = 상자, 넘겨주기 = 화살표, 상자마다 실행 경로 배지.
// onConnect / onRemove를 주면 편집할 수 있다(상자 오른쪽 점에서 다른 상자로 끌어 잇기).
// 위치는 저장하지 않고 lib/flowLayout.ts가 매번 계산한다.

import { useMemo, useState } from 'react';
import {
  Background,
  type Connection,
  type Edge,
  Handle,
  MarkerType,
  type Node,
  type NodeProps,
  Panel,
  Position,
  ReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LockBadge, PathBadge, engineName } from '@/components/RouteInfo';
import { layoutFlow } from '@/lib/flowLayout';
import { type RecipeResolution, effectiveRoute } from '@/lib/resolvePath';
import type { AgentCard, PathLevel, Recipe } from '@/types';

const NODE_WIDTH = 210;
const GAP_X = 90;
const GAP_Y = 120;

type CardNodeData = {
  card: AgentCard;
  path: PathLevel;
  engine: string;
  locked: boolean;
  editable: boolean;
};
type CardNode = Node<CardNodeData, 'card'>;

const dot = '!size-2.5 !border-2 !border-background !bg-zinc-400';
const hiddenDot = '!size-1 !border-0 !bg-transparent';

function CardNodeView({ data }: NodeProps<CardNode>) {
  const { card, path, engine, locked, editable } = data;
  return (
    <div
      className="flex flex-col gap-1 rounded-xl border bg-card px-3 py-2 shadow-sm"
      style={{ width: NODE_WIDTH }}
    >
      {/* 앞으로 가는 화살표: 오른쪽에서 나가 왼쪽으로 들어간다 */}
      <Handle id="in" type="target" position={Position.Left} className={editable ? dot : hiddenDot} />
      <Handle id="out" type="source" position={Position.Right} className={editable ? dot : hiddenDot} />
      {/* 되돌아가는 화살표(예: 검토 결과): 아래쪽으로 돌아간다 */}
      <Handle id="back-out" type="source" position={Position.Bottom} className={hiddenDot} style={{ left: '35%' }} isConnectable={false} />
      <Handle id="back-in" type="target" position={Position.Bottom} className={hiddenDot} style={{ left: '65%' }} isConnectable={false} />

      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-semibold">{card.displayName || card.name}</span>
        <span className="flex shrink-0 items-center gap-1">
          {locked ? <LockBadge /> : null}
          <PathBadge path={path} short />
        </span>
      </div>
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <code className="truncate">{card.name}</code>
        <span className="shrink-0">{engine}</span>
      </div>
    </div>
  );
}

const nodeTypes = { card: CardNodeView };

export default function FlowCanvas({
  recipe,
  resolution,
  onConnect,
  onRemove,
  onSelect,
}: {
  recipe: Recipe;
  resolution: RecipeResolution;
  /** 두 카드를 이었을 때. 주지 않으면 읽기 전용. */
  onConnect?: (from: string, to: string) => void;
  /** 화살표를 지울 때 (넘겨주기 id) */
  onRemove?: (handoffId: string) => void;
  /** 화살표를 눌러 골랐을 때 (편집 화면이 해당 전달 정보 칸으로 옮겨 간다) */
  onSelect?: (handoffId: string) => void;
}) {
  const editable = Boolean(onConnect);
  const [selected, setSelected] = useState<string | null>(null);

  const { nodes, edges, height } = useMemo(() => {
    const layout = layoutFlow(recipe);
    const cardNodes: CardNode[] = recipe.cards.map((card) => {
      const route = effectiveRoute(resolution.perCard[card.id]);
      return {
        id: card.id,
        type: 'card',
        position: {
          x: layout[card.id].level * (NODE_WIDTH + GAP_X),
          y: layout[card.id].row * GAP_Y,
        },
        data: {
          card,
          path: route.path,
          engine: engineName(route.engine),
          locked: resolution.perCard[card.id].locked,
          editable,
        },
        draggable: false,
        selectable: false,
      };
    });

    const flowEdges: Edge[] = [];
    for (const handoff of recipe.handoffs) {
      const from = layout[handoff.from];
      const to = layout[handoff.to];
      if (!from || !to || handoff.from === handoff.to) continue;
      const forward = to.level > from.level;
      const active = handoff.id === selected;
      flowEdges.push({
        id: handoff.id,
        source: handoff.from,
        target: handoff.to,
        sourceHandle: forward ? 'out' : 'back-out',
        targetHandle: forward ? 'in' : 'back-in',
        type: forward ? 'default' : 'smoothstep',
        label: handoff.label,
        labelStyle: { fontSize: 12 },
        labelBgPadding: [6, 3],
        labelBgBorderRadius: 6,
        markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
        style: { strokeWidth: active ? 2.5 : 1.5, stroke: active ? 'var(--primary)' : undefined },
        animated: !forward,
      });
    }

    const rows = Math.max(1, ...Object.values(layout).map((position) => position.row + 1));
    return { nodes: cardNodes, edges: flowEdges, height: Math.min(520, Math.max(240, rows * GAP_Y + 140)) };
  }, [recipe, resolution, editable, selected]);

  const selectedHandoff = recipe.handoffs.find((handoff) => handoff.id === selected);
  const nameOf = (id: string) => {
    const card = recipe.cards.find((item) => item.id === id);
    return card ? card.displayName || card.name : '?';
  };

  const handleConnect = (connection: Connection) => {
    if (!onConnect || !connection.source || !connection.target) return;
    if (connection.source === connection.target) return;
    onConnect(connection.source, connection.target);
  };

  return (
    <div className="overflow-hidden rounded-2xl border bg-muted/30" style={{ height }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
        minZoom={0.3}
        maxZoom={1.5}
        nodesDraggable={false}
        nodesConnectable={editable}
        elementsSelectable={editable}
        zoomOnScroll={false}
        preventScrolling={false}
        onConnect={handleConnect}
        onEdgeClick={(_event, edge) => {
          if (!editable) return;
          setSelected(edge.id === selected ? null : edge.id);
          onSelect?.(edge.id);
        }}
        onPaneClick={() => setSelected(null)}
        proOptions={{ hideAttribution: false }}
      >
        <Background gap={20} size={1} />
        {editable ? (
          <Panel position="top-left">
            <div className="rounded-lg border bg-card/95 px-2.5 py-1.5 text-xs text-muted-foreground shadow-sm">
              {selectedHandoff && onRemove ? (
                <span className="flex items-center gap-2 text-foreground">
                  {nameOf(selectedHandoff.from)} → {nameOf(selectedHandoff.to)}
                  <Button
                    size="xs"
                    variant="destructive"
                    onClick={() => {
                      onRemove(selectedHandoff.id);
                      setSelected(null);
                    }}
                  >
                    <Trash2 aria-hidden />이 화살표 지우기
                  </Button>
                </span>
              ) : (
                '상자 오른쪽 점에서 다른 상자로 끌면 넘겨주기가 생겨요. 화살표를 누르면 지울 수 있어요.'
              )}
            </div>
          </Panel>
        ) : null}
      </ReactFlow>
    </div>
  );
}
