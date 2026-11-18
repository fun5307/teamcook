// 규칙 기반 초안: 요청 원문과 자료에서 목표·조건·작업을 "제안"으로 뽑는다. AI를 쓰지 않는다.
// - 사용자가 쓴 문장을 그대로 옮긴 것(explicit)과 작업 유형 틀이 덧붙인 것(rule)을 구분한다.
// - 모든 결과는 '제안' 상태로 시작한다. 사용자가 확정해야 레시피에 들어간다.
// - 알아보지 못한 요청은 원문만 보존하고 빈 작업 목록으로 둔다 (고정 예제를 붙이지 않는다).

import { newId } from '../id';
import { nowIso } from '../practice/time';
import type { RoleTag } from '../../types';
import {
  ORDER_SCHEMA_VERSION,
  type Dependency,
  type Evidence,
  type Material,
  type OpenQuestion,
  type OrderDraft,
  type Requirement,
  type RequirementKind,
  type WorkItem,
} from './types';

// ───────────────────────── 요청 유형 ─────────────────────────

export type RequestType = 'research' | 'decide' | 'design' | 'build' | 'fix' | 'write' | 'review';

export const TYPE_LABELS: Record<RequestType, string> = {
  research: '조사',
  decide: '결정',
  design: '설계·기획',
  build: '구현',
  fix: '문제 수정',
  write: '문서 작성',
  review: '검토',
};

const TYPE_WORDS: Record<RequestType, string[]> = {
  fix: ['버그', '오류', '에러', '고치', '고쳐', '오타', '고장', '끊기', '끊어', '안 돼', '안돼', '깨지', '깨져', '실패하', '느려', '수정하고', '수정해'],
  research: ['조사', '알아보', '찾아', '분석', '시장', '경쟁', '리서치', '타당성', '동향', '사례'],
  build: ['만들', '구현', '개발', 'mvp', '프로토타입', '앱', '기능을 추가', '기능 추가', '코딩'],
  design: ['설계', '기획', '아키텍처', '구조를', '로드맵', '계획을'],
  write: ['보고서', '문서로', '문서를 작성', '문서 작성', '설명서', '블로그', '글을', '작성해', '요약해', '정리해', '초안'],
  review: ['검토', '리뷰', '점검', '감사해'],
  decide: ['결정', '고르', '선택', '어느 쪽', '장단점', '중에'],
};

/** 여러 유형이 섞였을 때의 작업 순서 */
const PIPELINE: RequestType[] = ['research', 'decide', 'design', 'build', 'fix', 'write', 'review'];

export function detectTypes(text: string): RequestType[] {
  const lower = text.toLowerCase();
  return PIPELINE.filter((type) => TYPE_WORDS[type].some((word) => lower.includes(word)));
}

// ───────────────────────── 문장 나누기와 분류 ─────────────────────────

export function sentences(text: string): string[] {
  return text
    .split(/\n+|(?<=[.!?。])\s+|(?<=[다요])\.\s*/)
    .map((item) => item.replace(/^[-*•\d.)\s]+/, '').trim())
    // 글자(한글·영문·숫자)가 두 개 이상인 것만 문장으로 본다 ('음...' 같은 것은 뺀다)
    .filter((item) => item.length >= 4 && /[가-힣a-zA-Z0-9].*[가-힣a-zA-Z0-9]/.test(item));
}

const KIND_WORDS: [RequirementKind, string[]][] = [
  ['exclusion', ['제외', '빼고', '범위 밖', '하지 않아도', '안 해도', '다루지 않', '말고']],
  ['constraint', ['반드시', '꼭 ', '마감', '기한', '이내', '만 사용', '써야', '지켜', '하지 마', '금지', '안 된다', '안 됨', '절대']],
  ['success', ['통과', '성공', '완료 기준', '확인되면', '되면 끝', '되어야']],
  ['current', ['현재', '지금은', '이미', '기존', '쓰고 있', '되어 있']],
];

function classify(sentence: string): RequirementKind | null {
  for (const [kind, words] of KIND_WORDS) if (words.some((word) => sentence.includes(word))) return kind;
  return null;
}

