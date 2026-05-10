// Word文档生成器 - 支持完整Word格式导出
// 陈先生出品 · cj6168888@Gmail.com

// ========== 样式定义 ==========

export interface FontStyle {
  name?: string          // 字体名称: 微软雅黑, 宋体, Times New Roman等
  size?: number          // 字号(pt): 12, 14, 16等
  bold?: boolean
  italic?: boolean
  underline?: boolean | 'single' | 'double' | 'wave' | 'dotted' | 'dashed'
  strike?: boolean       // 删除线
  color?: string         // 十六进制颜色: #FF0000
  highlight?: string     // 高亮颜色
  superscript?: boolean  // 上标
  subscript?: boolean    // 下标
  smallCaps?: boolean    // 小型大写
  allCaps?: boolean      // 全大写
}

export interface ParagraphStyle {
  alignment?: 'left' | 'center' | 'right' | 'justify' | 'distribute'
  lineSpacing?: number        // 行距倍数: 1, 1.5, 2
  lineSpacingPt?: number      // 固定行距(pt)
  spaceBefore?: number        // 段前间距(pt)
  spaceAfter?: number         // 段后间距(pt)
  firstLineIndent?: number    // 首行缩进(cm)
  hangingIndent?: number      // 悬挂缩进(cm)
  leftIndent?: number         // 左缩进(cm)
  rightIndent?: number        // 右缩进(cm)
  keepNext?: boolean          // 与下段同页
  keepLines?: boolean         // 段中不分页
  widowControl?: boolean      // 孤行控制
  outlineLevel?: number       // 大纲级别 0-9
  backgroundColor?: string    // 段落背景色
  borderStyle?: BorderStyle   // 段落边框
}

export interface BorderStyle {
  top?: { style: 'single' | 'double' | 'dashed' | 'dotted'; width: number; color: string }
  bottom?: { style: 'single' | 'double' | 'dashed' | 'dotted'; width: number; color: string }
  left?: { style: 'single' | 'double' | 'dashed' | 'dotted'; width: number; color: string }
  right?: { style: 'single' | 'double' | 'dashed' | 'dotted'; width: number; color: string }
}

// ========== 文档元素定义 ==========

export interface TextRun {
  type: 'text'
  text: string
  style?: FontStyle
  link?: string          // 超链接URL
  bookmark?: string      // 书签名
}

export interface BreakElement {
  type: 'break'
  breakType: 'line' | 'page' | 'column' | 'section'
}

export interface ImageElement {
  type: 'image'
  src: string            // Base64或文件路径
  width?: number         // 宽度(cm)
  height?: number        // 高度(cm)
  altText?: string       // 替代文本
  title?: string         // 标题
  alignment?: 'left' | 'center' | 'right'
  wrapMode?: 'inline' | 'square' | 'tight' | 'behind' | 'front'
}

export interface ParagraphElement {
  type: 'paragraph'
  children: (TextRun | BreakElement | ImageElement)[]
  style?: ParagraphStyle
  numbering?: {
    reference: string    // 编号定义引用
    level: number        // 编号级别
  }
}

// ========== 标题定义 ==========

export interface HeadingElement {
  type: 'heading'
  level: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9
  text: string
  style?: FontStyle
  numbering?: boolean    // 是否自动编号
  bookmarkId?: string    // 书签ID(用于目录链接)
}

// ========== 列表定义 ==========

export interface ListItem {
  text: string
  children?: ListItem[]  // 嵌套列表
  style?: FontStyle
}

export interface ListElement {
  type: 'list'
  listType: 'bullet' | 'number' | 'letter' | 'roman' | 'checkbox'
  items: ListItem[]
  style?: {
    bulletChar?: string  // 自定义项目符号
    startNumber?: number // 起始编号
    indent?: number      // 缩进(cm)
  }
}

// ========== 表格定义 ==========

export interface TableCell {
  content: (ParagraphElement | ImageElement | ListElement)[]
  colspan?: number       // 合并列数
  rowspan?: number       // 合并行数
  style?: {
    backgroundColor?: string
    verticalAlign?: 'top' | 'center' | 'bottom'
    width?: number       // 宽度(cm)
    border?: BorderStyle
    padding?: { top?: number; bottom?: number; left?: number; right?: number }
  }
}

export interface TableRow {
  cells: TableCell[]
  isHeader?: boolean     // 是否为表头行
  height?: number        // 行高(cm)
  cantSplit?: boolean    // 禁止跨页断行
}

export interface TableElement {
  type: 'table'
  rows: TableRow[]
  style?: {
    width?: number | 'auto' | '100%'
    alignment?: 'left' | 'center' | 'right'
    borders?: BorderStyle
    cellMargins?: { top?: number; bottom?: number; left?: number; right?: number }
    alternateRowColors?: [string, string]  // 交替行颜色
  }
}

// ========== 特殊元素 ==========

export interface TableOfContents {
  type: 'toc'
  title?: string
  levels?: number        // 显示级别数 1-9
  showPageNumbers?: boolean
  rightAlignPageNumbers?: boolean
  useHyperlinks?: boolean
}

