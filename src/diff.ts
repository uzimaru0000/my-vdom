import {
  VTree,
  VNode,
  KeyedVNode,
  Attribute,
  Attributes,
  Prop,
  Event,
} from './node';
import {
  Entry,
  Redraw,
  Text,
  Props,
  RemoveLast,
  Append,
  Patch,
  Reorder,
  Remove,
} from './patch';

export default (x: VTree, y: VTree) => {
  const patches = [];
  diffHelper(x, y, patches, 0);
  return patches;
};

const pushPatch = (patches: Array<any>, patch: Patch) => {
  patches.push(patch);
  return patch;
};

const diffHelper = (x: VTree, y: VTree, patches: Array<any>, index: number) => {
  if (x === y) {
    return;
  }

  if (x.type !== y.type) {
    if (x.type === 'NODE' && y.type === 'KEYED_NODE') {
      y = dekey(y);
    } else {
      pushPatch(patches, new Redraw(index, y));
      return;
    }
  }

  switch (y.type) {
    case 'TEXT':
      if (x.type === 'TEXT' && x.text !== y.text) {
        pushPatch(patches, new Text(index, y.text));
        return;
      }
      return;
    case 'NODE':
      if (x.type === 'NODE') {
        diffNodes(x, y, patches, index, diffKids);
      }
      return;
    case 'KEYED_NODE':
      if (x.type === 'KEYED_NODE') {
        diffNodes(x, y, patches, index, diffKeyedKids);
      }
      return;
  }
};

const diffNodes = (
  x: VNode | KeyedVNode,
  y: VNode | KeyedVNode,
  patches: Array<any>,
  index: number,
  diffKids: (x: VTree, y: VTree, patches: Array<any>, index: number) => void
) => {
  if (x.tag !== y.tag || x.namespace !== y.namespace) {
    pushPatch(patches, new Redraw(index, y));
    return;
  }

  const propsDiff = diffProps(x.props, y.props);
  if (
    Object.keys(propsDiff.EVENT).length > 0 ||
    Object.keys(propsDiff.PROP).length > 0
  ) {
    pushPatch(patches, new Props(index, propsDiff));
  }

  diffKids(x, y, patches, index);
};

const diffProps = (x: Attributes, y: Attributes) => {
  // 既存のカテゴリでのsubDiff計算
  const diff = Object.entries(x).reduce(
    (diff, [xKey, xVal]) => ({
      ...diff,
      [xKey]: diffProp(xVal, y[xKey] || {}),
    }),
    { EVENT: {}, PROP: {} }
  );

  // 新しいカテゴリでのsubDiff計算
  return Object.entries(y).reduce((diff, [yKey, yVal]) => {
    const xVal = x[yKey];

    if (!xVal) {
      return {
        ...diff,
        [yKey]: diffProp({}, yVal),
      };
    }

    return diff;
  }, diff);
};

const diffProp = (
  x: { [_: string]: Attribute },
  y: { [_: string]: Attribute }
) => {
  // 更新されているか・削除されているかの判定
  const diff = Object.entries(x).reduce((acc, [key, val]) => {
    const yVal = y[key];
    if (yVal && val.type === yVal.type) {
      switch (val.type) {
        case 'EVENT': {
          // 関数の判定は無理なのでとりあえず絶対diffをとる
          return { ...acc, [key]: yVal, [`remove_${key}`]: val };
        }
        case 'PROP': {
          if (val.value !== (yVal as Prop).value) {
            return { ...acc, [key]: yVal };
          }
        }
      }
    } else {
      if (val.type === 'EVENT') {
        val.removed = true;
        return { ...acc, [key]: val };
      }
      return { ...acc, [key]: null };
    }

    return acc;
  }, {});

  // 追加されているかの判定
  return Object.entries(y).reduce((acc, [key, val]) => {
    const xVal = x[key];

    if (!xVal) {
      return { ...acc, [key]: val };
    }

    return acc;
  }, diff);
};

const diffKids = (
  xParent: VNode,
  yParent: VNode,
  patches: Array<any>,
  index: number
) => {
  const xKids = xParent.kids;
  const yKids = yParent.kids;

  const xLen = xKids.length;
  const yLen = yKids.length;

  if (xLen > yLen) {
    pushPatch(patches, new RemoveLast(index, yLen, xLen - yLen));
  } else if (xLen < yLen) {
    pushPatch(patches, new Append(index, xLen, yKids));
  }

  for (let minLen = Math.min(xLen, yLen), i = 0; i < minLen; i++) {
    const xKid = xKids[i];
    diffHelper(xKid, yKids[i], patches, ++index);
    index += xKid.descendantsCount || 0;
  }
};

