export type VTree = VText | VNode | KeyedVNode | Tagger;
export type Attribute = Event | Prop;
export type Attributes = {
  EVENT: { [_: string]: Event };
  PROP: { [_: string]: Prop };
};

export class VText {
  readonly type = 'TEXT';
  readonly descendantsCount: never;
  constructor(readonly text: string) {}
}

export class VNode {
  readonly type = 'NODE';

  readonly descendantsCount: number;
  readonly props: Attributes;

  constructor(
    readonly tag: string,
    props: Array<Attribute>,
    readonly kids: Array<VTree>,
    readonly namespace?: string
  ) {
    this.descendantsCount =
      kids.reduce((acc, x) => acc + (x.descendantsCount || 0), 0) + kids.length;
    this.props = flattenAttributes(props);
  }
}

export class KeyedVNode {
  readonly type = 'KEYED_NODE';

  readonly descendantsCount: number;
  readonly props: Attributes;

  constructor(
    readonly tag: string,
    props: Array<Attribute>,
    readonly kids: Array<[string, VTree]>,
    readonly namespace?: string
  ) {
    this.descendantsCount =
      kids.reduce((acc, x) => acc + (x[1].descendantsCount || 0), 0) +
      kids.length;
    this.props = flattenAttributes(props);
  }
}

export type Tagger = {
  type: 'TAGGER';
  tagger: (a: any) => string;
  node: VTree;
  descendantsCount: number;
};

export const map = (tagger: (a: any) => string, node: VTree): Tagger => ({
  type: 'TAGGER' as const,
  tagger,
  node,
  descendantsCount: 1 + (node.descendantsCount || 0),
});

// ATTRIBUTE

export class Event<T = any> {
  readonly type = 'EVENT';
  public removed: boolean;

  constructor(readonly key: string, readonly handler: (e: T) => void) {}
}

export class Prop {
  readonly type = 'PROP';

  constructor(readonly key: string, readonly value: string) {}
}

const flattenAttributes = (attrs: Array<Attribute>) =>
  attrs.reduce<Attributes>(
    (acc, x) => ({ ...acc, [x.type]: { ...acc[x.type], [x.key]: x } }),
    {} as Attributes
  );
