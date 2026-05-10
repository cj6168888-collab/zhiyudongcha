/**
 * GovernmentFormService - 政府网站表单服务
 *
 * 功能：
 * - 注册和管理政府网站配置
 * - 自动识别表单字段
 * - 智能填写表单
 * - 提交申报材料
 * - 监控申报状态
 *
 * @version 1.0.0
 */

import { createServiceLogger } from '../../lib/logger';
const logger = createServiceLogger('GovernmentFormService');

import { browserAgent, type WebAction, type ExecutionResult } from './BrowserAgent';
import { randomUUID } from 'crypto';

export interface CompanyInfo {
  // 基本信息
  name: string;
  unifiedCreditCode: string;  // 统一社会信用代码
  legalPerson: string;
  legalPersonId: string;
  registeredCapital: string;
  establishedDate: string;

  // 地址信息
  registeredAddress: string;
  businessAddress: string;

  // 经营信息
  businessScope: string;
  industryCategory: string;
  employeeCount: string;

  // 银行信息
  bankName: string;
  bankAccount: string;
  bankCode: string;

  // 税务信息
  taxType: string;
  taxNumber: string;

  // 联系方式
  contactPerson: string;
  contactPhone: string;
  contactEmail: string;
  contactMobile: string;

  // 附件信息
  attachments?: {
    businessLicense?: string;  // 营业执照路径
    taxCert?: string;
    bankDoc?: string;
    other?: string[];
  };
}

export interface GovernmentWebsite {
  id: string;
  name: string;
  description: string;
  url: string;

  // 登录配置
  login: {
    type: 'account' | 'certificate' | 'ca' | 'oauth';
    url: string;
    usernameField?: string;
    passwordField?: string;
    submitButton?: string;
    twoFactorSelector?: string;
    afterLoginUrl?: string;
  };

  // 表单配置
  forms: FormPage[];

  // 状态查询配置
  statusQuery?: {
    url: string;
    applicationIdField?: string;
    statusSelector?: string;
    replySelector?: string;
  };

  // 字段映射
  fieldMappings: FieldMapping[];
}

export interface FormPage {
  id: string;
  name: string;
  url: string;
  fields: FormField[];
  submitButton?: string;
  nextButton?: string;
}

export interface FormField {
  name: string;
  selector: string;
  type: 'text' | 'textarea' | 'select' | 'radio' | 'checkbox' | 'file' | 'date' | 'hidden';
  sourceField?: keyof CompanyInfo;
  defaultValue?: string;
  required?: boolean;
  transform?: (value: string) => string;
  options?: { label: string; value: string }[];
}

export interface FieldMapping {
  sourceField: keyof CompanyInfo | string;
  targetSelectors: string[];
  transform?: (value: string, company: CompanyInfo) => string;
}

export interface FormSubmissionResult {
  success: boolean;
  applicationId?: string;
  status?: string;
  message?: string;
  errors?: { field: string; message: string }[];
  screenshot?: string;
}

export interface ApplicationStatus {
  applicationId: string;
  projectName: string;
  status: 'pending' | 'reviewing' | 'approved' | 'rejected' | 'returned' | 'completed';
  currentStage?: string;
  progress?: number;
  submitDate?: Date;
  updateDate?: Date;
  hasNewReply?: boolean;
  replyContent?: string;
  estimatedCompletionDate?: Date;
}

class GovernmentFormService {
  private websites: Map<string, GovernmentWebsite> = new Map();
  private companyInfo: Map<string, CompanyInfo> = new Map();
  private credentials: Map<string, { username: string; password: string }> = new Map();

  /**
   * 注册政府网站配置
   */
  public registerWebsite(website: GovernmentWebsite): void {
    this.websites.set(website.id, website);
    logger.info({ websiteId: website.id, name: website.name }, 'Government website registered');
  }

  /**
   * 批量注册网站
   */
  public registerWebsites(websites: GovernmentWebsite[]): void {
    for (const website of websites) {
      this.registerWebsite(website);
    }
    logger.info({ count: websites.length }, 'Batch websites registered');
  }