const diffKeyedKids = (
  xParent: KeyedVNode,
  yParent: KeyedVNode,
  patches: Array<any>,
  rootIndex: number
) => {
  const localPatches: Array<Patch> = [];

  const changes: { [key: string]: Entry } = {};
  const inserts: Array<{ index: number; entry: Entry }> = [];

  const xKids = xParent.kids;
  const yKids = yParent.kids;
  const xLen = xKids.length;
  const yLen = yKids.length;

  let xIndex = 0;
  let yIndex = 0;

  let index = rootIndex;

  while (xIndex < xLen && yIndex < yLen) {
    const [xKey, xNode] = xKids[xIndex];
    const [yKey, yNode] = yKids[yIndex];

    let newMatch = false;
    let oldMatch = false;

    if (xKey === yKey) {
      index++;
      diffHelper(xNode, yNode, localPatches, index);
      index += xNode.descendantsCount || 0;

      xIndex++;
      yIndex++;
      continue;
    }

    const [xNextKey, xNextNode] = xKids[xIndex + 1] || [];
    const [yNextKey, yNextNode] = yKids[yIndex + 1] || [];

    oldMatch = yKey === xNextKey;
    newMatch = xKey === yNextKey;

    if (newMatch && oldMatch) {
      index++;
      diffHelper(xNode, yNextNode, localPatches, index);
      insertNode(changes, localPatches, xKey, yNode, yIndex, inserts);
      index += xNode.descendantsCount || 0;

      index++;
      removeNode(changes, localPatches, xKey, xNextNode, index);
      index += xNextNode.descendantsCount || 0;

      xIndex += 2;
      yIndex += 2;
      continue;
    }

    if (newMatch) {
      index++;
      insertNode(changes, localPatches, yKey, yNode, yIndex, inserts);
      diffHelper(xNode, yNextNode, localPatches, index);
      index += xNode.descendantsCount || 0;

      xIndex += 1;
      yIndex += 2;
      continue;
    }

    if (oldMatch) {
      index++;
      removeNode(changes, localPatches, xKey, xNode, index);
      index += xNode.descendantsCount || 0;

      index++;
      diffHelper(xNextNode, yNode, localPatches, index);
      index += xNextNode.descendantsCount || 0;

      xIndex += 2;
      yIndex += 1;
      continue;
    }

    if (xNextKey && xNextNode && xNextKey === yNextKey) {
      index++;
      removeNode(changes, localPatches, xKey, xNode, index);
      insertNode(changes, localPatches, yKey, yNode, yIndex, inserts);
      index += xNode.descendantsCount || 0;

      index++;
      diffHelper(xNextNode, yNextNode, localPatches, index);
      index += xNextNode.descendantsCount || 0;

      xIndex += 2;
      yIndex += 2;
      continue;
    }

    break;
  }

  while (xIndex < xLen) {
    index++;
    const [xKey, xNode] = xKids[xIndex];
    removeNode(changes, localPatches, xKey, xNode, index);
    index += xNode.descendantsCount || 0;
    xIndex++;
  }

  let endInserts: Array<{ index: number; entry: Entry }> = undefined;
  while (yIndex < yLen) {
    endInserts = endInserts || [];
    const [yKey, yNode] = yKids[yIndex];
    insertNode(changes, localPatches, yKey, yNode, undefined, endInserts);
    yIndex++;
  }

  if (localPatches.length > 0 || inserts.length > 0 || endInserts) {
    pushPatch(
      patches,
      new Reorder(rootIndex, localPatches, inserts, endInserts)
    );
  }
};

const insertNode = (
  changes: { [key: string]: Entry },
  localPatches: Array<any>,
  key: string,
  vNode: VTree,
  yIndex: number,
  inserts: Array<{ index: number; entry: Entry }>
) => {
  const entry = changes[key];

  if (!entry) {
    const newEntry = {
      tag: 'INSERT',
      vNode,
      index: yIndex,
      data: undefined,
    };

    inserts.push({ index: yIndex, entry: newEntry });
    changes[key] = newEntry;

    return;
  }

  if (entry.tag === 'REMOVE') {
    inserts.push({ index: yIndex, entry });

    entry.tag = 'MOVE';
    const subPatches = [];
    diffHelper(entry.vNode, vNode, subPatches, entry.index);
    entry.index = yIndex;
    entry.data.data = {
      patches: subPatches,
      entry: entry,
    };

    return;
  }

  insertNode(changes, localPatches, key + 'aaaa', vNode, yIndex, inserts);
};

const removeNode = (
  changes: { [key: string]: Entry },
  localPatches: Array<any>,
  key: string,
  vNode: VTree,
  index: number
) => {
  const entry = changes[key];

  if (!entry) {
    const patch = pushPatch(localPatches, new Remove(index));

    changes[key] = {
      tag: 'REMOVE',
      vNode,
      index,
      data: patch,
    };

    return;
  }

  if (entry.tag === 'INSERT') {
    entry.tag = 'REMOVE';
    const subPatches = [];
    diffHelper(vNode, entry.vNode, subPatches, index);

    pushPatch(localPatches, new Remove(index, subPatches, entry));

    return;
  }

  removeNode(changes, localPatches, key + 'aaaa', vNode, index);
};

const dekey = (x: KeyedVNode) =>
  new VNode(
    x.tag,
    Object.values(x.props).reduce<Array<Attribute>>(
      (acc, x) => [...acc, ...Object.values<Attribute>(x)],
      []
    ),
    x.kids.map(([_, kid]) => kid),
    x.namespace
  );
