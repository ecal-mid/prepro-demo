// Set the configuration for your app
// TODO: Replace with your project's config object
const config = {
  apiKey: 'AIzaSyBoC61NkAYNDzJcrQ5XzIWCyJlj9LmPdS4',
  authDomain: 'prepro-demo.firebaseapp.com',
  databaseURL: 'https://prepro-demo.firebaseio.com',
  projectId: 'prepro-demo',
  storageBucket: 'prepro-demo.appspot.com',
  messagingSenderId: '509920373280'
};

if (window.firebase) {
  firebase.initializeApp(config);
  firebase.auth().signInAnonymously().catch(function(error) {
    console.error(error.code, error.message);
  });
}