const excerpt = (text: string) => (text.length > 120 ? `${text.slice(0, 117)}…` : text);

function requirement(kind: RequirementKind, text: string, source: Requirement['source'], evidence?: Evidence): Requirement {
  const item: Requirement = { id: newId('req'), kind, text, source, state: 'proposed' };
  if (evidence) item.evidence = evidence;
  return item;
}

// ───────────────────────── 작업 유형 틀 ─────────────────────────

interface WorkTemplate {
  title: string;
  description: string;
  type: RoleTag;
  outputs: string[];
  criteria: string[];
}

const WORK_TEMPLATES: Record<RequestType, WorkTemplate[]> = {
  research: [
    { title: '자료 조사', description: '요청한 주제의 자료를 찾고 출처와 함께 정리한다.', type: 'researcher', outputs: ['출처 목록', '조사 메모'], criteria: ['주요 주장마다 출처가 있다', '찾지 못한 것과 없는 것을 구분했다'] },
  ],
  decide: [
    { title: '선택지 정리', description: '고를 수 있는 선택지와 판단 기준을 정리한다.', type: 'researcher', outputs: ['선택지 목록'], criteria: ['선택지마다 근거가 있다'] },
    { title: '장단점 비교와 추천', description: '선택지를 같은 기준으로 비교하고 추천과 이유를 적는다.', type: 'planner', outputs: ['비교표', '추천과 이유'], criteria: ['같은 기준으로 비교했다', '추천하지 않은 쪽의 장점도 적었다'] },
  ],
  design: [
    { title: '요구사항 정리와 설계', description: '범위와 구조를 정하고 만들 순서를 쪼갠다.', type: 'planner', outputs: ['설계 메모', '작업 목록'], criteria: ['범위와 제외 범위를 적었다', '열린 질문을 남겼다'] },
  ],
  build: [
    { title: '구현', description: '설계대로 기능을 만들고 확인 방법을 남긴다.', type: 'implementer', outputs: ['변경 내용', '실행·확인 방법'], criteria: ['요구한 기능이 동작한다', '테스트나 확인 방법이 있다'] },
  ],
  fix: [
    { title: '재현과 원인 찾기', description: '문제를 재현하는 절차를 만들고 원인을 찾는다.', type: 'researcher', outputs: ['재현 절차', '원인 분석'], criteria: ['문제를 재현했다', '원인을 근거와 함께 적었다'] },
    { title: '수정과 테스트', description: '원인을 고치고 재발을 막는 테스트를 더한다.', type: 'implementer', outputs: ['변경 내용', '테스트 결과'], criteria: ['재현 절차로 다시 해도 문제가 없다', '테스트가 통과한다'] },
  ],
  write: [
    { title: '초안 작성', description: '정해진 형식으로 결과물 초안을 쓴다.', type: 'writer', outputs: ['초안'], criteria: ['요구한 형식을 지켰다', '앞 단계의 결과를 빠짐없이 반영했다'] },
  ],
  review: [
    { title: '검토', description: '결과물을 읽고 문제와 근거 위치를 짚는다. 직접 고치지 않는다.', type: 'reviewer', outputs: ['검토 의견'], criteria: ['문제마다 근거 위치를 적었다', '고칠 것과 괜찮은 것을 구분했다'] },
  ],
};

const DEFAULT_DELIVERABLE: Record<RequestType, string> = {
  research: '출처가 붙은 조사 결과',
  decide: '선택지 비교표와 추천',
  design: '설계 메모와 작업 목록',
  build: '동작하는 결과물과 확인 방법',
  fix: '수정된 코드와 테스트 결과',
  write: '완성된 문서',
  review: '검토 의견 목록',
};

const DEFAULT_SUCCESS: Record<RequestType, string> = {
  research: '주요 주장에 확인 가능한 출처가 있다',
  decide: '추천과 그 이유가 비교 기준에 맞게 설명된다',
  design: '만들 범위와 제외 범위가 정해졌다',
  build: '요구한 기능이 실제로 동작한다',
  fix: '문제가 더 이상 재현되지 않고 테스트가 통과한다',
  write: '요구한 형식과 분량을 지켰다',
  review: '모든 지적에 근거 위치가 있다',
};

