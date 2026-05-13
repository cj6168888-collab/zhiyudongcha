export type ConversationRiskLevel = 'allow' | 'confirm' | 'deny';

export interface ConversationRiskDecision {
  level: ConversationRiskLevel;
  category?: 'deletion' | 'payment' | 'external_send' | 'privacy' | 'account' | 'credential' | 'legal_financial_medical';
  reason?: string;
  operation?: string;
}

interface RiskRule {
  category: NonNullable<ConversationRiskDecision['category']>;
  level: Exclude<ConversationRiskLevel, 'allow'>;
  operation: string;
  reason: string;
  patterns: RegExp[];
}

const RISK_RULES: RiskRule[] = [
  {
    category: 'credential',
    level: 'deny',
    operation: 'credential_exposure',
    reason: '密钥、密码和令牌不能通过普通对话外发或公开。',
    patterns: [
      /(?:把|将|发送|公开|发给).*(?:密码|密钥|token|api key|apikey|secret|私钥)/iu,
      /(?:密码|密钥|token|api key|apikey|secret|私钥).*(?:发给|外发|公开|上传)/iu,
    ],
  },
  {
    category: 'deletion',
    level: 'deny',
    operation: 'delete_data',
    reason: '删除或清空可能不可恢复，需要您在明确界面中手动处理。',
    patterns: [
      /(?:删除|删掉|清空|粉碎|永久删除|彻底删除).*(?:全部|所有|数据库|文件|记忆|项目|任务|联系人|聊天记录)/u,
      /(?:把|将).*(?:全部|所有).*(?:删除|删掉|清空|粉碎)/u,
    ],
  },
  {
    category: 'payment',
    level: 'confirm',
    operation: 'payment',
    reason: '涉及支付、转账或购买，需要您明确确认金额、对象和用途。',
    patterns: [
      /(?:支付|付款|转账|汇款|充值|下单|购买|开通会员|自动续费)/u,
      /(?:付|转).*(?:元|块|钱|¥|￥|\$)/u,
    ],
  },
  {
    category: 'privacy',
    level: 'confirm',
    operation: 'privacy_share',
    reason: '涉及隐私或敏感资料，需要确认范围和接收方。',
    patterns: [
      /(?:分享|导出|上传|公开).*(?:位置|联系人|通讯录|身份证|银行卡|照片|录音|聊天记录|隐私|客户资料)/u,
      /(?:位置|联系人|通讯录|身份证|银行卡|照片|录音|聊天记录|隐私|客户资料).*(?:分享|导出|上传|公开|发给|外发)/u,
      /(?:授权|允许).*(?:第三方)?.*(?:读取|访问|获取).*(?:联系人|通讯录|位置|相册|文件|麦克风|摄像头)/u,
    ],
  },
  {
    category: 'external_send',
    level: 'confirm',
    operation: 'external_send',
    reason: '涉及向外部发送信息，需要确认接收方和内容。',
    patterns: [
      /(?:发送|发给|转发|外发|提交).*(?:邮件|短信|微信|消息|合同|文件|资料|报价|申请)/u,
      /(?:把|将).*(?:发给|转发给|提交给|外发给)/u,
    ],
  },
  {
    category: 'account',
    level: 'confirm',
    operation: 'account_change',
    reason: '涉及账号、登录或权限变更，需要确认影响范围。',
    patterns: [
      /(?:登录|登出|注销|改密码|修改密码|修改账号密码|账号密码|绑定|解绑|授权第三方|创建密钥|重置密钥|删除账号)/u,
    ],
  },
  {
    category: 'legal_financial_medical',
    level: 'confirm',
    operation: 'high_impact_advice',
    reason: '法律、财务或医疗类高影响事项存在事实不完整、证据不足和执行后果风险，需要您确认后再继续，必要时应咨询专业人士。',
    patterns: [
      /(?:起诉|律师函|报案|贷款|投资|买基金|买股票|吃药|停药|诊断|治疗).*(?:帮我|替我|直接|马上|现在)/u,
      /(?:帮我|替我|直接|马上|现在).*(?:起诉|律师函|报案|贷款|投资|买基金|买股票|吃药|停药|诊断|治疗)/u,
    ],
  },
];

export class ConversationRiskGuard {
  evaluate(text: string): ConversationRiskDecision {
    const normalized = text.trim();
    for (const rule of RISK_RULES) {
      if (rule.patterns.some((pattern) => pattern.test(normalized))) {
        return {
          level: rule.level,
          category: rule.category,
          reason: rule.reason,
          operation: rule.operation,
        };
      }
    }

    return { level: 'allow' };
  }
}

export const conversationRiskGuard = new ConversationRiskGuard();
