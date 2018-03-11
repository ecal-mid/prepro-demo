const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const sharp = require('sharp');

const prepro = require('./prepro')
const archive = require('./archive');
const {rmdirRf} = require('./utils');
const pjson = require('../package.json');

const queue = [];
let busy = false;

const logs = {};

// Initialize Firebase
const key =
    path.join(__dirname, '..', 'secret', 'prepro-demo-ef38120f330f.json');
const serviceAccount = require(key);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'prepro-demo.appspot.com'
});
const bucket = admin.storage().bucket();
const db = admin.firestore();
const dbCollection = 'renders-dev';
const renders = db.collection(dbCollection);
const dataFolder = path.join('..', 'tmp');
if (!fs.existsSync(dataFolder)) {
  fs.mkdirSync(dataFolder);
}

/**
 * Log util.
 * @param  {String} file       Id of the file being processed
 * @param  {...Arguments} args Arguments being logged
 * @return {promise}           A promise resolving after arguments have been logged.
 */
function log(file, ...args) {
  console.log.apply(console, args);
  const entry = {};
  logs[file] = logs[file] || [];
  logs[file].push({level: 'verbose', value: args.join(' ')});
  return renders.doc(file).set({'log': logs[file]}, {merge: true});
};

function logError(file, ...args) {
  console.error.apply(console, args);
  const entry = {};
  logs[file] = logs[file] || [];
  logs[file].push({level: 'error', value: args.join(' ')});
  return renders.doc(file).set({'log': logs[file]}, {merge: true});
};

/**
 * Download.
 * @param  {Downloads a file on GCS} file The file to download.
 * @return {promise}      a Promise resolving when download is complete.
 */
function download(file) {
  const options = {
    destination: path.join(dataFolder, file),
  };
  const p = bucket.file(dbCollection + '/' + file).download(options);
  return p;
}

/**
 * Cleans up files downloaded on the local folder.
 * @param  {String} inputFile    The input file.
 * @param  {String} outputFolder The Prepro output folder.
 * @param  {String} outputFile   The zip file.
 * @return {promise}             A promise resolving when the files have been removed
 */
function cleanup(inputFile, outputFolder, outputFile) {
  return new Promise((resolve, reject) => {
    try {
      fs.unlinkSync(inputFile);
      fs.unlinkSync(outputFile);
      rmdirRf(outputFolder);
    } catch (err) {
      console.warn('WARNING: could not cleanup tmp dir');
    }
    resolve();
  });
}

/**
 * Removes large & redundant files from the prepros output folder.
 * @param  {String} outputFolder The output folder.
 * @return {promise}             A promise resolving when cleaning is done.
 */
function lighten(outputFolder) {
  return new Promise((resolve, reject) => {
    try {
      rmdirRf(path.join(outputFolder, 'prepros', 'frames'));
      rmdirRf(path.join(outputFolder, 'prepros', 'audio'));
      resolve();
    } catch (err) {
      reject(err);
    }
  });
}

function runPrepro(file, inputFile, outputFolder, preproConfig) {
  return new Promise((resolve, reject) => {
    prepro(inputFile, outputFolder, preproConfig)
        .then(() => resolve())
        .catch((err) => {
          if (err.services_error) {
            logError(file, err.services_error).then(() => resolve());
          } else {
            reject(err);
          }
        });
  });
}

/**
 * Runs the full pipeline.
 * @param  {String} file The file to process.
 * @return {Promise}     A promise resolving when everything is complete.
 */