  /**
   * 设置公司信息
   */
  public setCompanyInfo(userId: string, info: CompanyInfo): void {
    this.companyInfo.set(userId, info);
    logger.info({ userId, companyName: info.name }, 'Company info set');
  }

  /**
   * 设置网站登录凭证
   */
  public setCredential(websiteId: string, username: string, password: string): void {
    this.credentials.set(`${websiteId}`, { username, password });
    logger.info({ websiteId }, 'Credential set');
  }

  /**
   * 登录网站
   */
  public async login(websiteId: string, profileId: string): Promise<ExecutionResult> {
    const website = this.websites.get(websiteId);
    if (!website) return { success: false, error: 'Website not registered', duration: 0 };

    const credential = this.credentials.get(websiteId);
    if (!credential && website.login.type === 'account') {
      return { success: false, error: 'Credential not set', duration: 0 };
    }

    const actions: WebAction[] = [
      { type: 'navigate', value: website.login.url },
      { type: 'wait', value: 1000 },
    ];

    if (website.login.type === 'account' && credential) {
      if (website.login.usernameField) {
        actions.push({ type: 'type', selector: website.login.usernameField, value: credential.username });
      }
      if (website.login.passwordField) {
        actions.push({ type: 'type', selector: website.login.passwordField, value: credential.password });
      }
      if (website.login.submitButton) {
        actions.push({ type: 'click', selector: website.login.submitButton });
      }
      if (website.login.afterLoginUrl) {
        actions.push({ type: 'wait_for_navigation', options: { waitUntil: 'networkidle' } });
      }
    }

    const result = await browserAgent.executeActions(profileId, actions);

    if (result.success) {
      await browserAgent.updateProfileCookies(profileId);
    }

    return result;
  }

  /**
   * 填写表单
   */
  public async fillForm(
    websiteId: string,
    profileId: string,
    formPageId: string,
    userId: string,
    additionalData?: Record<string, string>
  ): Promise<ExecutionResult> {
    const website = this.websites.get(websiteId);
    if (!website) return { success: false, error: 'Website not registered', duration: 0 };

    const company = this.companyInfo.get(userId);
    if (!company) return { success: false, error: 'Company info not set', duration: 0 };

    const formPage = website.forms.find(f => f.id === formPageId);
    if (!formPage) return { success: false, error: 'Form page not found', duration: 0 };

    const actions: WebAction[] = [
      { type: 'navigate', value: formPage.url },
      { type: 'wait_for_navigation', options: { waitUntil: 'domcontentloaded' } },
    ];

    for (const field of formPage.fields) {
      let value: string;

      if (field.sourceField) {
        value = String(company[field.sourceField] || '');
      } else if (additionalData && field.name in additionalData) {
        value = additionalData[field.name];
      } else if (field.defaultValue) {
        value = field.defaultValue;
      } else {
        continue;
      }

      if (field.transform) {
        value = field.transform(value);
      }

      if (field.type === 'select' && field.options) {
        const option = field.options.find(o => o.label === value || o.value === value);
        if (option) value = option.value;
      }

      actions.push({ type: 'wait_for_selector', selector: field.selector, timeout: 5000 });
      actions.push({ type: 'type', selector: field.selector, value });
    }

    return browserAgent.executeActions(profileId, actions, { screenshotEach: true });
  }

  /**
   * 提交表单
   */
  public async submitForm(
    websiteId: string,
    profileId: string,
    formPageId: string
  ): Promise<FormSubmissionResult> {
    const website = this.websites.get(websiteId);
    if (!website) return { success: false, message: 'Website not registered' };

    const formPage = website.forms.find(f => f.id === formPageId);
    if (!formPage) return { success: false, message: 'Form page not found' };

    const actions: WebAction[] = [];

    if (formPage.submitButton) {
      actions.push({ type: 'click', selector: formPage.submitButton });
      actions.push({ type: 'wait', value: 2000 });
    }

    const result = await browserAgent.executeActions(profileId, actions);

    // 尝试提取申报号
    const applicationId = await this.extractApplicationId(profileId);

    return {
      success: result.success,
      applicationId,
      screenshot: result.screenshot,
      message: result.success ? 'Form submitted successfully' : result.error,
    };
  }

