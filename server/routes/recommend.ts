/**
 * 智能推荐 API - Recommendation Engine API
 */

import { Router, Request, Response } from 'express';
import { recommendationEngine } from '../services/agent/RecommendationEngine';
import { proactiveAgent } from '../services/agent/ProactiveAgent';
import { voicePrintAgent } from '../services/agent/VoicePrintAgent';
import { createServiceLogger } from '../lib/logger';
import { attachRole } from '../middleware/auth';

const router = Router();
const logger = createServiceLogger('RecommendRoutes');

router.use(attachRole);

/**
 * POST /api/recommend
 * 智能推荐
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      type,           // 'restaurant' | 'hotel' | 'both'
      location,
      time,
      partySize,
      purpose,        // '商务' | '朋友聚会' | '小酌' | '家庭'
      budget,         // 'low' | 'medium' | 'high'
      preferences,
      context         // 可选的对话上下文
    } = req.body;

    // 如果有上下文（对话内容），先分析
    if (context?.conversation) {
      const dialogue = await voicePrintAgent.processTextDialogue(context.conversation, {
        source: context.source,
        participants: context.participants,
      });

      // 从对话中提取推荐相关的信息
      const extractedContext = extractRecommendationContext(dialogue);
      Object.assign(req.body, extractedContext);
    }

    const recommendations = await recommendationEngine.recommend({
      type: type || 'both',
      location: location || req.body.location,
      time: time ? new Date(time) : undefined,
      partySize: partySize || req.body.partySize,
      purpose: purpose || req.body.purpose,
      budget: budget || req.body.budget,
      preferences,
    });

    // 记录反馈
    for (const rec of recommendations) {
      recommendationEngine.recordFeedback(rec.id, 'view');
    }

    res.json({
      success: true,
      recommendations,
    });

  } catch (error) {
    logger.error({ err: error }, 'Failed to get recommendations');
    res.status(500).json({ success: false, error: '推荐失败' });
  }
});

/**
 * 从对话分析中提取推荐相关上下文
 */
interface DialogueResult {
  commitments?: Array<{ content: string; relatedEntity?: string }>;
}

function extractRecommendationContext(dialogue: DialogueResult): Record<string, string> {
  const context: Record<string, string> = {};

  // 提取地点
  for (const commitment of dialogue.commitments || []) {
    if (commitment.content.includes('酒店') || commitment.content.includes('住')) {
      context.purpose = '住宿';
    }
    if (commitment.content.includes('吃饭') || commitment.content.includes('小酌')) {
      context.purpose = '小酌';
    }
    if (commitment.content.includes('接')) {
      context.location = commitment.relatedEntity || dialogue.commitments?.find((c) =>
        c.content.includes('站')
      )?.content;
    }
  }

  return context;
}

/**
 * POST /api/recommend/restaurants
 * 餐厅推荐
 */
router.post('/restaurants', async (req: Request, res: Response) => {
  try {
    const { location, purpose, partySize, budget, preferences } = req.body;

    const recommendations = await recommendationEngine.recommend({
      type: 'restaurant',
      location,
      partySize,
      purpose,
      budget,
      preferences,
    });

    res.json({
      success: true,
      recommendations,
    });

  } catch (error) {
    res.status(500).json({ success: false, error: '推荐失败' });
  }
});

/**
 * POST /api/recommend/hotels
 * 酒店推荐
 */
router.post('/hotels', async (req: Request, res: Response) => {
  try {
    const { location, budget, checkInDate, checkOutDate } = req.body;

    const recommendations = await recommendationEngine.recommend({
      type: 'hotel',
      location,
      budget,
    });

    res.json({
      success: true,
      recommendations,
    });

  } catch (error) {
    res.status(500).json({ success: false, error: '推荐失败' });
  }
});

/**
 * POST /api/recommend/book
 * 预订
 */
