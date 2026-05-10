/**
 * RecommendationEngine - 智能推荐引擎
 *
 * 功能：
 * - 基于上下文智能推荐（时间、地点、人数、偏好）
 * - 餐厅推荐（适合小酌、商务宴请等）
 * - 酒店推荐（位置、星级、价格）
 * - 行程推荐（接站后的安排）
 * - 自动预定（餐厅、酒店、打车）
 */

import { createServiceLogger } from '../../lib/logger';
const logger = createServiceLogger('RecommendationEngine');

import { AIProviderChain } from '../../lib/ai-provider';
import { randomUUID } from 'crypto';

export interface Location {
  name: string;
  address: string;
  latitude?: number;
  longitude?: number;
}

export interface Restaurant {
  id: string;
  name: string;
  type: string;           // 中餐、西餐、火锅、烧烤...
  category: string;       // 商务、朋友聚会、小酌、约会...
  cuisine: string;        // 川菜、粤菜、湘菜...
  priceRange: '¥' | '¥¥' | '¥¥¥' | '¥¥¥¥';
  rating: number;
  distance?: number;
  location: Location;
  features: string[];     // 停车、包间、室外...
  openingHours: string;
  phone?: string;
  image?: string;
}

export interface Hotel {
  id: string;
  name: string;
  type: string;           // 经济型、连锁、商务、豪华
  starRating: number;
  priceRange: string;     // "300-500"
  location: Location;
  distanceToStation?: number;
  features: string[];     // 免费停车、早餐、健身房...
  checkInTime: string;
  checkOutTime: string;
  rating: number;
  phone?: string;
  image?: string;
}

export interface Recommendation {
  id: string;
  type: 'restaurant' | 'hotel' | 'attraction' | 'route' | 'service';

  // 基本信息
  name: string;
  description: string;
  reason: string;         // 为什么推荐

  // 详情
  details: Restaurant | Hotel | any;

  // 评分
  matchScore: number;     // 0-100，与需求的匹配度

  // 操作
  actions: RecommendedAction[];

  // 标签
  tags: string[];
}

export interface RecommendedAction {
  type: 'navigate' | 'call' | 'book' | 'order' | 'share';
  label: string;
  icon: string;
  params: Record<string, any>;
}

export interface BookingRequest {
  type: 'restaurant' | 'hotel' | 'taxi';
  itemId: string;
  date?: Date;
  time?: string;
  partySize?: number;
  name: string;
  phone: string;
  notes?: string;
}

export interface BookingResult {
  success: boolean;
  bookingId?: string;
  confirmationCode?: string;
  details?: unknown;
  error?: string;
  alternative?: Recommendation;
}

class RecommendationEngine {
  private static instance: RecommendationEngine | null = null;

  private aiProvider: AIProviderChain;

  // 模拟数据（在实际项目中应该从数据库或第三方API获取）
  private restaurants: Restaurant[] = [];
  private hotels: Hotel[] = [];

  private constructor() {
    this.aiProvider = new AIProviderChain();
    this.initializeMockData();
  }

  public static getInstance(): RecommendationEngine {
    if (!RecommendationEngine.instance) {
      RecommendationEngine.instance = new RecommendationEngine();
    }
    return RecommendationEngine.instance;
  }

  /**
   * 初始化模拟数据
   */
  private initializeMockData(): void {
    // 郑州附近的模拟餐厅数据
    this.restaurants = [
      {
        id: 'rest_001',
        name: '鲁班张酒店',
        type: '中餐',
        category: '商务宴请',
        cuisine: '豫菜',
        priceRange: '¥¥¥',
        rating: 4.8,
        distance: 3.5,
        location: {
          name: '郑州东站附近',
          address: '郑州市郑东新区东风路东段',
        },
        features: ['包间', '停车', '商务'],
        openingHours: '10:00-22:00',
        phone: '0371-6588****',
      },
      {
        id: 'rest_002',
        name: '二合馆',
        type: '中餐',
        category: '朋友聚会',
        cuisine: '融合菜',
        priceRange: '¥¥',
        rating: 4.6,
        distance: 2.1,
        location: {
          name: '金水区',
          address: '郑州市金水区花园路',
        },
        features: ['小酌', '氛围好', '停车'],
        openingHours: '11:00-23:00',
      },
      {
        id: 'rest_003',
        name: '胡桃里音乐酒馆',
        type: '酒吧餐厅',
        category: '小酌',
        cuisine: '融合菜',
        priceRange: '¥¥',
        rating: 4.5,
        distance: 4.2,
        location: {
          name: '郑东新区',
          address: '郑州市郑东新区商务外环路',
        },
        features: ['驻唱', '小酌', '夜生活'],
        openingHours: '17:00-02:00',
      },
      {
        id: 'rest_004',
        name: '粤庭私房菜',
        type: '中餐',
        category: '高端商务',
        cuisine: '粤菜',
        priceRange: '¥¥¥¥',
        rating: 4.9,
        distance: 5.8,
        location: {
          name: '郑东新区',
          address: '郑州市郑东新区如意湖附近',
        },
        features: ['包间', '停车', '高端'],
        openingHours: '11:00-14:00, 17:00-22:00',
      },
    ];

    // 模拟酒店数据
    this.hotels = [
      {
        id: 'hotel_001',
        name: '雅高美爵酒店',
        type: '五星级',
        starRating: 5,
        priceRange: '600-900',
        location: {
          name: '郑东新区',
          address: '郑州市郑东新区金水东路',
        },
        distanceToStation: 2.5,
        features: ['免费停车', '早餐', '健身房', '接站服务'],
        checkInTime: '14:00',
        checkOutTime: '12:00',
        rating: 4.8,
      },
      {
        id: 'hotel_002',
        name: '建国饭店',
        type: '商务酒店',
        starRating: 4,
        priceRange: '400-600',
        location: {
          name: '金水区',
          address: '郑州市金水区花园路',
        },
        distanceToStation: 3.8,
        features: ['免费停车', '早餐', '商务中心'],
        checkInTime: '14:00',
        checkOutTime: '12:00',
        rating: 4.6,
      },
      {
        id: 'hotel_003',
        name: '全季酒店',
        type: '连锁商务',
        starRating: 3,
        priceRange: '200-350',
        location: {
          name: '郑州东站',
          address: '郑州市管城区郑州东站附近',
        },
        distanceToStation: 0.8,
        features: ['免费停车', '早餐'],
        checkInTime: '14:00',
        checkOutTime: '12:00',
        rating: 4.4,
      },
    ];
  }

