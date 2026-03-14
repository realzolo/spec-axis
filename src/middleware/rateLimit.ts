/**
 * API 速率限制中间件
 * 支持基于 IP 和用户的限流
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

interface RateLimitConfig {
  windowMs: number; // 时间窗口（毫秒）
  maxRequests: number; // 时间窗口内最大请求数
}

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

const store: RateLimitStore = {};

// 清理过期的限流记录
setInterval(() => {
  const now = Date.now();
  for (const key in store) {
    if (store[key].resetTime < now) {
      delete store[key];
    }
  }
}, 60000); // 每分钟清理一次

export function createRateLimiter(config: RateLimitConfig) {
  return function rateLimiter(request: NextRequest) {
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const key = `rate-limit:${ip}`;
    const now = Date.now();

    if (!store[key]) {
      store[key] = {
        count: 1,
        resetTime: now + config.windowMs,
      };
      return null; // 允许请求
    }

    const record = store[key];

    // 检查是否超过时间窗口
    if (now > record.resetTime) {
      record.count = 1;
      record.resetTime = now + config.windowMs;
      return null; // 允许请求
    }

    // 检查是否超过限制
    if (record.count >= config.maxRequests) {
      const retryAfter = Math.ceil((record.resetTime - now) / 1000);
      return NextResponse.json(
        { error: 'Too many requests' },
        {
          status: 429,
          headers: {
            'Retry-After': retryAfter.toString(),
            'X-RateLimit-Limit': config.maxRequests.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': record.resetTime.toString(),
          },
        }
      );
    }

    record.count++;
    return null; // 允许请求
  };
}

// 预定义的限流配置
export const RATE_LIMITS = {
  // 分析 API：每分钟 10 个请求
  analyze: {
    windowMs: 60000,
    maxRequests: 10,
  },
  // 通用 API：每分钟 60 个请求
  general: {
    windowMs: 60000,
    maxRequests: 60,
  },
  // 严格限制：每分钟 5 个请求
  strict: {
    windowMs: 60000,
    maxRequests: 5,
  },
};
