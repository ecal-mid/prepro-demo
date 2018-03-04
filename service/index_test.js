const path = require('path');
const admin = require('firebase-admin');
const key = path.join(__dirname, 'secret', 'prepro-demo-ef38120f330f.json');
const serviceAccount = require(key);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'prepro-demo.appspot.com'
});

const bucket = admin.storage().bucket();

const db = admin.firestore();
const renders = db.collection('renders');

//

function upload(file) {
  const id = Date.now() + '_' + file;
  console.log(`Uploading ${file}...`);
  bucket.upload(file, {destination: id})
      .then(() => {
        console.log(`Done.`);
        console.log(`Adding entry to firestore...`);
      })
      .then(() => renders.doc(id).set({
        status: 'waiting',
      }))
      .then(() => {
        console.log(`Done.`);
      })
      .catch((err) => {
        console.error('ERROR:', err);
      });
}

upload('video_test_micro.mov');