function workFrom(template: WorkTemplate): WorkItem {
  return {
    id: newId('work'),
    title: template.title,
    description: template.description,
    inputs: [],
    outputs: template.outputs.map((name) => ({ id: newId('out'), name })),
    criteria: [...template.criteria],
    overrides: [],
    checkpoint: false,
    required: true,
    origin: 'rule',
    state: 'proposed',
    type: template.type,
  };
}

/** 유형이 섞였을 때의 작업 목록. 검토는 맨 끝에 하나만 둔다 (만든 쪽과 따로 보는 독립 검토). */
export function workForTypes(types: RequestType[]): WorkItem[] {
  if (types.length === 0) return [];
  const work: WorkItem[] = [];
  for (const type of PIPELINE) {
    if (!types.includes(type) || type === 'review') continue;
    // 문제 수정과 구현이 함께면 구현 틀은 쓰지 않는다 (수정 틀이 구현을 포함)
    if (type === 'build' && types.includes('fix')) continue;
    work.push(...WORK_TEMPLATES[type].map(workFrom));
  }
  const makes = types.some((type) => type === 'build' || type === 'fix' || type === 'write');
  if (types.includes('review') || makes) work.push(workFrom(WORK_TEMPLATES.review[0]));
  // 설계 뒤에 구현이 오면 설계를 확인받고 넘어가자고 제안한다
  const design = work.find((item) => item.title === '요구사항 정리와 설계');
  if (design && types.includes('build')) design.checkpoint = true;
  return work;
}

/** 차례대로 이어지는 전달: 앞 작업의 산출물을 모두 다음 작업에 넘긴다 */
export function chainDeps(work: WorkItem[]): Dependency[] {
  const deps: Dependency[] = [];
  for (let index = 1; index < work.length; index += 1) {
    const from = work[index - 1];
    deps.push({ id: newId('dep'), from: from.id, to: work[index].id, outputIds: from.outputs.map((output) => output.id), note: '' });
  }
  return deps;
}

// ───────────────────────── 질문 ─────────────────────────

function questionsFor(types: RequestType[], text: string): OpenQuestion[] {
  const list: OpenQuestion[] = [];
  const ask = (question: string, options?: string[]) =>
    list.push({ id: newId('q'), text: question, ...(options ? { options } : {}), state: 'open', mustDecide: false, affects: [] });
  const builds = types.includes('build') || types.includes('fix');
  if ((types.includes('research') || types.includes('design') || types.includes('decide')) && !builds) {
    ask('구현까지 필요한가요?', ['조사·설계까지만', '구현까지']);
  }
  if (builds && !/새로|처음부터|신규/.test(text)) ask('기존 프로젝트를 고치나요, 새로 만드나요?', ['기존 프로젝트 수정', '새로 만들기']);
  if (types.includes('write') || types.includes('research')) ask('결과물은 어떤 형식이면 좋나요?', ['Markdown 문서', '표', '발표 개요']);
  if (types.includes('decide')) ask('무엇을 기준으로 고를까요? (비용, 속도, 위험 등)');
  if (types.length === 0) ask('최종적으로 무엇을 받고 싶나요?');
  return list;
}

// ───────────────────────── 초안 만들기 ─────────────────────────

export interface DraftResult {
  detected: RequestType[];
  requirements: Requirement[];
  questions: OpenQuestion[];
  work: WorkItem[];
  deps: Dependency[];
}

