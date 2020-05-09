import diff from './diff';
import { VNode, VText, Prop, Event, KeyedVNode } from './node';
import { render, applyPatches } from './render';

const id = (() => {
  let _id = 0;
  return () => _id++;
})();

const createTodo = (title: string) => ({
  id: id(),
  title,
  isDone: false,
});

const init = () => {
  let model = {
    value: '',
    todo: [],
  };
  let setState = (newModel) => {
    model = newModel;
    const newTree = view(model, setState);
    const patches = diff(currTree, newTree);
    applyPatches(dom, currTree, patches);
    currTree = newTree;
  };

  let currTree = view(model, setState);
  let dom = render(currTree);

  return dom;
};

const view = (model, setState) =>
  new VNode(
    'div',
    [],
    [
      new VNode(
        'div',
        [],
        [
          new VNode(
            'input',
            [
              new Prop('value', model.value),
              new Event<InputEvent>('input', (e) =>
                setState({
                  ...model,
                  value: (e.target as HTMLInputElement).value,
                })
              ),
            ],
            []
          ),
          new VNode(
            'button',
            [
              new Event('click', () => {
                setState({
                  ...model,
                  value: '',
                  todo: [...model.todo, createTodo(model.value)],
                });
              }),
              model.value.length <= 0 && new Prop('disabled', ''),
            ],
            [new VText('Create')]
          ),
        ]
      ),
      new KeyedVNode(
        'div',
        [],
        model.todo.map(
          todo((id, todo) => {
            setState({
              ...model,
              todo: model.todo.map((x) => (x.id === id ? todo : x)),
            });
          })
        )
      ),
    ]
  );

const todo = (setState: (id: number, todo) => void) => (todo: {
  id: number;
  title: string;
  isDone: boolean;
}) => [
  todo.id.toString(),
  new VNode(
    'div',
    [],
    [
      new VNode(
        'span',
        [todo.isDone && new Prop('class', 'isDONE')],
        [new VText(todo.title)]
      ),
      new VNode(
        'button',
        [
          new Event('click', () =>
            setState(todo.id, { ...todo, isDone: !todo.isDone })
          ),
        ],
        [todo.isDone ? new VText('NOT DONE') : new VText('DONE')]
      ),
    ]
  ),
];

const mount = document.getElementById('mount');

const dom = init();
mount.appendChild(dom);