export interface FootnoteElement {
  type: 'footnote'
  reference: string      // 脚注标记
  content: string        // 脚注内容
}

export interface CommentElement {
  type: 'comment'
  author: string
  date: Date
  content: string
  targetStart: number    // 批注起始位置
  targetEnd: number      // 批注结束位置
}

export interface WatermarkElement {
  type: 'watermark'
  text: string
  style?: {
    font?: string
    size?: number
    color?: string
    opacity?: number     // 透明度 0-1
    rotation?: number    // 旋转角度
  }
}

export interface HeaderFooterElement {
  type: 'header' | 'footer'
  position: 'default' | 'first' | 'even'
  content: (ParagraphElement | ImageElement)[]
}

export interface PageNumberElement {
  type: 'pageNumber'
  format?: 'decimal' | 'roman' | 'romanLower' | 'letter' | 'letterLower'
  start?: number         // 起始页码
  prefix?: string        // 前缀如"第"
  suffix?: string        // 后缀如"页"
}

// ========== 文档结构 ==========

export type DocumentElement = 
  | ParagraphElement 
  | HeadingElement 
  | ListElement 
  | TableElement 
  | ImageElement
  | TableOfContents
  | BreakElement
  | HeaderFooterElement
  | WatermarkElement

export interface DocumentSection {
  elements: DocumentElement[]
  pageSettings?: {
    size?: 'A4' | 'A3' | 'Letter' | 'Legal' | { width: number; height: number }
    orientation?: 'portrait' | 'landscape'
    margins?: { top: number; bottom: number; left: number; right: number }
    columns?: number     // 分栏数
    columnSpacing?: number
  }
  headers?: HeaderFooterElement[]
  footers?: HeaderFooterElement[]
}

export interface WordDocument {
  title: string
  author?: string
  subject?: string
  keywords?: string[]
  description?: string
  created?: Date
  modified?: Date
  sections: DocumentSection[]
  styles?: DocumentStyles
  watermark?: WatermarkElement
}

export interface DocumentStyles {
  defaultFont?: FontStyle
  defaultParagraph?: ParagraphStyle
  headingStyles?: {
    [level: number]: {
      font?: FontStyle
      paragraph?: ParagraphStyle
      numbering?: string  // 编号格式如 "第一章 %1"
    }
  }
  tocStyles?: {
    title?: FontStyle
    entries?: { [level: number]: FontStyle }
  }
}

// ========== 预设样式 ==========

export const PRESET_STYLES = {
  // 正文样式
  normal: {
    font: { name: '微软雅黑', size: 12 } as FontStyle,
    paragraph: { lineSpacing: 1.5, spaceAfter: 6 } as ParagraphStyle,
  },

  // 中文正式公文样式
  officialChinese: {
    font: { name: '仿宋', size: 16 } as FontStyle,
    paragraph: { lineSpacing: 1.5, firstLineIndent: 0.74 } as ParagraphStyle,
  },

  // 标题样式
  heading1: {
    font: { name: '黑体', size: 22, bold: true } as FontStyle,
    paragraph: { alignment: 'center', spaceBefore: 24, spaceAfter: 12 } as ParagraphStyle,
  },
  heading2: {
    font: { name: '黑体', size: 16, bold: true } as FontStyle,
    paragraph: { spaceBefore: 18, spaceAfter: 6 } as ParagraphStyle,
  },
  heading3: {
    font: { name: '黑体', size: 14, bold: true } as FontStyle,
    paragraph: { spaceBefore: 12, spaceAfter: 6 } as ParagraphStyle,
  },

  // 引用样式
  quote: {
    font: { name: '楷体', size: 12, italic: true, color: '#666666' } as FontStyle,
    paragraph: { leftIndent: 1.5, rightIndent: 1.5, lineSpacing: 1.2 } as ParagraphStyle,
  },

  // 代码样式
  code: {
    font: { name: 'Consolas', size: 10 } as FontStyle,
    paragraph: { backgroundColor: '#f5f5f5', leftIndent: 0.5 } as ParagraphStyle,
  },

  // 表格样式
  tableHeader: {
    font: { name: '微软雅黑', size: 11, bold: true, color: '#FFFFFF' } as FontStyle,
    cell: { backgroundColor: '#4472C4', verticalAlign: 'center' as const },
  },
  tableBody: {
    font: { name: '微软雅黑', size: 11 } as FontStyle,
    cell: { verticalAlign: 'center' as const },
  },
}

// ========== 模板定义 ==========

export interface DocumentTemplate {
  id: string
  name: string
  description: string
  category: 'report' | 'contract' | 'proposal' | 'letter' | 'resume' | 'other'
  icon: string
  defaultStyles: DocumentStyles
  sections: DocumentSection[]
  placeholders: { key: string; description: string; required: boolean }[]
}

