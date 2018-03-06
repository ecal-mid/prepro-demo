const defaultServices = [
  'frames2colors',
  'remote/audio2spectrogram',
  'remote/video2openpose',
  'remote/frames2flow',
  'remote/frames2segmentation',
  'remote/frames2sift',
];

let uploadedFile = null;
let selectedServices = [];
const submitBt = document.querySelector('.bt-submit');

function fileChanged(evt) {
  document.body.classList.add('uploading');
  document.body.classList.remove('uploaded');
  const file = evt.target.files[0];
  const filename = Date.now() + '_' + file.name;
  const ref = firebase.storage().ref(filename);
  uploadedFile = null;
  ref.put(file).then((snapshot) => {
    document.body.classList.add('uploaded');
    // document.body.classList.remove('uploading');
    document.body.querySelector('.upload-status').innerHTML = '✓ ' + filename;
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
  const el = document.body.querySelector('main');
  el.innerHTML = `
    <p>Submitting job ${uploadedFile}...</p>
  `;
  // submit job
  const services = selectedServices.map((s) => ({'id': s}));
  firebase.firestore()
      .collection('renders')
      .doc(uploadedFile)
      .set({status: 'waiting', added_at: Date.now(), services: services})
      .then(() => {
        window.location.href = 'queue.html';
      });
}

function setup() {
  const uploadBt = document.getElementById('file');
  uploadBt.addEventListener('change', fileChanged, false);

  submitBt.addEventListener('click', submit);

  setupServiceSelection();
}

setup();
