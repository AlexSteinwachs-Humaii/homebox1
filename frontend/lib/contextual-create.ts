/**
 * Lets the location view refresh after a contextual create without a
 * caller-supplied redirect. Cancel does not notify.
 */

type Listener = () => void;

const listeners = new Set<Listener>();

export function onContextualItemCreated(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifyContextualItemCreated(): void {
  for (const listener of [...listeners]) {
    listener();
  }
}