export const DOCUMENT_TEMPLATES: DocumentTemplate[] = [
  {
    id: 'weekly_report',
    name: '周工作汇报',
    description: '标准周报模板，包含本周工作、成果和下周计划',
    category: 'report',
    icon: '📋',
    defaultStyles: {
      defaultFont: PRESET_STYLES.normal.font,
      defaultParagraph: PRESET_STYLES.normal.paragraph,
      headingStyles: {
        1: { font: PRESET_STYLES.heading1.font, paragraph: PRESET_STYLES.heading1.paragraph },
        2: { font: PRESET_STYLES.heading2.font, paragraph: PRESET_STYLES.heading2.paragraph },
      }
    },
    sections: [{
      elements: [
        { type: 'heading', level: 1, text: '{{title}}' },
        { type: 'paragraph', children: [{ type: 'text', text: '汇报人：{{author}}    日期：{{date}}' }], style: { alignment: 'right' } },
        { type: 'heading', level: 2, text: '一、本周工作概述' },
        { type: 'paragraph', children: [{ type: 'text', text: '{{summary}}' }] },
        { type: 'heading', level: 2, text: '二、重点工作进展' },
        { type: 'paragraph', children: [{ type: 'text', text: '{{progress}}' }] },
        { type: 'heading', level: 2, text: '三、主要成果' },
        { type: 'paragraph', children: [{ type: 'text', text: '{{achievements}}' }] },
        { type: 'heading', level: 2, text: '四、遇到的问题' },
        { type: 'paragraph', children: [{ type: 'text', text: '{{challenges}}' }] },
        { type: 'heading', level: 2, text: '五、下周计划' },
        { type: 'paragraph', children: [{ type: 'text', text: '{{nextWeekPlan}}' }] },
      ] as DocumentElement[],
      pageSettings: { size: 'A4', orientation: 'portrait', margins: { top: 2.54, bottom: 2.54, left: 3.18, right: 3.18 } }
    }],
    placeholders: [
      { key: 'title', description: '报告标题', required: true },
      { key: 'author', description: '汇报人', required: true },
      { key: 'date', description: '日期', required: true },
      { key: 'summary', description: '工作概述', required: true },
      { key: 'progress', description: '工作进展', required: false },
      { key: 'achievements', description: '主要成果', required: false },
      { key: 'challenges', description: '遇到的问题', required: false },
      { key: 'nextWeekPlan', description: '下周计划', required: false },
    ]
  },
  {
    id: 'meeting_minutes',
    name: '会议纪要',
    description: '正式会议纪要模板',
    category: 'report',
    icon: '📝',
    defaultStyles: {
      defaultFont: PRESET_STYLES.officialChinese.font,
      defaultParagraph: PRESET_STYLES.officialChinese.paragraph,
    },
    sections: [{
      elements: [
        { type: 'heading', level: 1, text: '会议纪要' },
        { type: 'paragraph', children: [{ type: 'text', text: '会议主题：{{topic}}' }] },
        { type: 'paragraph', children: [{ type: 'text', text: '会议时间：{{datetime}}' }] },
        { type: 'paragraph', children: [{ type: 'text', text: '会议地点：{{location}}' }] },
        { type: 'paragraph', children: [{ type: 'text', text: '主持人：{{host}}' }] },
        { type: 'paragraph', children: [{ type: 'text', text: '参会人员：{{attendees}}' }] },
        { type: 'paragraph', children: [{ type: 'text', text: '记录人：{{recorder}}' }] },
        { type: 'heading', level: 2, text: '一、会议内容' },
        { type: 'paragraph', children: [{ type: 'text', text: '{{content}}' }] },
        { type: 'heading', level: 2, text: '二、决议事项' },
        { type: 'paragraph', children: [{ type: 'text', text: '{{decisions}}' }] },
        { type: 'heading', level: 2, text: '三、待办事项' },
        { type: 'paragraph', children: [{ type: 'text', text: '{{todos}}' }] },
      ] as DocumentElement[],
      pageSettings: { size: 'A4', orientation: 'portrait', margins: { top: 2.54, bottom: 2.54, left: 3.18, right: 3.18 } }
    }],
    placeholders: [
      { key: 'topic', description: '会议主题', required: true },
      { key: 'datetime', description: '会议时间', required: true },
      { key: 'location', description: '会议地点', required: true },
      { key: 'host', description: '主持人', required: true },
      { key: 'attendees', description: '参会人员', required: true },
      { key: 'recorder', description: '记录人', required: true },
      { key: 'content', description: '会议内容', required: true },
      { key: 'decisions', description: '决议事项', required: false },
      { key: 'todos', description: '待办事项', required: false },
    ]
  },
  {
    id: 'project_proposal',
    name: '项目提案',
    description: '项目立项提案模板',
    category: 'proposal',
    icon: '💡',
    defaultStyles: {
      defaultFont: PRESET_STYLES.normal.font,
      headingStyles: {
        1: { font: PRESET_STYLES.heading1.font, paragraph: PRESET_STYLES.heading1.paragraph },
        2: { font: PRESET_STYLES.heading2.font, paragraph: PRESET_STYLES.heading2.paragraph },
        3: { font: PRESET_STYLES.heading3.font, paragraph: PRESET_STYLES.heading3.paragraph },
      }
    },
    sections: [{
      elements: [
        { type: 'heading', level: 1, text: '{{projectName}}项目提案' },
        { type: 'heading', level: 2, text: '一、项目背景' },
        { type: 'paragraph', children: [{ type: 'text', text: '{{background}}' }] },
        { type: 'heading', level: 2, text: '二、项目目标' },
        { type: 'paragraph', children: [{ type: 'text', text: '{{objectives}}' }] },
        { type: 'heading', level: 2, text: '三、实施方案' },
        { type: 'paragraph', children: [{ type: 'text', text: '{{implementation}}' }] },
        { type: 'heading', level: 2, text: '四、资源需求' },
        { type: 'heading', level: 3, text: '4.1 人力资源' },
        { type: 'paragraph', children: [{ type: 'text', text: '{{humanResources}}' }] },
        { type: 'heading', level: 3, text: '4.2 资金预算' },
        { type: 'paragraph', children: [{ type: 'text', text: '{{budget}}' }] },
        { type: 'heading', level: 2, text: '五、时间计划' },
        { type: 'paragraph', children: [{ type: 'text', text: '{{timeline}}' }] },
        { type: 'heading', level: 2, text: '六、风险分析' },
        { type: 'paragraph', children: [{ type: 'text', text: '{{risks}}' }] },
        { type: 'heading', level: 2, text: '七、预期成果' },
        { type: 'paragraph', children: [{ type: 'text', text: '{{expectedResults}}' }] },
      ] as DocumentElement[],
      pageSettings: { size: 'A4', orientation: 'portrait', margins: { top: 2.54, bottom: 2.54, left: 3.18, right: 3.18 } }
    }],
    placeholders: [
      { key: 'projectName', description: '项目名称', required: true },
      { key: 'background', description: '项目背景', required: true },
      { key: 'objectives', description: '项目目标', required: true },
      { key: 'implementation', description: '实施方案', required: true },
      { key: 'humanResources', description: '人力资源', required: false },
      { key: 'budget', description: '资金预算', required: false },
      { key: 'timeline', description: '时间计划', required: false },
      { key: 'risks', description: '风险分析', required: false },
      { key: 'expectedResults', description: '预期成果', required: false },
    ]
  },
  {
    id: 'contract',
    name: '合同协议',
    description: '标准合同模板',
    category: 'contract',
    icon: '📜',
    defaultStyles: {
      defaultFont: { name: '宋体', size: 12 },
      defaultParagraph: { lineSpacing: 1.5, firstLineIndent: 0.74 },
    },
    sections: [{
      elements: [
        { type: 'heading', level: 1, text: '{{contractTitle}}' },
        { type: 'paragraph', children: [{ type: 'text', text: '合同编号：{{contractNo}}' }], style: { alignment: 'right' } },
        { type: 'paragraph', children: [{ type: 'text', text: '甲方：{{partyA}}' }] },
        { type: 'paragraph', children: [{ type: 'text', text: '乙方：{{partyB}}' }] },
        { type: 'paragraph', children: [{ type: 'text', text: '鉴于双方就{{subject}}事宜达成一致，特签订本合同。' }] },
        { type: 'heading', level: 2, text: '第一条 合同内容' },
        { type: 'paragraph', children: [{ type: 'text', text: '{{content}}' }] },
        { type: 'heading', level: 2, text: '第二条 价款及支付' },
        { type: 'paragraph', children: [{ type: 'text', text: '{{payment}}' }] },
        { type: 'heading', level: 2, text: '第三条 权利义务' },
        { type: 'paragraph', children: [{ type: 'text', text: '{{obligations}}' }] },
        { type: 'heading', level: 2, text: '第四条 违约责任' },
        { type: 'paragraph', children: [{ type: 'text', text: '{{liability}}' }] },
        { type: 'heading', level: 2, text: '第五条 争议解决' },
        { type: 'paragraph', children: [{ type: 'text', text: '{{dispute}}' }] },
        { type: 'heading', level: 2, text: '第六条 其他条款' },
        { type: 'paragraph', children: [{ type: 'text', text: '{{others}}' }] },
        { type: 'paragraph', children: [{ type: 'text', text: '' }] },
        { type: 'paragraph', children: [{ type: 'text', text: '甲方（签章）：                    乙方（签章）：' }] },
        { type: 'paragraph', children: [{ type: 'text', text: '日期：                              日期：' }] },
      ] as DocumentElement[],
      pageSettings: { size: 'A4', orientation: 'portrait', margins: { top: 2.54, bottom: 2.54, left: 3.18, right: 3.18 } }
    }],
    placeholders: [
      { key: 'contractTitle', description: '合同标题', required: true },
      { key: 'contractNo', description: '合同编号', required: true },
      { key: 'partyA', description: '甲方', required: true },
      { key: 'partyB', description: '乙方', required: true },
      { key: 'subject', description: '合同事项', required: true },
      { key: 'content', description: '合同内容', required: true },
      { key: 'payment', description: '价款及支付', required: true },
      { key: 'obligations', description: '权利义务', required: false },
      { key: 'liability', description: '违约责任', required: false },
      { key: 'dispute', description: '争议解决', required: false },
      { key: 'others', description: '其他条款', required: false },
    ]
  },
]

