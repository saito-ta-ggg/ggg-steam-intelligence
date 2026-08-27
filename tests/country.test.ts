import { describe, expect, it } from 'vitest';
import { STEAM_CHINA_LABEL, countryLabel, isSteamChina } from '@/domain/country';

describe('country display', () => {
  it('renders XC as the mandated Steam China label', () => {
    expect(countryLabel('XC', 'Unknown Country')).toBe('Steam China (Country Code: XC)');
    expect(STEAM_CHINA_LABEL).toBe('Steam China (Country Code: XC)');
  });

  it('treats "Unknown Country" as Steam China even without the XC code', () => {
    expect(isSteamChina('ZZ', 'Unknown Country')).toBe(true);
    expect(countryLabel('ZZ', 'Unknown Country')).toBe(STEAM_CHINA_LABEL);
  });

  it('renders other countries as "Name (Code)"', () => {
    expect(countryLabel('JP', 'Japan')).toBe('Japan (JP)');
  });

  it('falls back to the code when no name exists', () => {
    expect(countryLabel('ZW', null)).toBe('ZW');
  });
});
