/**
 * AI analysis service - uses the new integration system
 */

import { resolveAIIntegration } from './integrations';
import type { AIClient } from './integrations';
import { detectLanguagesInDiff, getLanguageSpecificRules, LANGUAGE_CONFIGS } from './languages';

export interface ReviewResult {
  score: number;
  categoryScores: Record<string, number>;
  issues: Array<{
    file: string;
    line?: number;
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
    category: string;
    rule: string;
    message: string;
    suggestion?: string;
    codeSnippet?: string;
    fixPatch?: string;
    priority?: number;
    impactScope?: string;
    estimatedEffort?: string;
  }>;
  summary: string;
  complexityMetrics?: {
    cyclomaticComplexity: number;
    cognitiveComplexity: number;
    averageFunctionLength: number;
    maxFunctionLength: number;
    totalFunctions: number;
  };
  duplicationMetrics?: {
    duplicatedLines: number;
    duplicatedBlocks: number;
    duplicationRate: number;
    duplicatedFiles: string[];
  };
  dependencyMetrics?: {
    totalDependencies: number;
    outdatedDependencies: number;
    circularDependencies: string[];
    unusedDependencies: string[];
  };
  securityFindings?: Array<{
    type: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    description: string;
    file: string;
    line?: number;
    cwe?: string;
  }>;
  performanceFindings?: Array<{
    type: string;
    description: string;
    file: string;
    line?: number;
    impact: string;
  }>;
  aiSuggestions?: Array<{
    type: string;
    title: string;
    description: string;
    priority: number;
    estimatedImpact: string;
  }>;
  codeExplanations?: Array<{
    file: string;
    line?: number;
    complexity: string;
    explanation: string;
    recommendation: string;
  }>;
  contextAnalysis?: {
    changeType: string;
    businessImpact: string;
    riskLevel: string;
    affectedModules: string[];
    breakingChanges: boolean;
  };
}

export interface ReviewIssue {
  file: string;
  line?: number;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  category: string;
  rule: string;
  message: string;
  suggestion?: string;
  codeSnippet?: string;
  fixPatch?: string;
  priority?: number;
  impactScope?: string;
  estimatedEffort?: string;
}

export interface RuleInput {
  category: string;
  name: string;
  prompt: string;
  severity: string;
}

export async function analyzeCode(
  diff: string,
  rules: RuleInput[],
  projectId: string
): Promise<ReviewResult> {
  // Get AI client for the project
  const { client } = await resolveAIIntegration(projectId);

  // Detect languages in the diff
  const detectedLanguages = detectLanguagesInDiff(diff);
  const languageInfo = detectedLanguages.length > 0
    ? `\n## 检测到的编程语言\n${detectedLanguages.map(lang => `- ${LANGUAGE_CONFIGS[lang].name}`).join('\n')}\n`
    : '';

  // Add language-specific rules
  const languageSpecificRules = detectedLanguages.flatMap(lang =>
    getLanguageSpecificRules(lang).map((rule) => ({
      category: 'style',
      name: `${LANGUAGE_CONFIGS[lang].name} - ${rule}`,
      prompt: rule,
      severity: 'info',
    }))
  );

  const allRules = [...rules, ...languageSpecificRules];

  const rulesText = allRules
    .map((r, i) => `${i + 1}. [${r.category.toUpperCase()}] ${r.name}: ${r.prompt}`)
    .join('\n');

  const prompt = buildAnalysisPrompt(languageInfo, rulesText, diff);

  // Use the generic AI client interface
  const result = await client.analyze(prompt, '');

  return result as ReviewResult;
}

