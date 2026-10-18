import type React from 'react';

/** ref callback that registers a DOM label under `key` */
export function registerLabel(map: React.MutableRefObject<Map<string, HTMLElement | null>>, key: string) {
  return (el: HTMLElement | null) => {
    if (el) map.current.set(key, el);
    else map.current.delete(key);
  };
}
