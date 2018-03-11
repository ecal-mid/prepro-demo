const gsPath = 'gs://prepro-demo.appspot.com/';
const el = document.querySelector('.status');
const userLogsViewState = {};

if (window.test) {
  renderQueue(window.test.docs);
} else {
  firebase.auth().onAuthStateChanged(function(user) {
    if (user) {
      const db = firebase.firestore();
      const viewAll = window.location.href.indexOf('viewAll') != -1;
      if (viewAll) {
        db.collection(dbCollection)
            .orderBy('added_at', 'desc')
            .limit(25)
            .onSnapshot(renderQueue);
      } else {
        db.collection(dbCollection)
            .where('user', '==', user.email)
            .orderBy('added_at', 'desc')
            .limit(15)
            .onSnapshot(renderQueue);
      }
    } else {
      console.log('signed out');
      window.location.href = 'login.html';
    }
  });
}

function renderQueue(docs) {
  document.body.classList.remove('loading');
  const els = {
    'complete': el.querySelector('.status-done'),
    'error': el.querySelector('.status-done'),
    'processing': el.querySelector('.status-processing'),
    'waiting': el.querySelector('.status-waiting')
  };
  for (let e in els) {
    els[e].innerHTML = '';
  }
  const elProcessing = el.querySelector('.status-processing');
  const elWaiting = el.querySelector('.status-waiting');
  docs.forEach((doc) => {
    const date = new Date(parseInt(doc.id.split('_')[0]));
    const data = doc.data();
    // resume logs visibility status
    let classes = data.status == 'processing' ? 'logs-expanded' : '';
    if (userLogsViewState[doc.id]) {
      classes = 'logs-expanded';
    }
    html = `
        <div class="render ${data.status} ${classes}" data-id="${doc.id}">
          <div class="infos">
            ${getStatus(data)}
            ${getThumbnail(data)}
            <div class="title">
              <h4>${doc.id.slice(doc.id.indexOf('_') + 1)}</h4>
              <span class="date">
                - ${date.toLocaleDateString()} - ${date.toLocaleTimeString()}
              </span>
              ${getLabels(data)}
            </div>
            <a class="bt logs-bt" href="#" data-id="${doc.id}">
              <i class="material-icons">subject</i>
              <span>logs</span>
            </a>
            <a class="bt download-bt" href="#" data-id="${doc.id}">
              <i class="material-icons">file_download</i>
              <span>Download</span>
            </a>
          </div>
          ${getLogs(data)}
          ${getProgress(data)}
        </div>
      `;
    let renderEl = document.createElement('div');
    const elName =
        data.status == 'complete_with_error' ? 'complete' : data.status;
    els[elName].appendChild(renderEl);
    renderEl.outerHTML = html;
  });
  setupLogs();
  setupDownload();
}

function getLabels(data) {
  let logsHTML = '';
  const ignore = ['video2audio', 'video2kfvideo', 'video2frames'];
  for (let progress in data.progress) {
    if (ignore.indexOf(progress) > -1) {
      continue;
    }
    logsHTML += `<span>${progress.split(2).pop()}</span>`;
  }
  return `
    <div class="labels">
      ${logsHTML}
    </div>
  `;
}

function getLogs(data) {
  if (!data.log || data.log.length == 0) {
    return '';
  }
  let logsHTML = '';
  for (let log of data.log) {
    if (log.level == 'error') {
      logsHTML += `<span class="error">${log.value}</span><br>`;
    } else {
      logsHTML += `<span>${log.value}</span><br>`;
    }
  }
  return `
    <div class="detail">
      ${logsHTML}
    </div>
  `;
}

function getProgress(data) {
  let logsHTML = '';
  if (!data.progress || Object.keys(data.progress).length == 0) {
    return '';
  }
  for (let service in data.progress) {
    const val = data.progress[service];
    if (val == 'error') {
      logsHTML += `<span class="error">${service}: ${val}</span><br>`;
    } else {
      logsHTML += `<span>${service}: ${val}</span><br>`;
    }
  }
  return `
    <div class="progress">
      ${logsHTML}
    </div>
  `;
}

function getThumbnail(data) {
  if (data.thumbnail) {
    return `<img src="data:image/png;base64,${data.thumbnail}" />`;
  }
  return '';
}

function getHasError(data) {
  if ((typeof data.logs) == 'string') {
    return data.logs.indexOf('error') != -1;
  } else {
    for (let log in data.logs) {
      if (data.logs[log].indexOf('error') != -1) {
        return true;
      }
    }
  }
  return false;
}

function getStatus(data) {
  switch (data.status) {
    case 'waiting':
      return `<div class="status waiting"><i class="material-icons">hourglass_full</i></div>`;
    case 'processing':
      return `<div class="status processing"><img src="assets/preload.svg" width="30px" height="30px"/></div>`;
    case 'error':
      return `<div class="status error"><i class="material-icons">error</i></div>`;
    case 'complete_with_error':
      return `<div class="status warning"><i class="material-icons">warning</i></div>`;
    case 'complete':
      return `<div class="status complete"><i class="material-icons">check_circle</i></div>`;
  }
  return '';
}

function setupLogs() {
  const renderEls = el.querySelectorAll('.render');
  for (let rEl of renderEls) {
    let bt = rEl.querySelector('.logs-bt');
    bt.addEventListener('click', (evt) => {
      evt.preventDefault();
      if (rEl.classList.contains('logs-expanded')) {
        rEl.classList.remove('logs-expanded');
        delete userLogsViewState[rEl.dataset['id']];
      } else {
        rEl.classList.add('logs-expanded');
        userLogsViewState[rEl.dataset['id']] = true;
      }
    });
  }
}

function setupDownload() {
  const renderEls = el.querySelectorAll('.render');
  for (let rEl of renderEls) {
    let bt = rEl.querySelector('.download-bt');
    bt.addEventListener('click', onDownloadClicked);
  }
}

function onDownloadClicked(evt) {
  let bt = evt.currentTarget;
  if (bt.href.indexOf('firebasestorage') != -1) {
    return;
  }
  evt.preventDefault();
  const prevHTML = bt.innerHTML;
  bt.innerHTML =
      '<img src="assets/preload.svg" width="30" height="30"><span>Download</span>'
  let docId = bt.dataset['id'];
  getDownloadURL(docId).then((url) => {
    bt.innerHTML = prevHTML;
    bt.href = url;
    bt.click();
  });
}

function getDownloadURL(file) {
  const fullPath = gsPath + file + '.zip';
  let ref = firebase.storage().refFromURL(fullPath);
  return ref.getDownloadURL()
      .then((url) => url)
      .catch((error) => console.error(error));
}
