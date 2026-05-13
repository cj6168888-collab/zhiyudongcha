import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProfessionalKnowledgeService } from '../../../services/professional-knowledge';
import policyHarvester from '../../../services/policy-harvester';

describe('ProfessionalKnowledgeService', () => {
  it('matches conversational no-contract labor disputes to the double-wage rule', async () => {
    const service = new ProfessionalKnowledgeService();

    const results = await service.searchKnowledge(
      '入职3个月公司没签书面合同，可以主张什么赔偿',
      'LEGAL',
      'LABOR',
      5,
      0.5
    );

    expect(results.map(result => result.title)).toContain('中华人民共和国劳动合同法 第八十二条');
    expect(results.find(result => result.title.includes('第八十二条'))?.content).toContain('二倍的工资');
  });

  it('matches informal oral dismissal wording to illegal termination compensation', async () => {
    const service = new ProfessionalKnowledgeService();

    const results = await service.searchKnowledge(
      '昨天老板口头通知我不用来了，这算违法辞退吗',
      'LEGAL',
      'LABOR',
      5,
      0.5
    );

    expect(results.map(result => result.title)).toContain('中华人民共和国劳动合同法 第八十七条');
    expect(results.find(result => result.title.includes('第八十七条'))?.content).toContain('经济补偿标准的二倍');
  });
});

describe('PolicyHarvester labor fallback content', () => {
  it('does not describe N+1 as illegal termination compensation', () => {
    const harvester = policyHarvester as unknown as {
      getLaborLawContent: (type: string) => string;
    };

    const content = harvester.getLaborLawContent('劳动争议');

    expect(content).toContain('N+1：特定无过失性解除且未提前30日通知');
    expect(content).toContain('2N：违法解除劳动合同的赔偿金');
    expect(content).not.toContain('N+1：违法解除劳动合同');
  });
});

describe('legal expert fallback analysis', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('uses stated salary facts for no-contract dismissal estimates', async () => {
    vi.stubEnv('DASHSCOPE_API_KEY', '');
    vi.resetModules();
    const { runExpertAnalysis } = await import('../../../services/expert-ai');

    const analysis = await runExpertAnalysis(
      'LEGAL',
      '我入职3个月，公司一直没签书面劳动合同，月薪15000。昨天口头通知我不用来了。',
      undefined,
      { useKnowledgeBase: true }
    );

    expect(analysis.finalVerdict).toContain('30000元');
    expect(analysis.finalVerdict).toContain('15000元');
    expect(analysis.recommendations.join('\n')).toContain('不要把违法解除2N和N+1混用');
  });

  it('does not invent salary facts for generic dismissal questions', async () => {
    vi.stubEnv('DASHSCOPE_API_KEY', '');
    vi.resetModules();
    const { runExpertAnalysis } = await import('../../../services/expert-ai');

    const analysis = await runExpertAnalysis(
      'LEGAL',
      '公司没签劳动合同，今天突然口头辞退我怎么办？',
      undefined,
      { useKnowledgeBase: true }
    );

    expect(analysis.finalVerdict).not.toContain('30000元');
    expect(analysis.finalVerdict).not.toContain('15000元');
    expect(analysis.finalVerdict).toContain('具体金额必须按实际入职日期');
  });

  it('does not invent contract amount facts for generic contract review fallback', async () => {
    vi.stubEnv('DASHSCOPE_API_KEY', '');
    vi.resetModules();
    const { runExpertAnalysis } = await import('../../../services/expert-ai');

    const analysis = await runExpertAnalysis(
      'LEGAL',
      '服务合同里写了很高的违约金，还约定对方所在地法院管辖，我该怎么改？',
      undefined,
      { useKnowledgeBase: true }
    );

    const text = `${analysis.chainOfThought.map(step => `${step.reasoning}\n${step.conclusion}`).join('\n')}\n${analysis.finalVerdict}`;
    expect(text).not.toContain('10万元');
    expect(text).not.toContain('5000元');
    expect(text).toContain('合同金额待核实');
  });

  it('states penalty adjustment as request-driven and evidence-bound', async () => {
    vi.stubEnv('DASHSCOPE_API_KEY', '');
    vi.resetModules();
    const { runExpertAnalysis } = await import('../../../services/expert-ai');

    const analysis = await runExpertAnalysis(
      'LEGAL',
      '我是乙方。技术服务合同金额10万元，合同写乙方迟延一天按合同总价5%支付违约金，争议由甲方所在地法院管辖，甲方可单方验收并拒付尾款。请审查风险并给修改建议。',
      undefined,
      { useKnowledgeBase: true }
    );

    const text = `${analysis.chainOfThought.map(step => `${step.reasoning}\n${step.conclusion}`).join('\n')}\n${analysis.finalVerdict}\n${analysis.recommendations.join('\n')}`;
    expect(text).toContain('主动请求');
    expect(text).toContain('举证');
    expect(text).toContain('实际损失');
    expect(text).not.toContain('极可能');
    expect(text).not.toContain('大幅调减');
  });
});

