const defaultServices = [
  'frames2colors',
  'remote/audio2spectrogram',
  'remote/video2openpose',
  'remote/frames2flow',
  'remote/frames2segmentation',
  'remote/frames2detection',
  'remote/frames2sift',
  'remote/frames2depth',
];

let uploadedFile = null;
let selectedServices = [];
let userEmail = null;
const submitBt = document.querySelector('.bt-submit');

function fileChanged(evt) {
  const file = evt.target.files[0];
  if (!file) {
    return;
  }
  if (file.size / (1000 * 1000) > 10) {
    alert('The maximum file size is currently limited to 10mo.');
    evt.target.value = null;
    return;
  }
  if (!file.type.startsWith('video')) {
    alert('File must be a video.');
    evt.target.value = null;
    return;
  }

  document.body.classList.add('uploading');
  document.body.classList.remove('uploaded');

  const filename = Date.now() + '_' + file.name;
  const ref = firebase.storage().ref(dbCollection + '/' + filename);
  const statusEl = document.body.querySelector('.upload-status');
  uploadedFile = null;
  ref.put(file).on(
      firebase.storage.TaskEvent.STATE_CHANGED,
      // State changed
      (evt) => {
        const progress = (evt.bytesTransferred / evt.totalBytes) * 100;
        const el = statusEl.querySelector('span');
        el.innerHTML = `Uploading... ${Math.round(progress)}%`;
      },
      // Upload error
      (error) => {
        console.err(error);
      },
      // Upload complete
      (snapshot) => {
        document.body.classList.add('uploaded');
        // document.body.classList.remove('uploading');
        statusEl.innerHTML =
            '<i class="material-icons">check_circle</i> ' + filename;
        uploadedFile = filename;
        updateSubmitAbility();
      });
}

function setupServiceSelection() {
  const el = document.querySelector('.service-selection');
  let output = '';
  for (let service of defaultServices) {
    output += `
      <span class="service-checkbox">
        <input type="checkbox" name="${service}" value="${service}" />
        <label>${service.split('2').pop()}</label>
      </span>
    `;
  }
  el.innerHTML = output;
  console.log('done');
  // interaction
  const checkboxes = el.querySelectorAll('input');
  for (let c of checkboxes) {
    c.addEventListener('change', (evt) => {
      const service = evt.currentTarget.value;
      if (evt.currentTarget.checked &&
          selectedServices.indexOf(service) == -1) {
        selectedServices.push(service);
      } else if (
          !evt.currentTarget.checked &&
          selectedServices.indexOf(service) != -1) {
        const index = selectedServices.indexOf(service);
        selectedServices.splice(index, 1);
      }
      updateSubmitAbility();
    });
  }
}

function updateSubmitAbility() {
  submitBt.classList.add('disabled');
  if (uploadedFile && selectedServices.length) {
    submitBt.classList.remove('disabled');
  }
}

function submit() {
  if (!uploadedFile || !selectedServices.length) {
    return;
  }
  // log
  const el = document.body.querySelector('.upload-section');
  el.innerHTML = `
    <p>Submitting job ${uploadedFile}...</p>
  `;
  // submit job
  const services = selectedServices.map((s) => ({'id': s}));
  firebase.firestore()
      .collection(dbCollection)
      .doc(uploadedFile)
      .set({
        status: 'waiting',
        added_at: Date.now(),
        services: services,
        user: userEmail
      })
      .then(() => {
        el.innerHTML = `
      <p>Job ${uploadedFile} Submitted!</p>
    `;
      });
}

function setup() {
  const uploadBt = document.getElementById('file');
  uploadBt.addEventListener('change', fileChanged, false);
  submitBt.addEventListener('click', submit);
  setupServiceSelection();

  document.querySelector('.upload-section').style.opacity = 1;
}

setup();

firebase.auth().onAuthStateChanged(function(user) {
  if (user) {
    userEmail = user.email;
  } else {
    console.log('signed out');
    window.location.href = 'login.html';
  }
});
