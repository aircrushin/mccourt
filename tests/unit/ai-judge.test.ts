import { afterEach, describe, expect, it, vi } from 'vitest';
import { enrichVerdictWithOpenRouter } from '../../lib/ai/judge';
import type { Verdict, Participant } from '../../lib/types/index';

const participants: Participant[] = [{ id:'p1', name:'测试', budget:20, taste:[], goal:'', hunger:3, request:'想吃薯条' }];
const combo = { items:[{id:'fries',name:'薯条',price:14.5,calories:289,protein:4,tags:[],source:'测试资料'}],totalPrice:14.5,calories:289,protein:4,score:80,reason:'规则理由',constraints:[] };
const base: Verdict = { caseNumber:'TEST', caseName:'规则案件', opening:'规则说明', opinions:[], ruling:'规则判词', recommendations:[{ participantId:'p1', ...combo, alternatives:[{...combo,items:[{...combo.items[0],id:'other'}]}] }], live:true, sourceUpdatedAt:null };
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('OpenRouter judge', () => {
  it('makes no request without a key and reports rules', async () => {
    vi.stubEnv('OPENROUTER_API_KEY','');
    const fetchMock=vi.fn(); vi.stubGlobal('fetch',fetchMock);
    const result=await enrichVerdictWithOpenRouter(base,participants,base.recommendations);
    expect(result.judge).toEqual({engine:'rules',model:null,reason:'not_configured'});
    expect(result.verdict).toBe(base); expect(fetchMock).not.toHaveBeenCalled();
  });
  it('sends valid headers, parses structured copy and preserves meal facts', async () => {
    vi.stubEnv('OPENROUTER_API_KEY','test-key');
    const copy={caseName:'薯条自由案',opening:'本庭开庭。',opinions:['钱包应当得到保护。'],ruling:'本庭准许合理享用薯条。',reasons:[{participantId:'p1',reason:'薯条诉求获得支持。'}]};
    const fetchMock=vi.fn(async (_url, init) => {
      const headers=new Headers(init?.headers);
      expect(headers.get('X-Title')).toBe('McCourt');
      expect(headers.get('Authorization')).toBe('Bearer test-key');
      const body=JSON.parse(String(init?.body));
      expect(JSON.stringify(body.response_format)).not.toMatch(/propertyNames|patternProperties/);
      expect(body.reasoning).toEqual({enabled:false});
      expect(body.messages.map((m: {content:string}) => m.content).join(' ')).toContain('totalPrice');
      return Response.json({id:'test-generation',model:'test-model',created:1,choices:[{index:0,message:{role:'assistant',content:JSON.stringify(copy)},finish_reason:'stop'}],usage:{prompt_tokens:10,completion_tokens:20,total_tokens:30}});
    }); vi.stubGlobal('fetch',fetchMock);
    const result=await enrichVerdictWithOpenRouter(base,participants,base.recommendations);
    expect(fetchMock).toHaveBeenCalledOnce(); expect(result.judge.engine).toBe('openrouter');
    expect(result.verdict.caseName).toBe(copy.caseName);
    expect(result.verdict.recommendations[0].reason).toBe(copy.reasons[0].reason);
    expect(result.verdict.recommendations[0].items).toEqual(base.recommendations[0].items);
    expect(result.verdict.recommendations[0].totalPrice).toBe(14.5);
    expect(result.verdict.recommendations[0].alternatives).toEqual(base.recommendations[0].alternatives);
  });
  it('reports fallback when provider fails without exposing its error body', async () => {
    vi.stubEnv('OPENROUTER_API_KEY','test-key');
    const fetchMock=vi.fn(async()=>Response.json({error:{message:'private diagnostic'}},{status:401})); vi.stubGlobal('fetch',fetchMock);
    vi.spyOn(console,'warn').mockImplementation(()=>{});
    const result=await enrichVerdictWithOpenRouter(base,participants,base.recommendations);
    expect(result.judge).toEqual({engine:'rules',model:null,reason:'generation_failed'});
    expect(result.verdict).toBe(base); expect(fetchMock).toHaveBeenCalledOnce();
  });
});
