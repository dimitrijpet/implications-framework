/**
 * ClaudeVisionAdapter.js
 * 
 * Vision analysis using Claude 3 Haiku.
 * Implements the VisionAdapter interface.
 */

import Anthropic from '@anthropic-ai/sdk';
import { VisionAdapter } from './VisionAdapter.js';

export class ClaudeVisionAdapter extends VisionAdapter {
  constructor(config = {}) {
    super(config);
    
    this.client = null;
    this.model = config.model || process.env.CLAUDE_VISION_MODEL || 'claude-3-haiku-20240307';
    this.apiKey = config.apiKey || process.env.ANTHROPIC_API_KEY;
  }

  /**
   * Initialize the Anthropic client (lazy)
   */
  _getClient() {
    if (!this.client) {
      if (!this.apiKey) {
        throw new Error('ANTHROPIC_API_KEY not configured');
      }
      this.client = new Anthropic({ apiKey: this.apiKey });
    }
    return this.client;
  }

  /**
   * Analyze screenshot and extract UI elements
   */
  async analyzeScreenshot(screenshotBase64, options = {}) {
    const client = this._getClient();
    const prompt = this.buildPrompt(options);

    const response = await client.messages.create({
      model: this.model,
      max_tokens: this.config.maxTokens || 4096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/png',
                data: screenshotBase64
              }
            },
            {
              type: 'text',
              text: prompt
            }
          ]
        }
      ]
    });

    // Extract text response
    const textContent = response.content.find(c => c.type === 'text');
    const rawResponse = textContent?.text || '';

    // Parse the response
    const result = this.parseResponse(rawResponse);
    
    // Add token usage
    result.tokensUsed = response.usage?.input_tokens + response.usage?.output_tokens || 0;
    result.usage = {
      input: response.usage?.input_tokens || 0,
      output: response.usage?.output_tokens || 0
    };

    return result;
  }

  /**
   * Compare two screenshots
   */
  async compareScreenshots(beforeBase64, afterBase64, options = {}) {
    const client = this._getClient();

    const prompt = `Compare these two screenshots of the same web page (before and after some action).

Identify:
1. Elements that appeared (added)
2. Elements that disappeared (removed)
3. Elements that changed (text, visibility, position, style)

Return JSON:
{
  "added": [{ "name": "elementName", "type": "button", "description": "what appeared" }],
  "removed": [{ "name": "elementName", "type": "input", "description": "what disappeared" }],
  "changed": [{ 
    "name": "elementName", 
    "changeType": "text|visibility|position|style",
    "before": "previous value",
    "after": "new value"
  }],
  "summary": "Brief description of what changed"
}

Return ONLY valid JSON.`;

    const response = await client.messages.create({
      model: this.model,
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'BEFORE screenshot:'
            },
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/png',
                data: beforeBase64
              }
            },
            {
              type: 'text',
              text: 'AFTER screenshot:'
            },
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/png',
                data: afterBase64
              }
            },
            {
              type: 'text',
              text: prompt
            }
          ]
        }
      ]
    });

    const textContent = response.content.find(c => c.type === 'text');
    const rawResponse = textContent?.text || '';

    try {
      const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error('Failed to parse comparison:', e.message);
    }

    return {
      added: [],
      removed: [],
      changed: [],
      summary: 'Failed to parse comparison',
      rawResponse
    };
  }

  /**
   * Extract text from screenshot
   */
  async extractText(screenshotBase64, options = {}) {
    const client = this._getClient();
    const { structured = false } = options;

    const prompt = structured
      ? `Extract all visible text from this screenshot. Return JSON:
{
  "text": "all text concatenated",
  "blocks": [
    { "text": "block text", "type": "heading|paragraph|label|button|link|input", "approximate_position": "top|middle|bottom" }
  ]
}
Return ONLY valid JSON.`
      : `Extract all visible text from this screenshot. Return only the text, nothing else.`;

    const response = await client.messages.create({
      model: this.model,
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/png',
                data: screenshotBase64
              }
            },
            {
              type: 'text',
              text: prompt
            }
          ]
        }
      ]
    });

    const textContent = response.content.find(c => c.type === 'text');
    const rawResponse = textContent?.text || '';

    if (structured) {
      try {
        const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        return { text: rawResponse, blocks: [] };
      }
    }

    return { text: rawResponse };
  }

  /**
   * Validate if element exists in screenshot
   */
  async validateElement(screenshotBase64, elementDescription, options = {}) {
    const client = this._getClient();

    const prompt = `Look at this screenshot and determine if the following element exists:

"${elementDescription}"

Return JSON:
{
  "found": true/false,
  "confidence": 0.0-1.0,
  "explanation": "why you think it is/isn't there",
  "element": {
    "name": "suggestedName",
    "type": "button/input/etc",
    "selector": "suggested CSS selector if found"
  }
}

Return ONLY valid JSON.`;

    const response = await client.messages.create({
      model: this.model,
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/png',
                data: screenshotBase64
              }
            },
            {
              type: 'text',
              text: prompt
            }
          ]
        }
      ]
    });

    const textContent = response.content.find(c => c.type === 'text');
    const rawResponse = textContent?.text || '';

    try {
      const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      return {
        found: false,
        confidence: 0,
        explanation: 'Failed to parse response',
        rawResponse
      };
    }
  }

  /**
   * Get adapter type
   */
  getAdapterType() {
    return 'claude-vision';
  }

  /**
   * Get capabilities
   */
  getCapabilities() {
    return {
      canAnalyzeScreenshots: true,
      canCompareScreenshots: true,
      canExtractText: true,
      canValidateElements: true,
      supportsCoordinates: true // Claude can estimate positions
    };
  }

  /**
   * Check configuration status
   */
  checkConfiguration() {
    const missing = [];
    
    if (!this.apiKey) {
      missing.push('ANTHROPIC_API_KEY');
    }

    return {
      configured: missing.length === 0,
      missing,
      model: this.model
    };
  }
}

export default ClaudeVisionAdapter;