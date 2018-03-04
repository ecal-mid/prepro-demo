const preproPath = '../../prepro-cli';

const {getVideoInfo, parseVideoInfo} = require(preproPath + '/src/utils');
const runAll = require(preproPath + '/src/run_all');

// Prepro pipeline
function prepro(inputFile, outputFolder, cfg) {
  return getVideoInfo(inputFile)
      .then((infos) => {
        cfg.video = parseVideoInfo(infos);
        return runAll(inputFile, outputFolder, cfg);
      })
      .catch((err) => {
        console.error('\n', '✖ Prepro ERROR');
        console.error(err, '\n');
      });
}

module.exports = prepro;
