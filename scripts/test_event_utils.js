// scripts/test_event_utils.js
const { parseStoredDescription, composeDescriptionFromEventData } = require('../lib/eventUtils');

function test() {
  const raw = JSON.stringify({ text: 'Notes', subtasks: [{ id: 'a', text: 'One', done: false }] });
  const parsed = parseStoredDescription(raw);
  console.log('Parsed:', parsed);

  const composed = composeDescriptionFromEventData('My notes', [{ id: 'a', text: 'One', done: false }]);
  console.log('Composed:', composed);

  const plain = parseStoredDescription('Just text');
  console.log('Plain:', plain);
}

test();