  /**
   * 智能推荐
   */
  public async recommend(params: {
    type: 'restaurant' | 'hotel' | 'both';
    location?: string;
    time?: Date;
    partySize?: number;
    purpose?: string;     // 商务、朋友聚会、小酌、家庭...
    budget?: string;
    preferences?: string[];
    excludeIds?: string[];
  }): Promise<Recommendation[]> {
    logger.info({ params }, 'Generating recommendations');

    const recommendations: Recommendation[] = [];

    // 餐厅推荐
    if (params.type === 'restaurant' || params.type === 'both') {
      const restaurantRecs = this.recommendRestaurants(params);
      recommendations.push(...restaurantRecs);
    }

    // 酒店推荐
    if (params.type === 'hotel' || params.type === 'both') {
      const hotelRecs = this.recommendHotels(params);
      recommendations.push(...hotelRecs);
    }

    // 按匹配度排序
    recommendations.sort((a, b) => b.matchScore - a.matchScore);

    // 使用AI优化推荐理由
    for (const rec of recommendations) {
      rec.reason = await this.generateRecommendationReason(rec, params);
    }

    return recommendations.slice(0, 5); // 返回前5个
  }

  /**
   * 推荐餐厅
   */
  private recommendRestaurants(params: {
    location?: string;
    purpose?: string;
    partySize?: number;
    budget?: string;
    preferences?: string[];
    excludeIds?: string[];
  }): Recommendation[] {
    let filtered = [...this.restaurants];

    // 过滤
    if (params.excludeIds) {
      filtered = filtered.filter(r => !params.excludeIds!.includes(r.id));
    }

    if (params.purpose === '小酌' || params.purpose === '朋友聚会') {
      filtered = filtered.filter(r =>
        r.features.includes('小酌') ||
        r.category === '朋友聚会' ||
        r.category === '小酌'
      );
    }

    if (params.purpose === '商务') {
      filtered = filtered.filter(r =>
        r.category.includes('商务') ||
        r.features.includes('包间')
      );
    }

    if (params.budget === 'low') {
      filtered = filtered.filter(r => r.priceRange === '¥' || r.priceRange === '¥¥');
    } else if (params.budget === 'high') {
      filtered = filtered.filter(r => r.priceRange === '¥¥¥' || r.priceRange === '¥¥¥¥');
    }

    // 计算匹配度
    const scored = filtered.map(r => {
      let score = 60; // 基础分

      // 评分加成
      score += r.rating * 5;

      // 距离加成
      if (r.distance && r.distance < 3) score += 15;
      else if (r.distance && r.distance < 5) score += 10;

      // 目的匹配加成
      if (params.purpose === '小酌' && r.features.includes('小酌')) score += 20;
      if (params.purpose === '商务' && r.features.includes('包间')) score += 20;

      return {
        recommendation: this.createRestaurantRecommendation(r, score),
        score,
      };
    });

    return scored.map(s => s.recommendation);
  }

