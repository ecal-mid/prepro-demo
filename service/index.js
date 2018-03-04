const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const prepro = require('./prepro')
const archive = require('./archive');
const {rmdirRf} = require('./utils');

const queue = [];
let busy = false;

// Initialize Firebase
const key = path.join(__dirname, 'secret', 'prepro-demo-ef38120f330f.json');
const serviceAccount = require(key);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'prepro-demo.appspot.com'
});
const bucket = admin.storage().bucket();
const db = admin.firestore();
const renders = db.collection('renders');
const dataFolder = path.join('.', 'tmp');
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
  return new Promise((resolve) => {
    console.log.apply(console, args);
    resolve();
  });
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
  const p = bucket.file(file).download(options);
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
      resolve();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Runs the full pipeline.
 * @param  {String} file The file to process.
 * @return {Promise}     A promise resolving when everything is complete.
 */
function process(file) {
  log(file, `\n➜ New file: ${file}`);
  busy = true;
  //
  const preproConfig = {
    'services': [
      {'id': 'video2frames'},
      {'id': 'video2audio'},
    ]
  };
  preproConfig.updateInterval = 100;
  preproConfig.onUpdate = (time, services) => {
    const status = {};
    for (let s of services) {
      status[s.id] = s.getStatus();
    }
    renders.doc(file).set({log: status}, {merge: true});
  };
  //
  inputFile = path.join(dataFolder, file);
  outputFolder = path.join(dataFolder, file + '_result');
  if (!fs.existsSync(outputFolder)) {
    fs.mkdirSync(outputFolder);
  }
  outputFile = inputFile + '.zip';
  renders.doc(file)
      .set({status: 'processing'}, {merge: true})
      .then(() => log(file, 'Downloading gs://' + bucket.name + '/' + file))
      .then(() => download(file))
      .then(() => log(file, 'Done.'))
      .then(() => log(file, `Launching prepro...`))
      .then(() => log(file, 'Done.'))
      .then(() => prepro(inputFile, outputFolder, preproConfig))
      .then(() => log(file, `Archiving results...`))
      .then(() => log(file, 'Done.'))
      .then(() => archive(outputFolder, outputFile))
      .then(() => log(file, `Uploading results...`))
      .then(() => bucket.upload(outputFile))
      .then(() => log(file, 'Done.'))
      .then(() => log(file, 'Updating Firestore...'))
      .then(
          () => renders.doc(file).set(
              {status: 'complete', output: outputFile}, {merge: true}))
      .then(() => log(file, 'Done.'))
      .then(() => cleanup(inputFile, outputFolder, outputFile))
      .then(() => log(file, '✓ Complete!'))
      .then(() => complete(file))
      .catch((err) => {
        console.error('ERROR:', err);
        renders.doc(file).set({status: 'error'}, {merge: true});
        cleanup(inputFile, outputFolder, outputFile);
        complete(file);
      });
}

/**
 * A function called when a processing pipeline is complete.
 * @param  {String} file The file that's been processed.
 */
function complete(file) {
  const idx = queue.indexOf(file);
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
  const id = queue[0];
  // check if item is still waiting
  renders.doc(id)
      .get()
      .then((doc) => {
        if (doc.exists && doc.data().status == 'waiting') {
          process(id);
        } else {
          complete(id);
        }
      })
      .catch((err) => {
        console.error(err);
      });
}

console.log('Prepro demo service started.');
renders.where('status', '==', 'waiting')
    .onSnapshot(
        (snapshot) => {
          snapshot.forEach((doc) => {
            if (queue.indexOf(doc.id) == -1 && doc.data().status == 'waiting') {
              queue.push(doc.id);
            }
          });
          if (!busy) {
            processQueue();
          }
        },
        (err) => {
          console.log(`Error retrieving queue: ${err}`);
        });