  /**
   * 提取申报号
   */
  private async extractApplicationId(profileId: string): Promise<string | undefined> {
    // 这个方法需要通过 AI 分析页面来提取申报号
    // 暂时返回空，实际实现中应该调用 AI
    return undefined;
  }

  /**
   * 查询申报状态
   */
  public async checkApplicationStatus(
    websiteId: string,
    profileId: string,
    applicationId: string
  ): Promise<ApplicationStatus | null> {
    const website = this.websites.get(websiteId);
    if (!website || !website.statusQuery) {
      logger.warn({ websiteId }, 'Status query not configured');
      return null;
    }

    const { url, applicationIdField, statusSelector, replySelector } = website.statusQuery;

    const actions: WebAction[] = [
      { type: 'navigate', value: url },
      { type: 'wait_for_navigation', options: { waitUntil: 'domcontentloaded' } },
    ];

    if (applicationIdField) {
      actions.push({ type: 'type', selector: applicationIdField, value: applicationId });
      actions.push({ type: 'click', selector: 'button[type="submit"], .search-btn, #query' });
      actions.push({ type: 'wait', value: 2000 });
    }

    const result = await browserAgent.executeActions(profileId, actions);

    if (!result.success) {
      return null;
    }

    // 提取状态信息
    const status = statusSelector
      ? await this.extractFieldValue(profileId, statusSelector)
      : undefined;

    const replyContent = replySelector
      ? await this.extractFieldValue(profileId, replySelector)
      : undefined;

    return {
      applicationId,
      projectName: '',
      status: this.parseStatus(status || ''),
      currentStage: status,
      hasNewReply: !!replyContent,
      replyContent: replyContent || undefined,
    };
  }

  /**
   * 提取字段值
   */
  private async extractFieldValue(profileId: string, selector: string): Promise<string> {
    const result = await browserAgent.executeActions(profileId, [
      { type: 'extract', selector, options: { mode: 'text' } }
    ]);
    return result.extractedText || '';
  }

  /**
   * 解析状态
   */
  private parseStatus(status: string): ApplicationStatus['status'] {
    const s = status.toLowerCase();

    if (s.includes('通过') || s.includes('批准') || s.includes('立项')) return 'approved';
    if (s.includes('驳回') || s.includes('不通过') || s.includes('拒绝')) return 'rejected';
    if (s.includes('退回') || s.includes('补充')) return 'returned';
    if (s.includes('完成') || s.includes('结项')) return 'completed';
    if (s.includes('审核') || s.includes('评审') || s.includes('审批中')) return 'reviewing';

    return 'pending';
  }

  /**
   * 执行完整的申报流程
   */
  public async executeApplication(
    websiteId: string,
    profileId: string,
    userId: string,
    formData?: Record<string, string>
  ): Promise<FormSubmissionResult> {
    const website = this.websites.get(websiteId);
    if (!website) return { success: false, message: 'Website not registered' };

    logger.info({ websiteId, userId }, 'Starting application process');

    // 1. 登录
    const loginResult = await this.login(websiteId, profileId);
    if (!loginResult.success) {
      return { success: false, message: `Login failed: ${loginResult.error}`, screenshot: loginResult.screenshot };
    }

    // 2. 填写每个表单页
    for (const formPage of website.forms) {
      const fillResult = await this.fillForm(websiteId, profileId, formPage.id, userId, formData);
      if (!fillResult.success) {
        return { success: false, message: `Fill form failed: ${fillResult.error}`, screenshot: fillResult.screenshot };
      }
    }

    // 3. 提交
    return await this.submitForm(websiteId, profileId, website.forms[0]?.id || '');
  }

  /**
   * 获取已注册网站列表
   */
  public getRegisteredWebsites(): GovernmentWebsite[] {
    return Array.from(this.websites.values());
  }

  /**
   * 获取网站配置
   */
  public getWebsite(websiteId: string): GovernmentWebsite | undefined {
    return this.websites.get(websiteId);
  }
}

// 导出单例
export const governmentFormService = new GovernmentFormService();
export default governmentFormService;