describe('zero hallucination legal query calibration', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('does not state social insurance back payment as a definite arbitration scope rule without source text', async () => {
    vi.resetModules();
    const { calibrateZeroHallucinationAnswer } = await import('../../../services/zero-hallucination');

    const answer = calibrateZeroHallucinationAnswer(
      '风险提示：要求补缴社保不属于劳动仲裁受案范围，应向社保经办机构投诉处理。',
      {
        mode: 'LEGAL',
        userRole: 'GUEST',
        query: '公司拖欠工资两个月并且没有缴纳社保，我能否解除劳动合同并要求经济补偿？',
      },
      [
        {
          citation: '[来源1]',
          title: '中华人民共和国劳动合同法 第三十八条',
          content: '用人单位未及时足额支付劳动报酬或未依法缴纳社会保险费的，劳动者可以解除劳动合同。',
          score: 98,
        },
      ]
    );

    expect(answer).toContain('知识库未覆盖');
    expect(answer).toContain('社保经办机构');
    expect(answer).not.toContain('不属于劳动仲裁受案范围');
  });
});

describe('general expert fallback analysis', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('keeps finance fallback grounded in user numbers and tax risk', async () => {
    vi.stubEnv('DASHSCOPE_API_KEY', '');
    vi.resetModules();
    const { runExpertAnalysis } = await import('../../../services/expert-ai');

    const analysis = await runExpertAnalysis(
      'FINANCE',
      '我公司本月确认收入80万元，应收账款有45万元还没回，工资和房租下周要付28万元，供应商账期还有15万元。客户要求先开全额增值税专票再付款。',
      undefined,
      { useKnowledgeBase: true }
    );

    const text = `${analysis.finalVerdict}\n${analysis.recommendations.join('\n')}`;
    expect(text).toContain('45万应收款');
    expect(text).toContain('28万元');
    expect(text).toContain('先开全额专票');
    expect(text).toContain('销项税');
    expect(text).toContain('[EXECUTE_NOW]');
    expect(text).toContain('[WAIT_CONFIRM]');
    expect(text).toContain('[INFORM_ONLY]');
  });

  it('does not invent the capability-audit customer-change scenario for generic emotional support', async () => {
    vi.stubEnv('DASHSCOPE_API_KEY', '');
    vi.resetModules();
    const { runExpertAnalysis } = await import('../../../services/expert-ai');

    const analysis = await runExpertAnalysis(
      'PSYCHOLOGY',
      '我今天压力很大，脑子有点乱，想先聊聊。',
      undefined,
      { useKnowledgeBase: false }
    );

    const text = `${analysis.chainOfThought.map(step => `${step.reasoning}\n${step.evidence.join('\n')}`).join('\n')}\n${analysis.finalVerdict}\n${analysis.recommendations.join('\n')}`;
    expect(text).not.toContain('连续三次');
    expect(text).not.toContain('临时改需求');
    expect(text).toContain('焦虑和压力');
  });

  it('keeps customer-conflict psychology advice inside confirmed communication boundaries', async () => {
    vi.stubEnv('DASHSCOPE_API_KEY', '');
    vi.resetModules();
    const { runExpertAnalysis } = await import('../../../services/expert-ai');

    const analysis = await runExpertAnalysis(
      'PSYCHOLOGY',
      '客户连续三次临时改需求，还说我们不专业。我现在很烦，想直接怼回去。',
      undefined,
      { useKnowledgeBase: false }
    );

    const text = `${analysis.finalVerdict}\n${analysis.recommendations.join('\n')}`;
    expect(text).toContain('可能动机');
    expect(text).toContain('控制感');
    expect(text).toContain('信任');
    expect(text).toContain('不会未经你明确确认代发邮件');
    expect(text).toContain('可选自我调节');
    expect(text).not.toContain('立即发送');
  });

  it('keeps finance fallback grounded in cashflow numbers and invoice risk', async () => {
    vi.stubEnv('DASHSCOPE_API_KEY', '');
    vi.resetModules();
    const { runExpertAnalysis } = await import('../../../services/expert-ai');

    const analysis = await runExpertAnalysis(
      'FINANCE',
      '我公司本月确认收入80万元，应收账款有45万元还没回，工资和房租下周要付28万元，供应商账期还有15万元。客户要求先开全额增值税专票再付款。',
      undefined,
      { useKnowledgeBase: false }
    );

    const text = `${analysis.finalVerdict}\n${analysis.recommendations.join('\n')}`;
    expect(text).toContain('28万元');
    expect(text).toContain('45万元');
    expect(text).toContain('15万元');
    expect(text).toContain('销项税');
    expect(text).toContain('不要无条件先开全额专票');
    expect(text).toContain('[EXECUTE_NOW]');
    expect(text).toContain('[WAIT_CONFIRM]');
    expect(text).toContain('[INFORM_ONLY]');
  });
});
