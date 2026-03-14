/**
 * AI Client implementations
 */

import Anthropic from '@anthropic-ai/sdk';
import type { AIClient, AIConfigWithSecret, AnalysisResult, AIProvider } from './types';

/**
 * OpenAI-compatible AI Client
 * Supports: Anthropic, OpenAI, DeepSeek, and other OpenAI-compatible APIs
 */
export class OpenAICompatibleClient implements AIClient {
  provider: AIProvider = 'openai-compatible';
  private config: AIConfigWithSecret;
  private client: any;

  constructor(config: AIConfigWithSecret) {
    this.config = config;

    // Detect provider based on baseUrl
    const baseUrl = config.baseUrl || '';

    if (baseUrl.includes('anthropic.com')) {
      // Use Anthropic SDK
      this.client = new Anthropic({
        apiKey: config.apiKey,
        baseURL: config.baseUrl,
      });
    } else {
      // Use generic OpenAI-compatible client
      // For now, we'll use fetch directly
      this.client = null;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      if (this.client instanceof Anthropic) {
        // Test Anthropic connection
        const response = await this.client.messages.create({
          model: this.config.model,
          max_tokens: 10,
          messages: [{ role: 'user', content: 'test' }],
        });
        return !!response;
      } else {
        // Test generic OpenAI-compatible API
        const response = await fetch(`${this.config.baseUrl}/models`, {
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
          },
        });
        return response.ok;
      }
    } catch (error) {
      console.error('AI connection test failed:', error);
      return false;
    }
  }

  async analyze(prompt: string, code: string): Promise<AnalysisResult> {
    try {
      if (this.client instanceof Anthropic) {
        return await this.analyzeWithAnthropic(prompt, code);
      } else {
        return await this.analyzeWithOpenAI(prompt, code);
      }
    } catch (error) {
      console.error('AI analysis failed:', error);
      throw new Error('Failed to analyze code with AI');
    }
  }

  private async analyzeWithAnthropic(prompt: string, code: string): Promise<AnalysisResult> {
    const fullPrompt = `${prompt}\n\nCode to analyze:\n\`\`\`\n${code}\n\`\`\`\n\nPlease provide your analysis in JSON format with the following structure:
{
  "summary": "Overall summary of the code quality",
  "score": 85,
  "categoryScores": {
    "style": 90,
    "security": 80,
    "architecture": 85,
    "performance": 85,
    "maintainability": 80
  },
  "issues": [
    {
      "category": "security",
      "severity": "error",
      "message": "Issue description",
      "file": "path/to/file.ts",
      "line": 42
    }
  ]
}`;

    const response = await this.client.messages.create({
      model: this.config.model,
      max_tokens: this.config.maxTokens || 4096,
      temperature: this.config.temperature || 0.7,
      messages: [{ role: 'user', content: fullPrompt }],
    });

    const content = response.content[0].text;

    // Try to extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    // Fallback: parse as plain text
    return {
      summary: content,
      score: 70,
      categoryScores: {},
      issues: [],
    };
  }

  private async analyzeWithOpenAI(prompt: string, code: string): Promise<AnalysisResult> {
    const fullPrompt = `${prompt}\n\nCode to analyze:\n\`\`\`\n${code}\n\`\`\`\n\nPlease provide your analysis in JSON format.`;

    const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [{ role: 'user', content: fullPrompt }],
        max_tokens: this.config.maxTokens || 4096,
        temperature: this.config.temperature || 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;

    // Try to extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    // Fallback
    return {
      summary: content,
      score: 70,
      categoryScores: {},
      issues: [],
    };
  }

  async *streamAnalyze(prompt: string, code: string): AsyncGenerator<string> {
    const fullPrompt = `${prompt}\n\nCode to analyze:\n\`\`\`\n${code}\n\`\`\``;

    if (this.client instanceof Anthropic) {
      const stream = await this.client.messages.create({
        model: this.config.model,
        max_tokens: this.config.maxTokens || 4096,
        temperature: this.config.temperature || 0.7,
        messages: [{ role: 'user', content: fullPrompt }],
        stream: true,
      });

      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          yield event.delta.text;
        }
      }
    } else {
      // OpenAI-compatible streaming
      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [{ role: 'user', content: fullPrompt }],
          max_tokens: this.config.maxTokens || 4096,
          temperature: this.config.temperature || 0.7,
          stream: true,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error('Failed to start streaming');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter((line) => line.trim().startsWith('data: '));

        for (const line of lines) {
          const data = line.replace('data: ', '');
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices[0]?.delta?.content;
            if (content) {
              yield content;
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    }
  }
}
