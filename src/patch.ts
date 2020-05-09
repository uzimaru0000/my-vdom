import { VTree, Attributes } from './node';

export type Patch =
  | Redraw
  | Text
  | Props
  | RemoveLast
  | Append
  | Remove
  | Reorder;

export type Entry = {
  tag: string;
  vNode: VTree;
  index: number;
  data: any;
};

export class Redraw {
  readonly type = 'REDRAW';
  public domNode: Node;

  constructor(public index: number, public vTree: VTree) {}
}

export class Text {
  readonly type = 'TEXT';
  public domNode: Node;

  constructor(public index: number, public text: string) {}
}

export class Props {
  readonly type = 'PROPS';
  public domNode: Node;

  constructor(public index: number, public props: Attributes) {}
}

export class RemoveLast {
  readonly type = 'REMOVE_LAST';
  public domNode: Node;

  constructor(
    public index: number,
    public length: number,
    public diff: number
  ) {}
}

export class Append {
  readonly type = 'APPEND';
  public domNode: Node;

  constructor(
    public index: number,
    public length: number,
    public kids: Array<VTree>
  ) {}
}

export class Reorder {
  readonly type = 'REORDER';
  public domNode: Node;

  constructor(
    public index: number,
    public patches: Array<Patch>,
    public inserts: Array<{ index: number; entry: Entry }>,
    public endInserts: Array<{ index: number; entry: Entry }>
  ) {}
}

export class Remove {
  readonly type = 'REMOVE';
  public domNode: Node;

  constructor(
    public index: number,
    public patches?: Array<Patch>,
    public entry?: Entry
  ) {}
}
