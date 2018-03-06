const preproPath = '../../prepro-cli';

const {getVideoInfo, parseVideoInfo} = require(preproPath + '/src/utils');
const runAll = require(preproPath + '/src/run_all');
const settings = require(preproPath + '/config/config.json');

// Prepro pipeline
function prepro(inputFile, outputFolder, cfg) {
  // Append dependencies
  cfg.services.unshift({id: 'video2kfvideo'});
  cfg.services.unshift({id: 'video2audio'});
  cfg.services.unshift({id: 'video2frames'});
  // Append urls
  for (let def of settings.services) {
    if (def.url) {
      const requestService = cfg.services.find((s) => s.id == def.id);
      if (requestService) {
        requestService.url = def.url;
      }
    }
  }
  // launch prepro
  return getVideoInfo(inputFile)
      .then((infos) => {
        cfg.video = parseVideoInfo(infos);
        console.log(cfg);
        return runAll(inputFile, outputFolder, cfg);
      })
      .catch((err) => {
        console.error('\n', '✖ Prepro ERROR');
        console.error(err, '\n');
      });
}

module.exports = prepro;
