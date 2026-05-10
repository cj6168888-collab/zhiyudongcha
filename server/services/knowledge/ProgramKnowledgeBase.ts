/**
 * 程序知识库 - 存储和管理程序能力信息
 *
 * 功能：
 * - 程序能力数据库
 * - 操作方法库
 * - 自动学习新程序
 *
 * @version 1.1.0
 * @date 2026-04-19
 */

import { createServiceLogger } from '../../lib/logger';

const logger = createServiceLogger('ProgramKnowledge');

// 程序能力定义
export interface ProgramCapability {
  id: string;
  name: string;
  category: 'social' | 'work' | 'tool' | 'media' | 'shopping' | 'transport' | 'communication' | 'productivity' | 'development' | 'other';
  description: string;
  keywords: string[];
  platforms: ('android' | 'ios' | 'windows' | 'macos' | 'linux' | 'web')[];
  packageNames: {
    android?: string;
    ios?: string;
    windows?: string;
    macos?: string;
    linux?: string;
    web?: string;
  };
  deeplink?: string;
  operations: ProgramOperation[];
  screenshots?: string[];
  lastUpdated: Date;
}

export interface ProgramOperation {
  id: string;
  name: string;
  description: string;
  keywords: string[];
  parameters?: {
    name: string;
    type: 'string' | 'number' | 'boolean' | 'object';
    required: boolean;
    default?: unknown;
    description?: string;
  }[];
  examples: string[];
  successIndicators?: string[];
  failureIndicators?: string[];
}

