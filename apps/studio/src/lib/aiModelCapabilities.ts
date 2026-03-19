type APIStyle = 'openai' | 'anthropic';

type CapabilityReason =
  | 'model_not_supported'
  | 'requires_openai_official_base'
  | 'api_style_not_supported';

interface ParameterCapability {
  supported: boolean;
  reason?: CapabilityReason;
}

export interface AIParameterCapabilities {
  temperature: ParameterCapability;
  reasoningEffort: ParameterCapability;
}

const NO_TEMPERATURE_MODELS = new Set([
  'o1', 'o1-mini', 'o1-preview',
  'o3', 'o3-mini',
  'o4-mini',
  'codex',
  'codex-latest',
  'codex-mini-latest',
  'deepseek-reasoner',
]);

const REASONING_MODEL_PREFIXES = ['o', 'gpt-5', 'codex'];

export function supportsTemperature(model: string): boolean {
  const normalizedModel = model.trim().toLowerCase();
  if (!normalizedModel) return true;
  for (const m of NO_TEMPERATURE_MODELS) {
    if (normalizedModel === m || normalizedModel.startsWith(`${m}-`)) return false;
  }
  return true;
}

export function supportsReasoningEffort(model: string): boolean {
  const normalizedModel = model.trim().toLowerCase();
  if (!normalizedModel) return false;
  return REASONING_MODEL_PREFIXES.some((prefix) => (
    normalizedModel === prefix || normalizedModel.startsWith(`${prefix}-`)
  ));
}

export function isOpenAIOfficialBase(baseUrl?: string): boolean {
  if (!baseUrl) return false;
  try {
    const parsed = new URL(baseUrl);
    return parsed.hostname === 'api.openai.com';
  } catch {
    return false;
  }
}

export function getAIParameterCapabilities(input: {
  model: string;
  apiStyle: APIStyle;
  baseUrl?: string;
}): AIParameterCapabilities {
  const temperatureSupported = supportsTemperature(input.model);

  let reasoningEffort: ParameterCapability;
  if (input.apiStyle !== 'openai') {
    reasoningEffort = { supported: false, reason: 'api_style_not_supported' };
  } else if (!isOpenAIOfficialBase(input.baseUrl)) {
    reasoningEffort = { supported: false, reason: 'requires_openai_official_base' };
  } else if (!supportsReasoningEffort(input.model)) {
    reasoningEffort = { supported: false, reason: 'model_not_supported' };
  } else {
    reasoningEffort = { supported: true };
  }

  return {
    temperature: temperatureSupported
      ? { supported: true }
      : { supported: false, reason: 'model_not_supported' },
    reasoningEffort,
  };
}
