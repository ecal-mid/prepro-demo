const fs = require('fs-extra');
const path = require('path');
const {execSync} = require('child_process');

const preproLibPath = path.join('..', 'prepro-js');

const output = 'build';
fs.removeSync(output);

fs.copySync('static', output);

for (const folder of ['build', 'examples']) {
  fs.copySync(path.join(preproLibPath, folder), path.join(output, folder));
}

const cmd = [
  'documentation',
  'build',
  path.join(preproLibPath, 'src', 'js', 'prepro.js'),
  '-f html',
  '-o',
  path.join(output, 'documentation'),
  '-g',
].join(' ');

execSync(cmd);