// 预定义程序知识库
const PROGRAM_DATABASE: ProgramCapability[] = [
  // ========== 社交类 ==========
  {
    id: 'wechat',
    name: '微信',
    category: 'social',
    description: '腾讯微信 - 即时通讯、社交支付',
    keywords: ['微信', 'wechat', 'weixin', '发消息', '朋友圈', '微信支付'],
    platforms: ['android', 'ios', 'windows', 'macos'],
    packageNames: {
      android: 'com.tencent.mm',
      ios: 'com.tencent.xin',
      windows: 'WeChat',
      macos: 'WeChat',
    },
    deeplink: 'weixin://',
    operations: [
      {
        id: 'send_message',
        name: '发送消息',
        description: '向指定联系人发送文本消息',
        keywords: ['发消息', '发送', '告诉'],
        parameters: [
          { name: 'contact', type: 'string', required: true, description: '联系人名称' },
          { name: 'message', type: 'string', required: true, description: '消息内容' },
        ],
        examples: ['发送消息给张三', '告诉李四明天开会'],
      },
      {
        id: 'send_redpacket',
        name: '发红包',
        description: '发送微信红包',
        keywords: ['红包', '发红包', '转账'],
        parameters: [
          { name: 'contact', type: 'string', required: true },
          { name: 'amount', type: 'number', required: true },
        ],
        examples: ['给张三发100块红包'],
      },
      {
        id: 'payment',
        name: '微信支付',
        description: '使用微信支付',
        keywords: ['支付', '付款', '扫码'],
        examples: ['微信支付', '扫码付款'],
      },
    ],
    lastUpdated: new Date('2026-04-01'),
  },

  // ========== 办公类 ==========
  {
    id: 'dingtalk',
    name: '钉钉',
    category: 'work',
    description: '阿里巴巴钉钉 - 企业通讯、协同办公',
    keywords: ['钉钉', 'dingtalk', 'dingding', '工作', '审批', '打卡'],
    platforms: ['android', 'ios', 'windows', 'macos', 'web'],
    packageNames: {
      android: 'com.alibaba.android.rimet',
      ios: 'com.alibaba.android.rimet',
      windows: 'DingTalk',
      macos: 'DingTalk',
      web: 'https://oa.dingtalk.com',
    },
    deeplink: 'dingtalk://',
    operations: [
      {
        id: 'send_message',
        name: '发送消息',
        description: '在工作群或个人发送消息',
        keywords: ['发消息', '发送'],
        parameters: [
          { name: 'contact', type: 'string', required: false },
          { name: 'message', type: 'string', required: true },
        ],
        examples: ['钉钉发给张三'],
      },
      {
        id: 'approve',
        name: '发起审批',
        description: '发起工作审批流程',
        keywords: ['审批', '申请', '流程'],
        examples: ['发起审批', '提交申请'],
      },
      {
        id: 'checkin',
        name: '打卡',
        description: '上下班打卡',
        keywords: ['打卡', '签到'],
        examples: ['帮我打卡'],
      },
    ],
    lastUpdated: new Date('2026-04-01'),
  },

  // ========== 地图导航类 ==========
  {
    id: 'amap',
    name: '高德地图',
    category: 'transport',
    description: '高德地图 - 导航、定位、打车',
    keywords: ['高德', '高德地图', 'amap', '导航', '地图'],
    platforms: ['android', 'ios'],
    packageNames: {
      android: 'com.autonavi.minimap',
      ios: 'com.amap.app',
    },
    deeplink: 'amapuri://',
    operations: [
      {
        id: 'navigate',
        name: '导航',
        description: '导航到指定地点',
        keywords: ['导航', '去', '路线'],
        parameters: [
          { name: 'address', type: 'string', required: true },
          { name: 'type', type: 'string', required: false, default: 'drive' },
        ],
        examples: ['导航到北京站', '帮我导航去上海'],
      },
      {
        id: 'taxi',
        name: '打车',
        description: '叫出租车',
        keywords: ['打车', '出租'],
        parameters: [
          { name: 'address', type: 'string', required: true },
        ],
        examples: ['打车去机场'],
      },
    ],
    lastUpdated: new Date('2026-04-01'),
  },

  {
    id: 'baidumap',
    name: '百度地图',
    category: 'transport',
    description: '百度地图 - 导航、定位',
    keywords: ['百度', '百度地图', 'bdmap', '导航'],
    platforms: ['android', 'ios'],
    packageNames: {
      android: 'com.baidu.BaiduMap',
      ios: 'com.baidu.Baidusearch',
    },
    deeplink: 'baidumap://',
    operations: [
      {
        id: 'navigate',
        name: '导航',
        description: '导航到指定地点',
        keywords: ['导航', '去', '路线'],
        parameters: [
          { name: 'address', type: 'string', required: true },
        ],
        examples: ['百度地图导航到王府井'],
      },
    ],
    lastUpdated: new Date('2026-04-01'),
  },

  // ========== 支付类 ==========
  {
    id: 'alipay',
    name: '支付宝',
    category: 'productivity',
    description: '支付宝 - 支付、理财、生活服务',
    keywords: ['支付宝', 'alipay', '支付', '收款', '理财'],
    platforms: ['android', 'ios', 'windows', 'macos'],
    packageNames: {
      android: 'com.eg.android.AlipayGphone',
      ios: 'com.alipay.iphoneclient',
      windows: 'Alipay',
      macos: 'Alipay',
    },
    deeplink: 'alipay://',
    operations: [
      {
        id: 'payment',
        name: '支付',
        description: '扫描支付',
        keywords: ['支付', '付款', '扫码'],
        examples: ['支付宝支付'],
      },
      {
        id: 'transfer',
        name: '转账',
        description: '转账给好友',
        keywords: ['转账', '汇款'],
        parameters: [
          { name: 'contact', type: 'string', required: true },
          { name: 'amount', type: 'number', required: true },
        ],
        examples: ['转账给张三100元'],
      },
      {
        id: 'collect',
        name: '收款',
        description: '生成收款码',
        keywords: ['收款', '收钱'],
        examples: ['生成收款码'],
      },
    ],
    lastUpdated: new Date('2026-04-01'),
  },

  // ========== 电商类 ==========
  {
    id: 'meituan',
    name: '美团',
    category: 'shopping',
    description: '美团 - 外卖、团购、酒店',
    keywords: ['美团', 'meituan', '外卖', '团购', '酒店'],
    platforms: ['android', 'ios'],
    packageNames: {
      android: 'com.sankuai.meituan',
      ios: 'com.meituan.meituan',
    },
    deeplink: 'meituan://',
    operations: [
      {
        id: 'order_food',
        name: '订外卖',
        description: '点外卖',
        keywords: ['外卖', '点餐', '订餐'],
        parameters: [
          { name: 'restaurant', type: 'string', required: false },
          { name: 'food', type: 'string', required: false },
        ],
        examples: ['点一份外卖', '帮我订外卖'],
      },
      {
        id: 'hotel',
        name: '订酒店',
        description: '预订酒店',
        keywords: ['酒店', '住宿', '订房'],
        examples: ['帮我订酒店'],
      },
    ],
    lastUpdated: new Date('2026-04-01'),
  },

  // ========== 视频类 ==========
  {
    id: 'douyin',
    name: '抖音',
    category: 'media',
    description: '抖音 - 短视频分享',
    keywords: ['抖音', 'douyin', 'tiktok', '短视频'],
    platforms: ['android', 'ios'],
    packageNames: {
      android: 'com.ss.android.ugc.aweme',
      ios: 'com.ss.android.ugc.aweme',
    },
    deeplink: 'snssdk1128://',
    operations: [
      {
        id: 'publish',
        name: '发布视频',
        description: '发布短视频',
        keywords: ['发布', '发视频', '上传'],
        examples: ['发布视频', '上传抖音'],
      },
    ],
    lastUpdated: new Date('2026-04-01'),
  },

  {
    id: 'bilibili',
    name: '哔哩哔哩',
    category: 'media',
    description: 'B站 - 视频弹幕网站',
    keywords: ['B站', '哔哩哔哩', 'bilibili', 'b站'],
    platforms: ['android', 'ios', 'windows', 'macos'],
    packageNames: {
      android: 'tv.danmaku.bili',
      ios: 'tv.danmaku.BiliPlayer',
      windows: '哔哩哔哩',
      macos: 'com.bilibili.bilibili',
    },
    deeplink: 'bilibili://',
    operations: [
      {
        id: 'search',
        name: '搜索',
        description: '搜索视频',
        keywords: ['搜索', '找', '看'],
        parameters: [
          { name: 'keyword', type: 'string', required: true },
        ],
        examples: ['搜索编程教程'],
      },
    ],
    lastUpdated: new Date('2026-04-01'),
  },

  // ========== 开发工具类 ==========
  {
    id: 'vscode',
    name: 'Visual Studio Code',
    category: 'development',
    description: '微软VS Code - 代码编辑器',
    keywords: ['vscode', 'code', 'visual studio code', '编辑器'],
    platforms: ['windows', 'macos', 'linux'],
    packageNames: {
      windows: 'Code',
      macos: 'Visual Studio Code.app',
      linux: 'code',
    },
    operations: [
      {
        id: 'open_file',
        name: '打开文件',
        description: '在VSCode中打开文件',
        keywords: ['打开', '编辑'],
        parameters: [
          { name: 'file', type: 'string', required: true },
          { name: 'line', type: 'number', required: false },
        ],
        examples: ['用VSCode打开index.js', '打开main.ts第50行'],
      },
      {
        id: 'open_folder',
        name: '打开文件夹',
        description: '打开项目文件夹',
        keywords: ['打开', '项目'],
        parameters: [
          { name: 'folder', type: 'string', required: true },
        ],
        examples: ['用VSCode打开项目文件夹'],
      },
      {
        id: 'search',
        name: '搜索',
        description: '在项目中搜索',
        keywords: ['搜索', '查找', 'grep'],
        parameters: [
          { name: 'keyword', type: 'string', required: true },
        ],
        examples: ['在项目中搜索todo'],
      },
    ],
    lastUpdated: new Date('2026-04-01'),
  },

  {
    id: 'idea',
    name: 'IntelliJ IDEA',
    category: 'development',
    description: 'JetBrains IDEA - Java/Kotlin IDE',
    keywords: ['idea', 'intellij', 'java', 'jetbrains'],
    platforms: ['windows', 'macos', 'linux'],
    packageNames: {
      windows: 'idea64.exe',
      macos: 'IntelliJ IDEA.app',
    },
    operations: [
      {
        id: 'open_project',
        name: '打开项目',
        description: '打开项目',
        keywords: ['打开', '项目'],
        parameters: [
          { name: 'path', type: 'string', required: true },
        ],
        examples: ['用IDEA打开项目'],
      },
      {
        id: 'run',
        name: '运行',
        description: '运行程序',
        keywords: ['运行', '执行', 'run'],
        examples: ['运行主程序'],
      },
    ],
    lastUpdated: new Date('2026-04-01'),
  },

  // ========== 文档工具类 ==========
  {
    id: 'wps',
    name: 'WPS Office',
    category: 'productivity',
    description: '金山WPS - 文档处理',
    keywords: ['wps', '文档', 'word', 'excel', 'ppt'],
    platforms: ['windows', 'android', 'ios'],
    packageNames: {
      windows: 'wps',
      android: 'cn.wps.moffice_eng',
    },
    deeplink: 'wps://',
    operations: [
      {
        id: 'new_doc',
        name: '新建文档',
        description: '创建新文档',
        keywords: ['新建', '创建', '文档'],
        parameters: [
          { name: 'type', type: 'string', required: false, default: 'doc' },
        ],
        examples: ['新建Word文档'],
      },
      {
        id: 'open',
        name: '打开文档',
        description: '打开已有文档',
        keywords: ['打开', '查看'],
        parameters: [
          { name: 'path', type: 'string', required: true },
        ],
        examples: ['打开这个文件'],
      },
    ],
    lastUpdated: new Date('2026-04-01'),
  },

  {
    id: 'office',
    name: 'Microsoft Office',
    category: 'productivity',
    description: '微软Office - Word/Excel/PowerPoint',
    keywords: ['office', 'word', 'excel', 'powerpoint', 'ppt'],
    platforms: ['windows', 'macos'],
    packageNames: {
      windows: 'WINWORD',
      macos: 'Microsoft Word',
    },
    operations: [
      {
        id: 'new_doc',
        name: '新建Word文档',
        description: '创建新Word文档',
        keywords: ['新建', '创建', '文档'],
        examples: ['新建Word文档'],
      },
      {
        id: 'new_xls',
        name: '新建Excel',
        description: '创建新Excel表格',
        keywords: ['新建', '表格', 'excel'],
        examples: ['新建Excel表格'],
      },
      {
        id: 'new_ppt',
        name: '新建PPT',
        description: '创建新演示文稿',
        keywords: ['新建', '演示', 'ppt'],
        examples: ['新建PPT'],
      },
    ],
    lastUpdated: new Date('2026-04-01'),
  },

  // ========== 浏览器类 ==========
  {
    id: 'chrome',
    name: 'Google Chrome',
    category: 'tool',
    description: '谷歌浏览器',
    keywords: ['chrome', '谷歌', '浏览器', 'google'],
    platforms: ['windows', 'macos', 'linux'],
    packageNames: {
      windows: 'chrome',
      macos: 'Google Chrome.app',
      linux: 'google-chrome',
    },
    operations: [
      {
        id: 'open_url',
        name: '打开网址',
        description: '打开指定URL',
        keywords: ['打开', '访问', '浏览'],
        parameters: [
          { name: 'url', type: 'string', required: true },
        ],
        examples: ['打开百度', '访问google.com'],
      },
      {
        id: 'search',
        name: '搜索',
        description: '使用搜索引擎搜索',
        keywords: ['搜索', '查找', '搜'],
        parameters: [
          { name: 'keyword', type: 'string', required: true },
        ],
        examples: ['搜索人工智能', '帮我查一下天气'],
      },
    ],
    lastUpdated: new Date('2026-04-01'),
  },

  {
    id: 'edge',
    name: 'Microsoft Edge',
    category: 'tool',
    description: '微软Edge浏览器',
    keywords: ['edge', '微软', '浏览器'],
    platforms: ['windows', 'macos'],
    packageNames: {
      windows: 'msedge',
      macos: 'Microsoft Edge.app',
    },
    operations: [
      {
        id: 'open_url',
        name: '打开网址',
        description: '打开指定URL',
        keywords: ['打开', '访问'],
        parameters: [
          { name: 'url', type: 'string', required: true },
        ],
        examples: ['打开网页'],
      },
    ],
    lastUpdated: new Date('2026-04-01'),
  },

  // ========== 出行类 ==========
  {
    id: 'didi',
    name: '滴滴出行',
    category: 'transport',
    description: '滴滴出行 - 网约车',
    keywords: ['滴滴', 'didi', '打车', '快车', '专车'],
    platforms: ['android', 'ios'],
    packageNames: {
      android: 'com.sdu.didi.psnger',
      ios: 'com.xiaojukeji.didi',
    },
    deeplink: 'didiclient://',
    operations: [
      {
        id: 'order_taxi',
        name: '叫车',
        description: '预约出租车',
        keywords: ['打车', '叫车', '预约'],
        parameters: [
          { name: 'from', type: 'string', required: false },
          { name: 'to', type: 'string', required: false },
        ],
        examples: ['帮我叫车', '打车去机场'],
      },
    ],
    lastUpdated: new Date('2026-04-01'),
  },

  {
    id: 'ctrip',
    name: '携程旅行',
    category: 'transport',
    description: '携程 - 机票、酒店、旅游',
    keywords: ['携程', 'ctrip', '机票', '酒店', '旅游'],
    platforms: ['android', 'ios'],
    packageNames: {
      android: 'ctrip.android.view',
      ios: 'ctrip.android.view',
    },
    deeplink: 'ctrip://',
    operations: [
      {
        id: 'book_flight',
        name: '订机票',
        description: '预订机票',
        keywords: ['机票', '订票', '飞机'],
        examples: ['帮我订机票'],
      },
      {
        id: 'book_hotel',
        name: '订酒店',
        description: '预订酒店',
        keywords: ['酒店', '住宿', '订房'],
        examples: ['订酒店'],
      },
    ],
    lastUpdated: new Date('2026-04-01'),
  },

  // ========== 邮件类 ==========
  {
    id: 'outlook',
    name: 'Microsoft Outlook',
    category: 'communication',
    description: '微软Outlook - 邮件、日历',
    keywords: ['outlook', '邮件', '邮箱', 'calendar'],
    platforms: ['windows', 'macos', 'android', 'ios'],
    packageNames: {
      windows: 'OUTLOOK',
      macos: 'Microsoft Outlook.app',
      android: 'com.microsoft.office.outlook',
    },
    operations: [
      {
        id: 'send_email',
        name: '发送邮件',
        description: '发送电子邮件',
        keywords: ['邮件', '发邮件', '写信'],
        parameters: [
          { name: 'to', type: 'string', required: true },
          { name: 'subject', type: 'string', required: false },
          { name: 'body', type: 'string', required: false },
        ],
        examples: ['发邮件给张三', '给李四发一封邮件'],
      },
      {
        id: 'check_email',
        name: '查邮件',
        description: '查看邮件',
        keywords: ['查看', '读邮件', '收件箱'],
        examples: ['看看有没有新邮件'],
      },
    ],
    lastUpdated: new Date('2026-04-01'),
  },

  {
    id: 'gmail',
    name: 'Gmail',
    category: 'communication',
    description: '谷歌Gmail - 邮箱服务',
    keywords: ['gmail', '谷歌邮箱', '邮件'],
    platforms: ['android', 'ios', 'web'],
    packageNames: {
      android: 'com.google.android.gm',
      ios: 'com.google.Gmail',
      web: 'https://mail.google.com',
    },
    operations: [
      {
        id: 'send_email',
        name: '发送邮件',
        description: '发送Gmail',
        keywords: ['发邮件'],
        examples: ['发Gmail'],
      },
    ],
    lastUpdated: new Date('2026-04-01'),
  },
];

