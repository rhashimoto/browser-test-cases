import '@bare';
import '@bare/foo.js';
import '@bare/../top.js';

const element = document.createElement('pre');
element.textContent = 'imports complete'
document.body.appendChild(element);
