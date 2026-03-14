// Language detection and configuration

export type SupportedLanguage = 'javascript' | 'typescript' | 'python' | 'java' | 'go' | 'rust' | 'php' | 'ruby' | 'csharp';

export interface LanguageConfig {
  name: string;
  extensions: string[];
  commentStyle: {
    single?: string;
    multiStart?: string;
    multiEnd?: string;
  };
  keywords: string[];
  frameworks?: string[];
}

export const LANGUAGE_CONFIGS: Record<SupportedLanguage, LanguageConfig> = {
  javascript: {
    name: 'JavaScript',
    extensions: ['.js', '.jsx', '.mjs', '.cjs'],
    commentStyle: {
      single: '//',
      multiStart: '/*',
      multiEnd: '*/',
    },
    keywords: ['const', 'let', 'var', 'function', 'class', 'import', 'export'],
    frameworks: ['React', 'Vue', 'Angular', 'Node.js', 'Express'],
  },
  typescript: {
    name: 'TypeScript',
    extensions: ['.ts', '.tsx'],
    commentStyle: {
      single: '//',
      multiStart: '/*',
      multiEnd: '*/',
    },
    keywords: ['const', 'let', 'var', 'function', 'class', 'import', 'export', 'interface', 'type'],
    frameworks: ['React', 'Vue', 'Angular', 'Node.js', 'NestJS'],
  },
  python: {
    name: 'Python',
    extensions: ['.py', '.pyw'],
    commentStyle: {
      single: '#',
      multiStart: '"""',
      multiEnd: '"""',
    },
    keywords: ['def', 'class', 'import', 'from', 'if', 'for', 'while', 'try', 'except'],
    frameworks: ['Django', 'Flask', 'FastAPI', 'Pandas', 'NumPy'],
  },
  java: {
    name: 'Java',
    extensions: ['.java'],
    commentStyle: {
      single: '//',
      multiStart: '/*',
      multiEnd: '*/',
    },
    keywords: ['public', 'private', 'class', 'interface', 'extends', 'implements', 'import'],
    frameworks: ['Spring', 'Spring Boot', 'Hibernate', 'Maven', 'Gradle'],
  },
  go: {
    name: 'Go',
    extensions: ['.go'],
    commentStyle: {
      single: '//',
      multiStart: '/*',
      multiEnd: '*/',
    },
    keywords: ['func', 'package', 'import', 'type', 'struct', 'interface', 'var', 'const'],
    frameworks: ['Gin', 'Echo', 'Fiber', 'GORM'],
  },
  rust: {
    name: 'Rust',
    extensions: ['.rs'],
    commentStyle: {
      single: '//',
      multiStart: '/*',
      multiEnd: '*/',
    },
    keywords: ['fn', 'let', 'mut', 'struct', 'enum', 'impl', 'trait', 'use', 'mod'],
    frameworks: ['Actix', 'Rocket', 'Tokio', 'Serde'],
  },
  php: {
    name: 'PHP',
    extensions: ['.php'],
    commentStyle: {
      single: '//',
      multiStart: '/*',
      multiEnd: '*/',
    },
    keywords: ['function', 'class', 'public', 'private', 'protected', 'namespace', 'use'],
    frameworks: ['Laravel', 'Symfony', 'CodeIgniter', 'WordPress'],
  },
  ruby: {
    name: 'Ruby',
    extensions: ['.rb'],
    commentStyle: {
      single: '#',
      multiStart: '=begin',
      multiEnd: '=end',
    },
    keywords: ['def', 'class', 'module', 'require', 'include', 'if', 'unless', 'while'],
    frameworks: ['Rails', 'Sinatra', 'Hanami'],
  },
  csharp: {
    name: 'C#',
    extensions: ['.cs'],
    commentStyle: {
      single: '//',
      multiStart: '/*',
      multiEnd: '*/',
    },
    keywords: ['public', 'private', 'class', 'interface', 'namespace', 'using', 'var'],
    frameworks: ['.NET', 'ASP.NET', 'Entity Framework', 'Blazor'],
  },
};

export function detectLanguage(filename: string): SupportedLanguage | null {
  const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();

  for (const [lang, config] of Object.entries(LANGUAGE_CONFIGS)) {
    if (config.extensions.includes(ext)) {
      return lang as SupportedLanguage;
    }
  }

  return null;
}

export function detectLanguagesInDiff(diff: string): SupportedLanguage[] {
  const filePattern = /^diff --git a\/(.+?) b\/.+$/gm;
  const languages = new Set<SupportedLanguage>();
  let match;

  while ((match = filePattern.exec(diff)) !== null) {
    const lang = detectLanguage(match[1]);
    if (lang) {
      languages.add(lang);
    }
  }

  return Array.from(languages);
}

export function getLanguageSpecificRules(language: SupportedLanguage): string[] {
  const commonRules = [
    '避免使用魔法数字',
    '函数应该保持简短',
    '避免深层嵌套',
    '使用有意义的变量名',
  ];

  const languageSpecificRules: Record<SupportedLanguage, string[]> = {
    javascript: [
      '使用 const 和 let 而不是 var',
      '避免使用 == 进行比较，使用 ===',
      '使用箭头函数保持 this 上下文',
      '避免回调地狱，使用 Promise 或 async/await',
    ],
    typescript: [
      '为所有函数参数和返回值添加类型注解',
      '使用接口定义对象结构',
      '避免使用 any 类型',
      '使用枚举代替魔法字符串',
    ],
    python: [
      '遵循 PEP 8 编码规范',
      '使用列表推导式而不是循环',
      '使用上下文管理器处理资源',
      '避免使用可变默认参数',
    ],
    java: [
      '遵循 Java 命名约定',
      '使用接口而不是具体类',
      '正确处理异常',
      '使用 StringBuilder 进行字符串拼接',
    ],
    go: [
      '遵循 Go 编码规范',
      '正确处理错误',
      '使用 defer 清理资源',
      '避免 goroutine 泄漏',
    ],
    rust: [
      '正确使用所有权和借用',
      '避免不必要的克隆',
      '使用 Result 和 Option 处理错误',
      '遵循 Rust 命名约定',
    ],
    php: [
      '使用类型声明',
      '避免使用全局变量',
      '使用 PDO 进行数据库操作',
      '遵循 PSR 标准',
    ],
    ruby: [
      '遵循 Ruby 风格指南',
      '使用符号而不是字符串作为哈希键',
      '使用块和迭代器',
      '避免使用全局变量',
    ],
    csharp: [
      '遵循 C# 命名约定',
      '使用 LINQ 进行集合操作',
      '正确实现 IDisposable',
      '使用异步编程模式',
    ],
  };

  return [...commonRules, ...languageSpecificRules[language]];
}
