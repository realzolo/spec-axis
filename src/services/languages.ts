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
    'Avoid magic numbers',
    'Keep functions small and focused',
    'Avoid deep nesting',
    'Use meaningful variable names',
  ];

  const languageSpecificRules: Record<SupportedLanguage, string[]> = {
    javascript: [
      'Prefer const and let over var',
      'Avoid ==; use ===',
      'Use arrow functions to preserve this context',
      'Avoid callback hell; use Promise or async/await',
    ],
    typescript: [
      'Add type annotations for function parameters and return values',
      'Use interfaces to define object shapes',
      'Avoid the any type',
      'Use enums instead of magic strings',
    ],
    python: [
      'Follow PEP 8 style guidelines',
      'Use list comprehensions where appropriate',
      'Use context managers for resource handling',
      'Avoid mutable default arguments',
    ],
    java: [
      'Follow Java naming conventions',
      'Prefer interfaces over concrete classes',
      'Handle exceptions properly',
      'Use StringBuilder for string concatenation',
    ],
    go: [
      'Follow Go style guidelines',
      'Handle errors properly',
      'Use defer for cleanup',
      'Avoid goroutine leaks',
    ],
    rust: [
      'Use ownership and borrowing correctly',
      'Avoid unnecessary cloning',
      'Use Result and Option for error handling',
      'Follow Rust naming conventions',
    ],
    php: [
      'Use type declarations',
      'Avoid global variables',
      'Use PDO for database access',
      'Follow PSR standards',
    ],
    ruby: [
      'Follow the Ruby style guide',
      'Use symbols instead of strings for hash keys',
      'Use blocks and iterators',
      'Avoid global variables',
    ],
    csharp: [
      'Follow C# naming conventions',
      'Use LINQ for collections',
      'Implement IDisposable correctly',
      'Use async programming patterns',
    ],
  };

  return [...commonRules, ...languageSpecificRules[language]];
}