class ProgramKnowledgeBase {
  private static instance: ProgramKnowledgeBase | null = null;
  private programs: Map<string, ProgramCapability> = new Map();
  private learningHistory: Array<{
    programId: string;
    learnedAt: Date;
    source: 'user' | 'auto' | 'web';
  }> = [];

  private constructor() {
    this.initializeDatabase();
  }

  public static getInstance(): ProgramKnowledgeBase {
    if (!ProgramKnowledgeBase.instance) {
      ProgramKnowledgeBase.instance = new ProgramKnowledgeBase();
    }
    return ProgramKnowledgeBase.instance;
  }

  /**
   * 初始化数据库
   */
  private initializeDatabase(): void {
    for (const program of PROGRAM_DATABASE) {
      this.programs.set(program.id, program);
      // 也按名称索引
      this.programs.set(program.name.toLowerCase(), program);
    }
    logger.info({ count: this.programs.size }, 'Program database initialized');
  }

  /**
   * 获取所有程序
   */
  public getAllPrograms(): ProgramCapability[] {
    return Array.from(this.programs.values()).filter(p => !p.id.includes(' '));
  }

  /**
   * 根据ID获取程序
   */
  public getProgram(id: string): ProgramCapability | undefined {
    return this.programs.get(id);
  }

  /**
   * 根据包名获取程序
   */
  public getProgramByPackage(packageName: string): ProgramCapability | undefined {
    for (const program of Array.from(this.programs.values())) {
      const names = Object.values(program.packageNames);
      if (names.includes(packageName)) {
        return program;
      }
    }
    return undefined;
  }