// ========== Word文档生成器类 ==========

class WordDocumentGenerator {
  private currentDocument: WordDocument | null = null

  // 创建新文档
  createDocument(options: {
    title: string
    author?: string
    subject?: string
    keywords?: string[]
    template?: string
  }): WordDocument {
    const template = options.template 
      ? DOCUMENT_TEMPLATES.find(t => t.id === options.template) 
      : null

    this.currentDocument = {
      title: options.title,
      author: options.author || '小智助手',
      subject: options.subject,
      keywords: options.keywords,
      created: new Date(),
      modified: new Date(),
      sections: template ? [...template.sections] : [{
        elements: [],
        pageSettings: {
          size: 'A4',
          orientation: 'portrait',
          margins: { top: 2.54, bottom: 2.54, left: 3.18, right: 3.18 }
        }
      }],
      styles: template?.defaultStyles,
    }

    return this.currentDocument
  }

  // 添加段落
  addParagraph(text: string, style?: { font?: FontStyle; paragraph?: ParagraphStyle }, sectionIndex = 0): void {
    if (!this.currentDocument) throw new Error('请先创建文档')
    
    const paragraph: ParagraphElement = {
      type: 'paragraph',
      children: [{ type: 'text', text, style: style?.font }],
      style: style?.paragraph
    }

    this.currentDocument.sections[sectionIndex].elements.push(paragraph)
  }