  /**
   * 推荐酒店
   */
  private recommendHotels(params: {
    location?: string;
    budget?: string;
    excludeIds?: string[];
  }): Recommendation[] {
    let filtered = [...this.hotels];

    if (params.excludeIds) {
      filtered = filtered.filter(h => !params.excludeIds!.includes(h.id));
    }

    if (params.budget === 'low') {
      filtered = filtered.filter(h => h.starRating <= 3);
    } else if (params.budget === 'high') {
      filtered = filtered.filter(h => h.starRating >= 4);
    }

    // 计算匹配度
    const scored = filtered.map(h => {
      let score = 60;

      score += h.rating * 5;

      // 距离高铁站近加成
      if (h.distanceToStation && h.distanceToStation < 3) score += 20;
      else if (h.distanceToStation && h.distanceToStation < 5) score += 10;

      // 星级加成
      score += (h.starRating - 3) * 5;

      return {
        recommendation: this.createHotelRecommendation(h, score),
        score,
      };
    });

    return scored.map(s => s.recommendation);
  }

  /**
   * 创建餐厅推荐
   */
  private createRestaurantRecommendation(restaurant: Restaurant, score: number): Recommendation {
    return {
      id: `rec_${randomUUID().slice(0, 8)}`,
      type: 'restaurant',
      name: restaurant.name,
      description: `${restaurant.cuisine} | ${restaurant.priceRange} | 评分 ${restaurant.rating}`,
      reason: '',
      details: restaurant,
      matchScore: Math.min(100, score),
      actions: [
        {
          type: 'navigate',
          label: '导航',
          icon: 'navigation',
          params: { location: restaurant.location },
        },
        {
          type: 'call',
          label: '打电话',
          icon: 'phone',
          params: { phone: restaurant.phone },
        },
        {
          type: 'book',
          label: '订座',
          icon: 'calendar',
          params: { restaurantId: restaurant.id },
        },
        {
          type: 'share',
          label: '分享',
          icon: 'share',
          params: { restaurant },
        },
      ],
      tags: [restaurant.category, restaurant.cuisine, ...restaurant.features],
    };
  }

  /**
   * 创建酒店推荐
   */
  private createHotelRecommendation(hotel: Hotel, score: number): Recommendation {
    return {
      id: `rec_${randomUUID().slice(0, 8)}`,
      type: 'hotel',
      name: hotel.name,
      description: `${hotel.starRating}星 | ${hotel.priceRange}元 | 距车站 ${hotel.distanceToStation}km`,
      reason: '',
      details: hotel,
      matchScore: Math.min(100, score),
      actions: [
        {
          type: 'navigate',
          label: '导航',
          icon: 'navigation',
          params: { location: hotel.location },
        },
        {
          type: 'call',
          label: '打电话',
          icon: 'phone',
          params: { phone: hotel.phone },
        },
        {
          type: 'book',
          label: '订房',
          icon: 'bed',
          params: { hotelId: hotel.id },
        },
        {
          type: 'share',
          label: '分享',
          icon: 'share',
          params: { hotel },
        },
      ],
      tags: [hotel.type, `${hotel.starRating}星`, ...hotel.features],
    };
  }

  /**
   * 使用AI生成推荐理由
   */
  private async generateRecommendationReason(
    recommendation: Recommendation,
    params: {
      purpose?: string;
      location?: string;
      time?: Date;
    }
  ): Promise<string> {
    const systemPrompt = `根据以下信息，生成一句简洁的推荐理由（15字以内）：

推荐项：${recommendation.name}
推荐类型：${recommendation.type}
用户目的：${params.purpose || '通用'}
用户位置：${params.location || '未知'}

要求：
- 突出推荐亮点
- 简洁明了
- 中文回复`;

    const reason = await this.aiProvider.chat('', systemPrompt, {
      temperature: 0.5,
      maxTokens: 50,
    });

    return reason.trim().substring(0, 20);
  }

  /**
   * 预订
   */
  public async book(request: BookingRequest): Promise<BookingResult> {
    logger.info({ type: request.type, itemId: request.itemId }, 'Processing booking');

    // 实际应该调用第三方预订API
    // 这里模拟成功
    await new Promise(r => setTimeout(r, 500)); // 模拟延迟

    return {
      success: true,
      bookingId: `book_${randomUUID().slice(0, 8)}`,
      confirmationCode: this.generateConfirmationCode(),
      details: {
        ...request,
        status: 'confirmed',
        createdAt: new Date(),
      },
    };
  }

  /**
   * 生成确认码
   */
  private generateConfirmationCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }

  /**
   * 获取用户偏好
   */
  public async getUserPreferences(userId: string): Promise<{
    favoriteCuisines: string[];
    budgetLevel: string;
    preferredHotelTypes: string[];
  }> {
    // 实际应该从数据库读取
    return {
      favoriteCuisines: ['川菜', '粤菜'],
      budgetLevel: 'medium',
      preferredHotelTypes: ['商务', '连锁'],
    };
  }

  /**
   * 记录用户反馈
   */
  public async recordFeedback(
    recommendationId: string,
    action: 'view' | 'click' | 'book' | 'dismiss'
  ): Promise<void> {
    logger.info({ recommendationId, action }, 'Recording feedback');
    // 实际应该记录到数据库用于学习
  }
}

export const recommendationEngine = RecommendationEngine.getInstance();
export default recommendationEngine;
