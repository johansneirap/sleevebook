export interface Section<T> {
  key: string;
  items: T[];
  startOnNewSide: boolean;
}

export interface SectionizeOptions {
  startOnNewSide?: boolean;
}

export function sectionize<T>(
  items: T[],
  getKey: (item: T) => string,
  options: SectionizeOptions = {},
): Section<T>[] {
  const sections: Section<T>[] = [];
  const startOnNewSide = options.startOnNewSide ?? false;

  for (const item of items) {
    const key = getKey(item);
    const current = sections.at(-1);
    if (current && current.key === key) {
      current.items.push(item);
    } else {
      sections.push({ key, items: [item], startOnNewSide });
    }
  }

  return sections;
}