  /**
   * 根据关键词搜索程序
   */
  public searchPrograms(keyword: string): ProgramCapability[] {
    const results: ProgramCapability[] = [];
    const lowerKeyword = keyword.toLowerCase();

    for (const program of Array.from(this.programs.values())) {
      if (program.id.includes(' ')) continue; // 跳过名称条目

      // 检查ID和名称
      if (program.id.toLowerCase().includes(lowerKeyword) ||
          program.name.toLowerCase().includes(lowerKeyword)) {
        results.push(program);
        continue;
      }

      // 检查关键词
      for (const kw of program.keywords) {
        if (kw.toLowerCase().includes(lowerKeyword)) {
          results.push(program);
          break;
        }
      }
    }

    return results;
  }

  /**
   * 根据分类获取程序
   */
  public getProgramsByCategory(category: ProgramCapability['category']): ProgramCapability[] {
    return this.getAllPrograms().filter(p => p.category === category);
  }

  /**
   * 获取程序的特定操作
   */
  public getOperation(programId: string, operationId: string): ProgramOperation | undefined {
    const program = this.getProgram(programId);
    return program?.operations.find(op => op.id === operationId);
  }

  /**
   * 匹配用户意图到操作
   */
  public matchIntent(intent: string): Array<{
    program: ProgramCapability;
    operation: ProgramOperation;
    confidence: number;
  }> {
    const results: Array<{
      program: ProgramCapability;
      operation: ProgramOperation;
      confidence: number;
    }> = [];

    const lowerIntent = intent.toLowerCase();

    for (const program of this.getAllPrograms()) {
      for (const operation of program.operations) {
        let maxConfidence = 0;

        // 检查操作关键词匹配
        for (const keyword of operation.keywords) {
          if (lowerIntent.includes(keyword.toLowerCase())) {
            maxConfidence = Math.max(maxConfidence, 0.8);
          }
        }

        // 检查程序关键词匹配
        for (const keyword of program.keywords) {
          if (lowerIntent.includes(keyword.toLowerCase())) {
            maxConfidence = Math.max(maxConfidence, 0.5);
          }
        }

        if (maxConfidence > 0) {
          results.push({ program, operation, confidence: maxConfidence });
        }
      }
    }

    // 按置信度排序
    results.sort((a, b) => b.confidence - a.confidence);

    return results;
  }