  // 添加富文本段落
  addRichParagraph(runs: TextRun[], style?: ParagraphStyle, sectionIndex = 0): void {
    if (!this.currentDocument) throw new Error('请先创建文档')

    const paragraph: ParagraphElement = {
      type: 'paragraph',
      children: runs,
      style
    }

    this.currentDocument.sections[sectionIndex].elements.push(paragraph)
  }

  // 添加标题
  addHeading(text: string, level: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9, options?: { numbering?: boolean; style?: FontStyle }, sectionIndex = 0): void {
    if (!this.currentDocument) throw new Error('请先创建文档')

    const heading: HeadingElement = {
      type: 'heading',
      level,
      text,
      numbering: options?.numbering,
      style: options?.style
    }

    this.currentDocument.sections[sectionIndex].elements.push(heading)
  }

  // 添加列表
  addList(items: string[], listType: 'bullet' | 'number' | 'letter' | 'roman' | 'checkbox' = 'bullet', options?: { startNumber?: number; bulletChar?: string }, sectionIndex = 0): void {
    if (!this.currentDocument) throw new Error('请先创建文档')

    const list: ListElement = {
      type: 'list',
      listType,
      items: items.map(text => ({ text })),
      style: options
    }

    this.currentDocument.sections[sectionIndex].elements.push(list)
  }

  // 添加嵌套列表
  addNestedList(items: ListItem[], listType: 'bullet' | 'number' = 'bullet', sectionIndex = 0): void {
    if (!this.currentDocument) throw new Error('请先创建文档')

    const list: ListElement = {
      type: 'list',
      listType,
      items
    }

    this.currentDocument.sections[sectionIndex].elements.push(list)
  }

  // 添加表格
  addTable(data: string[][], options?: {
    hasHeader?: boolean
    headerStyle?: { font?: FontStyle; backgroundColor?: string }
    bodyStyle?: { font?: FontStyle; alternateColors?: [string, string] }
    columnWidths?: number[]
    alignment?: 'left' | 'center' | 'right'
  }, sectionIndex = 0): void {
    if (!this.currentDocument) throw new Error('请先创建文档')

    const rows: TableRow[] = data.map((rowData, rowIndex) => {
      const isHeader = options?.hasHeader && rowIndex === 0
      
      const cells: TableCell[] = rowData.map((cellText, colIndex) => ({
        content: [{
          type: 'paragraph' as const,
          children: [{ 
            type: 'text' as const, 
            text: cellText, 
            style: isHeader ? options?.headerStyle?.font : options?.bodyStyle?.font 
          }],
          style: { alignment: 'center' as const }
        }],
        style: {
          backgroundColor: isHeader 
            ? options?.headerStyle?.backgroundColor 
            : options?.bodyStyle?.alternateColors?.[rowIndex % 2],
          width: options?.columnWidths?.[colIndex],
          verticalAlign: 'center' as const
        }
      }))

      return { cells, isHeader }
    })

    const table: TableElement = {
      type: 'table',
      rows,
      style: {
        alignment: options?.alignment || 'center',
        width: '100%'
      }
    }

    this.currentDocument.sections[sectionIndex].elements.push(table)
  }

  // 添加图片
  addImage(src: string, options?: {
    width?: number
    height?: number
    alignment?: 'left' | 'center' | 'right'
    altText?: string
    title?: string
  }, sectionIndex = 0): void {
    if (!this.currentDocument) throw new Error('请先创建文档')

    const image: ImageElement = {
      type: 'image',
      src,
      ...options
    }

    this.currentDocument.sections[sectionIndex].elements.push(image)
  }

