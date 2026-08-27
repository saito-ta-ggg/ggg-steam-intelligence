/**
 * Country display rules.
 *
 * DATA_MODEL.md: `XC` / `Unknown Country` is Steam China.
 * REQUIREMENTS.md: `XC` must display as `Steam China (Country Code: XC)`.
 */
export const STEAM_CHINA_CODE = 'XC';
export const STEAM_CHINA_LABEL = 'Steam China (Country Code: XC)';

export function isSteamChina(countryCode: string, countryName?: string | null): boolean {
  return countryCode === STEAM_CHINA_CODE || countryName === 'Unknown Country';
}

/** Display label for a country row. Steam China always uses the mandated label. */
export function countryLabel(countryCode: string, countryName: string | null): string {
  if (isSteamChina(countryCode, countryName)) return STEAM_CHINA_LABEL;
  if (!countryName) return countryCode;
  return `${countryName} (${countryCode})`;
}