  /**
   * 学习新程序
   */
  public learnProgram(program: ProgramCapability): void {
    this.programs.set(program.id, program);
    this.learningHistory.push({
      programId: program.id,
      learnedAt: new Date(),
      source: 'auto',
    });
    logger.info({ programId: program.id }, 'Learned new program');
  }

  /**
   * 更新程序能力
   */
  public updateProgram(id: string, updates: Partial<ProgramCapability>): boolean {
    const program = this.programs.get(id);
    if (!program) return false;

    const updated = { ...program, ...updates };
    this.programs.set(id, updated);
    logger.info({ programId: id }, 'Program updated');
    return true;
  }

  /**
   * 添加程序操作
   */
  public addOperation(programId: string, operation: ProgramOperation): boolean {
    const program = this.programs.get(programId);
    if (!program) return false;

    program.operations.push(operation);
    this.programs.set(programId, program);
    logger.info({ programId, operationId: operation.id }, 'Operation added');
    return true;
  }

  /**
   * 获取学习历史
   */
  public getLearningHistory(): Array<{
    programId: string;
    learnedAt: Date;
    source: string;
  }> {
    return this.learningHistory;
  }

  /**
   * 获取分类统计
   */
  public getCategoryStats(): Record<string, number> {
    const stats: Record<string, number> = {};

    for (const program of this.getAllPrograms()) {
      stats[program.category] = (stats[program.category] || 0) + 1;
    }

    return stats;
  }

  /**
   * 获取平台统计
   */
  public getPlatformStats(): Record<string, number> {
    const stats: Record<string, number> = {};

    for (const program of this.getAllPrograms()) {
      for (const platform of program.platforms) {
        stats[platform] = (stats[platform] || 0) + 1;
      }
    }

    return stats;
  }

  /**
   * 导出数据库为JSON
   */
  public exportDatabase(): string {
    return JSON.stringify(this.getAllPrograms(), null, 2);
  }

  /**
   * 从JSON导入数据库
   */
  public importDatabase(json: string): number {
    try {
      const programs = JSON.parse(json) as ProgramCapability[];
      let count = 0;

      for (const program of programs) {
        this.programs.set(program.id, program);
        count++;
      }

      logger.info({ count }, 'Database imported');
      return count;
    } catch (error) {
      logger.error({ error }, 'Failed to import database');
      return 0;
    }
  }
}

export const programKnowledgeBase = ProgramKnowledgeBase.getInstance();
export default programKnowledgeBase;
