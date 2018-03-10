const file_system = require('fs');
const archiver = require('archiver');

function archive(inputFolder, outputFile) {
  return new Promise((resolve, reject) => {
    const output = file_system.createWriteStream(outputFile);
    const archive = archiver('zip');
    output.on('close', function() {
      resolve(outputFile);
    });
    archive.on('error', function(err) {
      reject(err);
    });
    archive.pipe(output);
    archive.directory(inputFolder);
    archive.finalize();
  });
}

module.exports = archive;
