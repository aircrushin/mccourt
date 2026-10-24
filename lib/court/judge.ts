import type { Participant, Recommendation, Verdict } from '@/lib/types/index';

export function buildVerdict(partyName: string, participants: Participant[], recommendations: Recommendation[], live: boolean, updatedAt: string|null, warning?: string): Verdict {
  const caseNumber = `MC-${new Date().getFullYear()}-${String(Math.floor(Math.random()*9000)+1000)}`;
  const caseName = participants.length > 1 ? `${participants.map(p=>p.name).join('、')}的午餐争议案` : `${participants[0].name}的午餐选择案`;
  const opinions = participants.slice(0,3).map((p) => `${p.name}提出“${p.request || p.goal || '合理点餐'}”，本庭确认其诉求已被记录。`);
  const hasNull = recommendations.some(r=>!r.meal);
  const ruling = hasNull ? '本庭认为，当前可验证餐品资料不足以满足全部诉求。请查看缺口说明，避免把猜测当成价格或营养事实。' : '本庭认为，各方食欲均有其正当性。现依预算与已验证资料作出分配，薯条自由与钱包安全暂时达成和解。';
  return { caseNumber, caseName, opening:`关于“${partyName}”饭局的点餐争议，本庭已完成事实整理。${live ? '证据来自麦当劳 MCP。' : '当前为体验案例，使用固定案件资料，未调用实时服务。'}`, opinions, ruling, recommendations, live, sourceUpdatedAt:updatedAt, warning };
}
