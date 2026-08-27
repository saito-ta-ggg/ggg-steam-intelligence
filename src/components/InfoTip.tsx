import { DEFINITIONS, type DefinitionKey } from './Definitions';

/**
 * Definition tooltip. Uses the native title attribute plus an aria-label so the
 * definition is reachable without JavaScript and by screen readers.
 */
export function InfoTip({ definition }: { definition: DefinitionKey }) {
  const text = DEFINITIONS[definition];
  return (
    <i className="info" title={text} aria-label={text} role="img" tabIndex={0}>
      i
    </i>
  );
}
