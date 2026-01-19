import { useState, useEffect } from 'react';

/**
 * Number formatting utilities that respect admin settings
 */

const ADMIN_SETTINGS_KEY = 'crypto-portfolio-admin-settings';

interface NumberFormatSettings {
  pricePrecision: number;
  tokenPrecision: number;
  defaultCurrency: string;
}

function getFormatSettings(): NumberFormatSettings {
  try {
    const stored = localStorage.getItem(ADMIN_SETTINGS_KEY);
    if (stored) {
      const settings = JSON.parse(stored);
      return settings.numberFormatting || {
        pricePrecision: 2,
        tokenPrecision: 4,
        defaultCurrency: 'USD',
      };
    }
  } catch (error) {
    console.error('Failed to load format settings:', error);
  }
  
  return {
    pricePrecision: 2,
    tokenPrecision: 4,
    defaultCurrency: 'USD',
  };
}

/**
 * Format a price value according to admin settings
 */
export function formatPrice(value: number): string {
  const settings = getFormatSettings();
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: settings.defaultCurrency,
    minimumFractionDigits: settings.pricePrecision,
    maximumFractionDigits: settings.pricePrecision,
  }).format(value);
}

/**
 * Format a token quantity according to admin settings
 */
export function formatTokens(value: number): string {
  const settings = getFormatSettings();
  return value.toFixed(settings.tokenPrecision);
}

/**
 * Format a percentage value
 */
export function formatPercent(value: number, decimals: number = 2): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`;
}

/**
 * Format a large number with abbreviations (K, M, B, T)
 */
export function formatLargeNumber(value: number): string {
  const settings = getFormatSettings();
  
  if (value >= 1e12) {
    return `$${(value / 1e12).toFixed(settings.pricePrecision)}T`;
  } else if (value >= 1e9) {
    return `$${(value / 1e9).toFixed(settings.pricePrecision)}B`;
  } else if (value >= 1e6) {
    return `$${(value / 1e6).toFixed(settings.pricePrecision)}M`;
  } else if (value >= 1e3) {
    return `$${(value / 1e3).toFixed(settings.pricePrecision)}K`;
  } else {
    return formatPrice(value);
  }
}

/**
 * Hook to listen for settings changes
 */
export function useFormatSettings() {
  const [settings, setSettings] = useState(getFormatSettings);

  useEffect(() => {
    const handleSettingsChange = () => {
      setSettings(getFormatSettings());
    };

    window.addEventListener('adminSettingsChanged', handleSettingsChange);
    return () => window.removeEventListener('adminSettingsChanged', handleSettingsChange);
  }, []);

  return settings;
}