  // 添加分页符
  addPageBreak(sectionIndex = 0): void {
    if (!this.currentDocument) throw new Error('请先创建文档')

    const pageBreak: BreakElement = {
      type: 'break',
      breakType: 'page'
    }

    this.currentDocument.sections[sectionIndex].elements.push(pageBreak)
  }

  // 添加目录
  addTableOfContents(options?: { title?: string; levels?: number }, sectionIndex = 0): void {
    if (!this.currentDocument) throw new Error('请先创建文档')

    const toc: TableOfContents = {
      type: 'toc',
      title: options?.title || '目录',
      levels: options?.levels || 3,
      showPageNumbers: true,
      rightAlignPageNumbers: true,
      useHyperlinks: true
    }

    this.currentDocument.sections[sectionIndex].elements.push(toc)
  }

  // 设置页眉
  setHeader(content: string, position: 'default' | 'first' | 'even' = 'default', sectionIndex = 0): void {
    if (!this.currentDocument) throw new Error('请先创建文档')

    const header: HeaderFooterElement = {
      type: 'header',
      position,
      content: [{
        type: 'paragraph',
        children: [{ type: 'text', text: content }],
        style: { alignment: 'center' }
      }]
    }

    if (!this.currentDocument.sections[sectionIndex].headers) {
      this.currentDocument.sections[sectionIndex].headers = []
    }
    this.currentDocument.sections[sectionIndex].headers!.push(header)
  }

  // 设置页脚
  setFooter(content: string, position: 'default' | 'first' | 'even' = 'default', sectionIndex = 0): void {
    if (!this.currentDocument) throw new Error('请先创建文档')

    const footer: HeaderFooterElement = {
      type: 'footer',
      position,
      content: [{
        type: 'paragraph',
        children: [{ type: 'text', text: content }],
        style: { alignment: 'center' }
      }]
    }

    if (!this.currentDocument.sections[sectionIndex].footers) {
      this.currentDocument.sections[sectionIndex].footers = []
    }
    this.currentDocument.sections[sectionIndex].footers!.push(footer)
  }

  // 添加水印
  setWatermark(text: string, options?: { font?: string; size?: number; color?: string; opacity?: number; rotation?: number }): void {
    if (!this.currentDocument) throw new Error('请先创建文档')

    this.currentDocument.watermark = {
      type: 'watermark',
      text,
      style: {
        font: options?.font || '微软雅黑',
        size: options?.size || 72,
        color: options?.color || '#CCCCCC',
        opacity: options?.opacity || 0.3,
        rotation: options?.rotation || -45
      }
    }
  }

  // 根据模板填充数据
  fillTemplate(templateId: string, data: Record<string, string>): WordDocument {
    const template = DOCUMENT_TEMPLATES.find(t => t.id === templateId)
    if (!template) throw new Error(`模板不存在: ${templateId}`)

    // 检查必填字段
    for (const placeholder of template.placeholders) {
      if (placeholder.required && !data[placeholder.key]) {
        throw new Error(`缺少必填字段: ${placeholder.description}`)
      }
    }

    // 深拷贝模板
    const doc = this.createDocument({ title: data.title || template.name, template: templateId })

    // 替换占位符
    const replaceInElement = (element: DocumentElement): DocumentElement => {
      const json = JSON.stringify(element)
      let replaced = json
      for (const [key, value] of Object.entries(data)) {
        replaced = replaced.replace(new RegExp(`{{${key}}}`, 'g'), value || '')
      }
      return JSON.parse(replaced)
    }

    doc.sections = doc.sections.map(section => ({
      ...section,
      elements: section.elements.map(replaceInElement)
    }))

    this.currentDocument = doc
    return doc
  }

  // 获取当前文档
  getDocument(): WordDocument | null {
    return this.currentDocument
  }

  // 导出为DOCX格式数据结构 (用于传给实际的docx库或后端处理)
  exportToDocxData(): { document: WordDocument; xml?: string } {
    if (!this.currentDocument) throw new Error('没有可导出的文档')
    
    return {
      document: this.currentDocument,
      xml: this.generateDocxXML()
    }
  }

  // 生成DOCX XML结构 (用于后端处理或直接生成docx文件)
  private generateDocxXML(): string {
    if (!this.currentDocument) return ''

    const doc = this.currentDocument
    let xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
    xml += '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">\n'
    xml += '  <w:body>\n'

    for (const section of doc.sections) {
      for (const element of section.elements) {
        xml += this.elementToXML(element, '    ')
      }
    }

    xml += '  </w:body>\n'
    xml += '</w:document>'

    return xml
  }

  private elementToXML(element: DocumentElement, indent: string): string {
    switch (element.type) {
      case 'paragraph':
        return this.paragraphToXML(element, indent)
      case 'heading':
        return this.headingToXML(element, indent)
      case 'list':
        return this.listToXML(element, indent)
      case 'table':
        return this.tableToXML(element, indent)
      case 'image':
        return this.imageToXML(element, indent)
      case 'break':
        return this.breakToXML(element, indent)
      case 'toc':
        return this.tocToXML(element, indent)
      default:
        return ''
    }
  }

