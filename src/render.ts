import { VTree, Attributes, Prop, Event } from './node';
import { Patch, Reorder, Entry } from './patch';

export const render = (vNode: VTree) => {
  switch (vNode.type) {
    case 'TEXT':
      return document.createTextNode(vNode.text);
    case 'NODE':
    case 'KEYED_NODE':
      const domNode = vNode.namespace
        ? document.createElementNS(vNode.namespace, vNode.tag)
        : document.createElement(vNode.tag);
      applyProps(domNode, vNode.props);
      const kids = vNode.kids;
      for (let i = 0; i < kids.length; i++) {
        appendChild(
          domNode,
          render(vNode.type === 'NODE' ? kids[i] : kids[i][1])
        );
      }
      return domNode;
  }
};

const appendChild = (parent: Node, child: Node) => {
  parent.appendChild(child);
};

export const applyPatches = (
  rootDomNode: Node,
  oldVNode: VTree,
  patches: Array<Patch>
) => {
  if (patches.length === 0) {
    return rootDomNode;
  }

  addDomNodes(rootDomNode, oldVNode, patches);
  return applyPatchesHelp(rootDomNode, patches);
};

const addDomNodes = (domNode: Node, vNode: VTree, patches: Array<Patch>) => {
  addDomNodesHelp(domNode, vNode, patches, 0, 0, vNode.descendantsCount);
};

const addDomNodesHelp = (
  domNode: Node,
  vNode: VTree,
  patches: Array<Patch>,
  i: number,
  low: number,
  high: number
) => {
  let patch = patches[i];
  let index = patch.index;

  while (index === low) {
    switch (patch.type) {
      case 'REORDER': {
        patch.domNode = domNode;

        const subPatches = patch.patches;
        if (subPatches.length > 0) {
          addDomNodesHelp(domNode, vNode, subPatches, 0, low, high);
        }
        break;
      }
      case 'REMOVE': {
        patch.domNode = domNode;

        if (patch.patches && patch.entry) {
          patch.entry.data = domNode;
          const subPatches = patch.patches;
          if (subPatches.length > 0) {
            addDomNodesHelp(domNode, vNode, subPatches, 0, low, high);
          }
        }
      }
      default: {
        patch.domNode = domNode;
      }
    }

    i++;

    if (!(patch = patches[i]) || (index = patch.index) > high) {
      return i;
    }
  }

  if (vNode.type === 'KEYED_NODE' || vNode.type === 'NODE') {
    const vKids = vNode.kids;
    const childNodes = domNode.childNodes;
    for (let j = 0; j < vKids.length; j++) {
      low++;
      const vKid: VTree = vNode.type === 'NODE' ? vKids[j] : vKids[j][1];
      const nextLow = low + (vKid.descendantsCount || 0);
      if (low <= index && index <= nextLow) {
        i = addDomNodesHelp(childNodes[j], vKid, patches, i, low, nextLow);
        if (!(patch = patches[i]) || (index = patch.index) > high) {
          return i;
        }
      }
      low = nextLow;
    }
  }

  return i;
};

const applyPatchesHelp = (rootDomNode: Node, patches: Array<Patch>) => {
  for (let i = 0; i < patches.length; i++) {
    const patch = patches[i];
    const localDomNode = patch.domNode;
    const newNode = applyPatch(localDomNode, patch);
    if (localDomNode === rootDomNode) {
      rootDomNode = newNode;
    }
  }
  return rootDomNode;
};

const applyPatch = (domNode: Node, patch: Patch) => {
  switch (patch.type) {
    case 'REDRAW':
      return applyPatchRedraw(domNode, patch.vTree);
    case 'PROPS':
      return applyProps(domNode, patch.props);
    case 'TEXT':
      const textNode = domNode as Text;
      textNode.replaceData(0, textNode.length, patch.text);
      return domNode;
    case 'REMOVE_LAST':
      for (let i = 0; i < patch.diff; i++) {
        domNode.removeChild(domNode.childNodes[patch.length]);
      }
      return domNode;
    case 'APPEND':
      const kids = patch.kids;
      let i = patch.length;
      const theEnd = domNode.childNodes[i];
      for (; i < kids.length; i++) {
        domNode.insertBefore(render(kids[i]), theEnd);
      }
      return domNode;
    case 'REMOVE':
      if (!patch.entry && !patch.patches) {
        domNode.parentNode.removeChild(domNode);
        return domNode;
      }
      if (typeof patch.entry.index !== 'undefined') {
        domNode.parentNode.removeChild(domNode);
      }
      patch.entry.data = applyPatchesHelp(domNode, patch.patches);
      return domNode;
    case 'REORDER':
      return applyPatchReorder(domNode, patch);
  }
};

const applyPatchRedraw = (domNode: Node, vNode: VTree) => {
  const parentNode = domNode.parentNode;
  const newNode = render(vNode);

  if (parentNode && newNode !== domNode) {
    parentNode.replaceChild(newNode, domNode);
  }
  return newNode;
};

const applyProps = (domNode: Node, props: Attributes) => {
  for (let key in props) {
    const value = props[key];

    key === 'EVENT'
      ? applyEvent(domNode as HTMLElement, value)
      : key === 'PROP'
      ? applyAttrs(domNode as HTMLElement, value)
      : undefined;
  }

  return domNode;
};

const applyAttrs = (domNode: HTMLElement, attrs: { [_: string]: Prop }) => {
  for (let key in attrs) {
    const value = attrs[key];
    value
      ? domNode.setAttribute(key, value.value)
      : domNode.removeAttribute(key);

    if (
      value &&
      (key === 'value' || key === 'checked') &&
      domNode[key] !== value.value
    ) {
      domNode[key] = value.value;
    }
  }
};

const applyEvent = (domNode: HTMLElement, events: { [_: string]: Event }) => {
  for (let key in events) {
    const event = events[key];
    if (event.removed || key.includes('remove_', 0)) {
      domNode.removeEventListener(event.key, event.handler);
      continue;
    }

    domNode.addEventListener(event.key, event.handler);
  }
};

const applyPatchReorder = (domNode: Node, patch: Reorder) => {
  const frag = applyPatchReorderEndInsertsHelp(patch.endInserts, patch);

  domNode = applyPatchesHelp(domNode, patch.patches);

  for (let i = 0; i < patch.inserts.length; i++) {
    const insert = patch.inserts[i];
    const entry = insert.entry;
    const node = entry.tag === 'MOVE' ? entry.data : render(entry.vNode);
    domNode.insertBefore(node, domNode.childNodes[insert.index]);
  }

  if (frag) {
    appendChild(domNode, frag);
  }

  return domNode;
};

const applyPatchReorderEndInsertsHelp = (
  endInserts: Array<{ index: number; entry: Entry }>,
  patch: Reorder
) => {
  if (!endInserts) {
    return;
  }

  var frag = document.createDocumentFragment();
  for (let i = 0; i < endInserts.length; i++) {
    const insert = endInserts[i];
    const entry = insert.entry;
    appendChild(frag, entry.tag === 'MOVE' ? entry.data : render(entry.vNode));
  }

  return frag;
};