router.post('/book', async (req: Request, res: Response) => {
  try {
    const { type, itemId, date, time, partySize, name, phone, notes } = req.body;

    if (!type || !itemId || !name || !phone) {
      res.status(400).json({
        success: false,
        error: '缺少必要参数：type, itemId, name, phone'
      });
      return;
    }

    const result = await recommendationEngine.book({
      type,
      itemId,
      date: date ? new Date(date) : undefined,
      time,
      partySize,
      name,
      phone,
      notes,
    });

    // 记录反馈
    if (result.success) {
      recommendationEngine.recordFeedback(itemId, 'book');
    }

    res.json(result);

  } catch (error) {
    logger.error({ err: error }, 'Booking failed');
    res.status(500).json({ success: false, error: '预订失败' });
  }
});

/**
 * POST /api/recommend/from-conversation
 * 从对话内容直接推荐
 *
 * 例如：处理"陈哥要来了，帮他安排酒店和晚上小酌的地方"
 */
router.post('/from-conversation', async (req: Request, res: Response) => {
  try {
    const { conversation, source, participants } = req.body;

    // 1. 分析对话，提取承诺和约定
    const dialogue = await proactiveAgent.processConversation(conversation, {
      source: source || 'wechat',
      participants: participants || [],
    });

    // 2. 确定推荐类型
    let recommendType = 'both';
    let purpose = '';

    for (const commitment of dialogue.commitments) {
      if (commitment.type === 'pickup' || commitment.title.includes('接')) {
        recommendType = 'both'; // 需要酒店+餐厅
      }
      if (commitment.title.includes('小酌') || commitment.title.includes('酒')) {
        purpose = '小酌';
      }
    }

    // 3. 提取地点
    let location = '';
    for (const commitment of dialogue.commitments) {
      if (commitment.location) {
        location = commitment.location;
        break;
      }
    }

    // 4. 生成推荐
    const recommendations = await recommendationEngine.recommend({
      type: recommendType,
      location,
      purpose: purpose || undefined,
    });

    // 5. 组合响应
    const restaurantRecs = recommendations.filter(r => r.type === 'restaurant');
    const hotelRecs = recommendations.filter(r => r.type === 'hotel');

    res.json({
      success: true,
      dialogue: {
        summary: dialogue.commitments.map(c => c.title).join(', '),
        commitments: dialogue.commitments,
      },
      recommendations: {
        restaurants: restaurantRecs,
        hotels: hotelRecs,
      },
      suggestion: generateAutoArrangementSuggestion(dialogue.commitments, restaurantRecs, hotelRecs),
    });

  } catch (error) {
    logger.error({ err: error }, 'Failed to recommend from conversation');
    res.status(500).json({ success: false, error: '处理失败' });
  }
});

/**
 * 生成自动安排建议
 */
interface CommitmentItem {
  type?: string;
  title?: string;
  startTime?: Date | string;
  location?: string;
}

interface RecommendationItem {
  type: string;
  name: string;
}

function generateAutoArrangementSuggestion(
  commitments: CommitmentItem[],
  restaurants: RecommendationItem[],
  hotels: RecommendationItem[]
): string {
  const pickup = commitments.find(c => c.type === 'pickup');
  const hasDrinking = commitments.some(c =>
    c.title?.includes('酒') || c.title?.includes('酌')
  );

  const parts: string[] = [];

  if (pickup) {
    parts.push(`🚗 ${pickup.startTime ?? ''} 接站`);
  }

  if (hasDrinking && restaurants.length > 0) {
    parts.push(`🍺 晚餐推荐：${restaurants[0].name}`);
  }

  if (hotels.length > 0) {
    parts.push(`🏨 住宿推荐：${hotels[0].name}`);
  }

  return parts.join(' | ');
}

/**
 * GET /api/recommend/categories
 * 获取推荐分类
 */
router.get('/categories', (req: Request, res: Response) => {
  res.json({
    success: true,
    categories: {
      restaurant: {
        purposes: ['商务宴请', '朋友聚会', '小酌', '约会', '家庭聚餐', '随便吃吃'],
        cuisines: ['川菜', '粤菜', '湘菜', '豫菜', '火锅', '烧烤', '西餐', '日料'],
        priceRanges: ['¥', '¥¥', '¥¥¥', '¥¥¥¥'],
      },
      hotel: {
        types: ['经济型', '连锁商务', '四星级', '五星级', '民宿'],
        features: ['免费停车', '早餐', '接站服务', '健身房', '游泳池'],
      },
    },
  });
});

export default router;