  private paragraphToXML(p: ParagraphElement, indent: string): string {
    let xml = `${indent}<w:p>\n`
    
    if (p.style) {
      xml += `${indent}  <w:pPr>\n`
      if (p.style.alignment) {
        xml += `${indent}    <w:jc w:val="${p.style.alignment}"/>\n`
      }
      xml += `${indent}  </w:pPr>\n`
    }

    for (const child of p.children) {
      if (child.type === 'text') {
        xml += `${indent}  <w:r>\n`
        if (child.style) {
          xml += `${indent}    <w:rPr>\n`
          if (child.style.bold) xml += `${indent}      <w:b/>\n`
          if (child.style.italic) xml += `${indent}      <w:i/>\n`
          if (child.style.size) xml += `${indent}      <w:sz w:val="${child.style.size * 2}"/>\n`
          xml += `${indent}    </w:rPr>\n`
        }
        xml += `${indent}    <w:t>${this.escapeXML(child.text)}</w:t>\n`
        xml += `${indent}  </w:r>\n`
      }
    }

    xml += `${indent}</w:p>\n`
    return xml
  }

  private headingToXML(h: HeadingElement, indent: string): string {
    let xml = `${indent}<w:p>\n`
    xml += `${indent}  <w:pPr>\n`
    xml += `${indent}    <w:pStyle w:val="Heading${h.level}"/>\n`
    xml += `${indent}  </w:pPr>\n`
    xml += `${indent}  <w:r>\n`
    xml += `${indent}    <w:t>${this.escapeXML(h.text)}</w:t>\n`
    xml += `${indent}  </w:r>\n`
    xml += `${indent}</w:p>\n`
    return xml
  }

  private listToXML(list: ListElement, indent: string): string {
    let xml = ''
    const numId = list.listType === 'bullet' ? '1' : '2'

    for (let i = 0; i < list.items.length; i++) {
      const item = list.items[i]
      xml += `${indent}<w:p>\n`
      xml += `${indent}  <w:pPr>\n`
      xml += `${indent}    <w:numPr>\n`
      xml += `${indent}      <w:ilvl w:val="0"/>\n`
      xml += `${indent}      <w:numId w:val="${numId}"/>\n`
      xml += `${indent}    </w:numPr>\n`
      xml += `${indent}  </w:pPr>\n`
      xml += `${indent}  <w:r>\n`
      xml += `${indent}    <w:t>${this.escapeXML(item.text)}</w:t>\n`
      xml += `${indent}  </w:r>\n`
      xml += `${indent}</w:p>\n`
    }

    return xml
  }

  private tableToXML(table: TableElement, indent: string): string {
    let xml = `${indent}<w:tbl>\n`
    xml += `${indent}  <w:tblPr>\n`
    xml += `${indent}    <w:tblStyle w:val="TableGrid"/>\n`
    xml += `${indent}    <w:tblW w:w="5000" w:type="pct"/>\n`
    xml += `${indent}  </w:tblPr>\n`

    for (const row of table.rows) {
      xml += `${indent}  <w:tr>\n`
      for (const cell of row.cells) {
        xml += `${indent}    <w:tc>\n`
        for (const content of cell.content) {
          if (content.type === 'paragraph') {
            xml += this.paragraphToXML(content, indent + '      ')
          }
        }
        xml += `${indent}    </w:tc>\n`
      }
      xml += `${indent}  </w:tr>\n`
    }

    xml += `${indent}</w:tbl>\n`
    return xml
  }

  private imageToXML(img: ImageElement, indent: string): string {
    return `${indent}<!-- Image: ${img.src} -->\n`
  }

  private breakToXML(br: BreakElement, indent: string): string {
    if (br.breakType === 'page') {
      return `${indent}<w:p><w:r><w:br w:type="page"/></w:r></w:p>\n`
    }
    return `${indent}<w:p><w:r><w:br/></w:r></w:p>\n`
  }

  private tocToXML(toc: TableOfContents, indent: string): string {
    let xml = `${indent}<!-- Table of Contents -->\n`
    xml += `${indent}<w:p>\n`
    xml += `${indent}  <w:r>\n`
    xml += `${indent}    <w:fldChar w:fldCharType="begin"/>\n`
    xml += `${indent}  </w:r>\n`
    xml += `${indent}  <w:r>\n`
    xml += `${indent}    <w:instrText> TOC \\o "1-${toc.levels || 3}" \\h \\z \\u </w:instrText>\n`
    xml += `${indent}  </w:r>\n`
    xml += `${indent}  <w:r>\n`
    xml += `${indent}    <w:fldChar w:fldCharType="end"/>\n`
    xml += `${indent}  </w:r>\n`
    xml += `${indent}</w:p>\n`
    return xml
  }

  private escapeXML(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')
  }

  // 导出为HTML格式 (用于预览)
  exportToHTML(): string {
    if (!this.currentDocument) throw new Error('没有可导出的文档')

    const doc = this.currentDocument
    let html = '<!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n'
    html += '<meta charset="UTF-8">\n'
    html += `<title>${this.escapeHTML(doc.title)}</title>\n`
    html += '<style>\n'
    html += this.generateCSS()
    html += '</style>\n'
    html += '</head>\n<body>\n'
    html += '<div class="document">\n'

    for (const section of doc.sections) {
      for (const element of section.elements) {
        html += this.elementToHTML(element)
      }
    }

    html += '</div>\n</body>\n</html>'
    return html
  }