/** 요청과 읽은 자료에서 초안을 만든다. 같은 입력이면 같은 내용(새 id)을 만든다. */
export function draftFromRequest(text: string, materials: Material[]): DraftResult {
  const readable = materials.filter((material) => material.status === 'read' && material.content?.trim());
  const types = detectTypes([text, ...readable.map((material) => material.content ?? '')].join('\n'));
  const requirements: Requirement[] = [];
  const seen = new Set<string>();
  const add = (kind: RequirementKind, sentence: string, sourceId: string) => {
    const key = `${kind}:${sentence}`;
    if (seen.has(key)) return;
    seen.add(key);
    requirements.push(requirement(kind, sentence, 'explicit', { sourceId, excerpt: excerpt(sentence) }));
  };

  // 요청 원문: 첫 분류되지 않은 문장을 목표로, 나머지는 낱말로 분류한다
  let goalFound = false;
  for (const sentence of sentences(text)) {
    const kind = classify(sentence);
    if (kind) add(kind, sentence, 'request');
    else if (!goalFound) {
      add('goal', sentence, 'request');
      goalFound = true;
    }
  }
  // 자료: 조건·제외·현재 상태만 종류마다 3개까지
  for (const material of readable) {
    const counts: Partial<Record<RequirementKind, number>> = {};
    for (const sentence of sentences(material.content ?? '')) {
      const kind = classify(sentence);
      if (!kind || kind === 'success') continue;
      counts[kind] = (counts[kind] ?? 0) + 1;
      if ((counts[kind] ?? 0) <= 3) add(kind, sentence, material.id);
    }
  }
  if (!goalFound && text.trim()) {
    requirements.unshift(requirement('goal', excerpt(text.trim().split('\n')[0]), 'explicit', { sourceId: 'request', excerpt: excerpt(text.trim()) }));
  }
  // 결과물과 성공 조건이 원문에 없으면 유형 틀에서 제안한다
  const main = types.find((type) => type !== 'review') ?? types[0];
  if (main && !requirements.some((item) => item.kind === 'deliverable')) {
    const last = [...types].reverse().find((type) => type !== 'review') ?? main;
    requirements.push(requirement('deliverable', DEFAULT_DELIVERABLE[last], 'rule'));
  }
  if (main && !requirements.some((item) => item.kind === 'success')) {
    for (const type of types.filter((item) => item !== 'review').slice(0, 2)) {
      requirements.push(requirement('success', DEFAULT_SUCCESS[type], 'rule'));
    }
  }
  const work = workForTypes(types);
  return { detected: types, requirements, questions: questionsFor(types, text), work, deps: chainDeps(work) };
}

/** 요청 단계의 새 주문 */
export function newOrder(text = '', materials: Material[] = []): OrderDraft {
  const now = nowIso();
  return {
    schemaVersion: ORDER_SCHEMA_VERSION,
    id: newId('order'),
    revision: 1,
    status: 'draft',
    step: 'request',
    createdAt: now,
    updatedAt: now,
    title: '',
    request: { text, materials },
    requirements: [],
    questions: [],
    work: [],
    deps: [],
    roles: [],
    assignments: [],
    style: 'subagents',
    detected: [],
  };
}

/** 요청 단계에서 '작업 설계하기'를 눌렀을 때: 초안을 채우고 주문 정리 단계로 */
export function startDesign(order: OrderDraft): OrderDraft {
  const draft = draftFromRequest(order.request.text, order.request.materials);
  const firstLine = order.request.text.trim().split('\n')[0] ?? '';
  return {
    ...order,
    status: 'designing',
    step: 'define',
    title: order.title || (firstLine.length > 40 ? `${firstLine.slice(0, 38)}…` : firstLine) || '이름 없는 주문',
    request: { ...order.request, textAtDraft: order.request.text },
    detected: draft.detected,
    requirements: draft.requirements,
    questions: draft.questions,
    work: draft.work,
    deps: draft.deps,
  };
}

/** 요청이나 읽은 자료에 실제 내용이 있어야 설계를 시작할 수 있다 */
export function canStart(text: string, materials: Material[]): { ok: boolean; message?: string } {
  if (text.trim()) return { ok: true };
  if (materials.some((material) => material.status === 'read' && material.content?.trim())) return { ok: true };
  if (materials.some((material) => material.kind === 'link')) {
    return { ok: false, message: '링크는 주소만 저장하고 내용을 읽지 않아요. 무엇을 하고 싶은지, 또는 링크의 필요한 내용을 적어 주세요.' };
  }
  return { ok: false, message: '이루고 싶은 일을 적거나 텍스트 자료를 넣어 주세요.' };
}