function buildAnalysisPrompt(languageInfo: string, rulesText: string, diff: string): string {
  return `你是一位资深代码审查专家。请对以下代码变更进行全面、深入的分析，并提供结构化的反馈。
${languageInfo}
## 审查规则
${rulesText}

## 代码变更 (Git Diff)
\`\`\`diff
${diff.slice(0, 150000)}
\`\`\`

## 分析要求

### 1. 基础代码审查
- 根据所有适用规则审查每个变更的文件
- 识别具体问题，包含文件路径和行号
- 为每个类别评分（0-100分）
- 总分是各类别分数的加权平均值
- 提供具体、可操作的修复建议

### 2. 多维度质量分析
**代码复杂度分析**：
- 计算圈复杂度和认知复杂度
- 识别过长函数和深层嵌套
- 评估代码可读性

**代码重复度检测**：
- 识别重复的代码块
- 计算重复率
- 建议重构方案

**依赖关系分析**：
- 检测循环依赖
- 识别未使用的依赖
- 评估依赖健康度

### 3. 智能问题优先级
为每个问题评估：
- **优先级**（1-5，5最高）：基于严重程度和影响范围
- **影响范围**：描述问题影响的模块/功能
- **修复成本**：估算修复所需时间（低/中/高）
- **代码片段**：提取问题相关的代码
- **修复补丁**：如果可能，提供具体的修复代码

### 4. 上下文感知分析
分析代码变更的：
- **变更类型**：新功能/Bug修复/重构/性能优化等
- **业务影响**：对用户/系统的影响
- **风险等级**：低/中/高/严重
- **影响模块**：列出受影响的模块
- **破坏性变更**：是否包含API变更、数据库迁移等

### 5. 安全漏洞深度扫描
检测：
- SQL注入、XSS、CSRF等OWASP Top 10漏洞
- 硬编码的敏感信息（API密钥、密码、token）
- 不安全的加密算法
- 权限控制缺陷
- 为每个安全问题标注CWE编号

### 6. 性能分析
识别：
- 性能瓶颈代码
- 算法复杂度问题（O(n²)及以上）
- 不必要的循环和重复计算
- 内存泄漏风险
- 同步阻塞操作

### 7. 智能修复建议
提供：
- 代码重构建议（提取函数、简化逻辑）
- 性能优化方案
- 架构改进建议
- 最佳实践推荐

### 8. 代码解释
对于复杂逻辑：
- 解释代码意图
- 说明为什么当前实现有问题
- 提供更好的实现方式

## 输出格式
仅返回有效的JSON，不要使用markdown包装：
{
  "score": <0-100>,
  "categoryScores": {
    "style": <0-100>,
    "security": <0-100>,
    "architecture": <0-100>,
    "performance": <0-100>,
    "maintainability": <0-100>
  },
  "issues": [
    {
      "file": "文件路径",
      "line": 行号或null,
      "severity": "critical|high|medium|low|info",
      "category": "类别",
      "rule": "规则名称",
      "message": "问题描述（中文）",
      "suggestion": "修复建议（中文）",
      "codeSnippet": "问题代码片段",
      "fixPatch": "修复后的代码",
      "priority": 1-5,
      "impactScope": "影响范围描述",
      "estimatedEffort": "低|中|高"
    }
  ],
  "summary": "2-4句话的整体评估（中文）",
  "complexityMetrics": {
    "cyclomaticComplexity": 平均圈复杂度,
    "cognitiveComplexity": 平均认知复杂度,
    "averageFunctionLength": 平均函数行数,
    "maxFunctionLength": 最长函数行数,
    "totalFunctions": 函数总数
  },
  "duplicationMetrics": {
    "duplicatedLines": 重复行数,
    "duplicatedBlocks": 重复块数,
    "duplicationRate": 重复率百分比,
    "duplicatedFiles": ["重复文件列表"]
  },
  "dependencyMetrics": {
    "totalDependencies": 依赖总数,
    "outdatedDependencies": 过时依赖数,
    "circularDependencies": ["循环依赖列表"],
    "unusedDependencies": ["未使用依赖列表"]
  },
  "securityFindings": [
    {
      "type": "漏洞类型",
      "severity": "critical|high|medium|low",
      "description": "详细描述（中文）",
      "file": "文件路径",
      "line": 行号,
      "cwe": "CWE-XXX"
    }
  ],
  "performanceFindings": [
    {
      "type": "性能问题类型",
      "description": "详细描述（中文）",
      "file": "文件路径",
      "line": 行号,
      "impact": "影响描述"
    }
  ],
  "aiSuggestions": [
    {
      "type": "建议类型",
      "title": "建议标题（中文）",
      "description": "详细描述（中文）",
      "priority": 1-5,
      "estimatedImpact": "预期影响"
    }
  ],
  "codeExplanations": [
    {
      "file": "文件路径",
      "line": 行号,
      "complexity": "复杂度描述",
      "explanation": "代码解释（中文）",
      "recommendation": "改进建议（中文）"
    }
  ],
  "contextAnalysis": {
    "changeType": "变更类型",
    "businessImpact": "业务影响描述（中文）",
    "riskLevel": "低|中|高|严重",
    "affectedModules": ["影响模块列表"],
    "breakingChanges": true|false
  }
}

**重要**：所有文本内容必须使用中文，包括问题描述、建议、解释等。`;
}