function process(doc) {
  const file = doc.id;
  console.log(`\n➜ New file: ${doc.id}`);
  busy = true;
  //
  const preproConfig = {
    'services': doc.services,
  };
  preproConfig.updateInterval = 100;
  preproConfig.onUpdate = (time, services) => {
    const progress = {};
    for (let s of services) {
      progress[s.id] = s.getStatus();
    }
    renders.doc(file).set({progress: progress}, {merge: true});
  };
  //
  inputFile = path.join(dataFolder, file);
  outputFolder = path.join(dataFolder, file + '_result');
  if (!fs.existsSync(outputFolder)) {
    fs.mkdirSync(outputFolder);
  }
  outputFile = inputFile + '.zip';
  const gsUrl = 'gs://' + bucket.name + '/' + dbCollection + '/' + file;
  renders.doc(file)
      .set({status: 'processing'}, {merge: true})
      .then(() => log(file, 'Downloading ' + gsUrl))
      .then(() => download(file))
      .then(() => log(file, `Launching prepro...`))
      .then(() => runPrepro(file, inputFile, outputFolder, preproConfig))
      .then(() => log(file, `Archiving results...`))
      .then(() => lighten(outputFolder))
      .then(() => archive(outputFolder, outputFile))
      .then(() => log(file, `Uploading results...`))
      .then(() => bucket.upload(outputFile))
      .then(() => log(file, 'Updating Firestore...'))
      .then(() => getThumb(outputFolder))
      .then((thumb) => publishResults(file, thumb))
      .then(() => log(file, 'Cleaning up'))
      .then(() => cleanup(inputFile, outputFolder, outputFile))
      .then(() => complete(file))
      .catch((err) => {
        log(file, 'ERROR:' + err + '\n' + err.stack);
        renders.doc(file)
            .set({status: 'error'}, {merge: true})
            .then(() => complete(file))
            .catch((err) => {
              console.error('FATAL:', err);
              complete(file);
            });
      });
}

function publishResults(file, thumb) {
  let status = 'complete';
  // check if any error was reported in the logs
  if (logs[file].filter((l) => l.level == 'error').length) {
    status = 'complete_with_error';
  }
  const result = {
    status: status,
    output: outputFile,
    thumbnail: thumb,
  };
  const statusLog =
      status == 'complete' ? 'Complete!' : 'Complete with errors!';
  return log(file, statusLog).then(() => renders.doc(file).set(result, {
    merge: true
  }));
}

/**
 * Retrieves first frame and convert to base64.
 * @param  {String} outputFolder Path of the output dataFolder.
 * @return {String}              The base64 value of the image.
 */
function getThumb(outputFolder) {
  return new Promise((resolve, reject) => {
    const filePath = path.join(outputFolder, 'prepros', 'thumbnail.jpg');
    const bmp = fs.readFileSync(filePath);
    sharp(bmp)
        .resize(100)
        .jpeg()
        .toBuffer()
        .then((data) => {
          resolve(data.toString('base64'));
        })
        .catch(reject);
  });
}

/**
 * A function called when a processing pipeline is complete.
 * @param  {String} file The file that's been processed.
 */
function complete(file) {
  // clear logs entry
  delete logs[file];
  //
  let idx = -1;
  for (let i = 0; i < queue.length; i++) {
    if (queue[i].id == file) {
      idx = i;
      break;
    }
  }
  if (idx != -1) {
    queue.splice(idx, 1);
  }
  busy = false;
  // Next
  processQueue();
}

/**
 * Handles processing of the items waiting to be processed.
 */
function processQueue() {
  if (!queue.length) {
    console.log('\nQueue is empty. Waiting for new entries in Firestore...');
    return;
  }
  console.log(`\nProcessing next item in queue. ${queue.length} items left.`);
  busy = true;
  const id = queue[0].id;
  // check if item is still waiting
  renders.doc(id)
      .get()
      .then((doc) => {
        if (doc.exists && doc.data().status == 'waiting') {
          process({id: doc.id, services: doc.data().services});
        } else {
          complete(id);
        }
      })
      .catch((err) => {
        console.error(err);
      });
}

console.log(`Prepro demo service v${pjson.version} started.`);
renders.where('status', '==', 'waiting')
    .onSnapshot(
        (snapshot) => {
          snapshot.forEach((doc) => {
            const itemNotInQueue =
                queue.filter((d) => d.id == doc.id).length == 0;
            if (itemNotInQueue && doc.data().status == 'waiting') {
              queue.push({id: doc.id, services: doc.data().services});
            }
          });
          if (!busy) {
            processQueue();
          }
        },
        (err) => {
          console.log(`Error retrieving queue: ${err}`);
        });