  private generateCSS(): string {
    return `
      body {
        font-family: "微软雅黑", "Microsoft YaHei", sans-serif;
        font-size: 12pt;
        line-height: 1.5;
        color: #333;
        background: #f5f5f5;
        margin: 0;
        padding: 20px;
      }
      .document {
        max-width: 21cm;
        margin: 0 auto;
        padding: 2.54cm 3.18cm;
        background: white;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      }
      h1 { font-size: 22pt; text-align: center; margin: 24pt 0 12pt; }
      h2 { font-size: 16pt; font-weight: bold; margin: 18pt 0 6pt; }
      h3 { font-size: 14pt; font-weight: bold; margin: 12pt 0 6pt; }
      p { margin: 0 0 6pt; text-indent: 2em; }
      ul, ol { margin: 0 0 6pt; padding-left: 2em; }
      table { width: 100%; border-collapse: collapse; margin: 12pt 0; }
      th, td { border: 1px solid #999; padding: 8px; text-align: center; }
      th { background: #4472C4; color: white; }
      tr:nth-child(even) { background: #f2f2f2; }
      img { max-width: 100%; display: block; margin: 12pt auto; }
      .page-break { page-break-before: always; }
      .toc { margin: 24pt 0; }
      .toc-title { font-size: 16pt; font-weight: bold; text-align: center; margin-bottom: 12pt; }
    `
  }

  private elementToHTML(element: DocumentElement): string {
    switch (element.type) {
      case 'paragraph':
        return this.paragraphToHTML(element)
      case 'heading':
        return `<h${element.level}>${this.escapeHTML(element.text)}</h${element.level}>\n`
      case 'list':
        return this.listToHTML(element)
      case 'table':
        return this.tableToHTML(element)
      case 'image':
        return `<img src="${element.src}" alt="${element.altText || ''}" />\n`
      case 'break':
        return element.breakType === 'page' ? '<div class="page-break"></div>\n' : '<br/>\n'
      case 'toc':
        return `<div class="toc"><div class="toc-title">${element.title || '目录'}</div></div>\n`
      default:
        return ''
    }
  }

  private paragraphToHTML(p: ParagraphElement): string {
    let style = ''
    if (p.style?.alignment) style += `text-align: ${p.style.alignment};`
    if (p.style?.firstLineIndent) style += `text-indent: ${p.style.firstLineIndent}cm;`

    let content = ''
    for (const child of p.children) {
      if (child.type === 'text') {
        let text = this.escapeHTML(child.text)
        if (child.style?.bold) text = `<strong>${text}</strong>`
        if (child.style?.italic) text = `<em>${text}</em>`
        if (child.style?.underline) text = `<u>${text}</u>`
        if (child.link) text = `<a href="${child.link}">${text}</a>`
        content += text
      } else if (child.type === 'break') {
        content += '<br/>'
      }
    }

    return `<p${style ? ` style="${style}"` : ''}>${content}</p>\n`
  }

  private listToHTML(list: ListElement): string {
    const tag = list.listType === 'bullet' ? 'ul' : 'ol'
    let html = `<${tag}>\n`

    const renderItem = (item: ListItem): string => {
      let itemHtml = `<li>${this.escapeHTML(item.text)}`
      if (item.children && item.children.length > 0) {
        itemHtml += `\n<${tag}>\n`
        for (const child of item.children) {
          itemHtml += renderItem(child)
        }
        itemHtml += `</${tag}>\n`
      }
      itemHtml += '</li>\n'
      return itemHtml
    }

    for (const item of list.items) {
      html += renderItem(item)
    }

    html += `</${tag}>\n`
    return html
  }

  private tableToHTML(table: TableElement): string {
    let html = '<table>\n'

    for (const row of table.rows) {
      html += '<tr>\n'
      for (const cell of row.cells) {
        const tag = row.isHeader ? 'th' : 'td'
        const colspan = cell.colspan ? ` colspan="${cell.colspan}"` : ''
        const rowspan = cell.rowspan ? ` rowspan="${cell.rowspan}"` : ''
        
        let content = ''
        for (const c of cell.content) {
          if (c.type === 'paragraph') {
            for (const child of c.children) {
              if (child.type === 'text') {
                content += this.escapeHTML(child.text)
              }
            }
          }
        }
        
        html += `<${tag}${colspan}${rowspan}>${content}</${tag}>\n`
      }
      html += '</tr>\n'
    }

    html += '</table>\n'
    return html
  }

  private escapeHTML(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }

  // 获取可用模板列表
  getTemplates(): DocumentTemplate[] {
    return DOCUMENT_TEMPLATES
  }

  // 获取预设样式
  getPresetStyles() {
    return PRESET_STYLES
  }
}

// 导出单例
export const wordGenerator = new WordDocumentGenerator()

// 导出类以便创建多个实例
export { WordDocumentGenerator }
