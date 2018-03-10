const gsPath = 'gs://prepro-demo.appspot.com/';
const el = document.querySelector('.status');
const userLogsViewState = {};

if (window.test) {
  renderQueue(window.test.docs);
} else {
  const db = firebase.firestore();
  db.collection('renders')
      .orderBy('added_at', 'desc')
      .limit(5)
      .onSnapshot(renderQueue);
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
              <span>${doc.id.slice(doc.id.indexOf('_') + 1)}</span>
              <div class="date">
                ${date.toLocaleDateString()} - ${date.toLocaleTimeString()}
              </div>
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
          ${getDetails(data)}
        </div>
      `;
    let renderEl = document.createElement('div');
    els[data.status].appendChild(renderEl);
    renderEl.outerHTML = html;
  });
  setupLogs();
  setupDownload();
}

function getLabels(data) {
  let logsHTML = '';
  if ((typeof data.logs) == 'string') {
    logsHTML = `<span>${data.logs.split('.').shift()}</span>`;
  } else {
    for (let log in data.logs) {
      if (['video2audio', 'video2kfvideo', 'video2frames'].indexOf(log) > -1) {
        continue;
      }
      logsHTML += `<span>${log.split(2).pop()}</span>`;
    }
  }
  return `
    <div class="labels">
      ${logsHTML}
    </div>
  `;
}

function getDetails(data) {
  let logsHTML = '';
  if ((typeof data.logs) == 'string') {
    logsHTML = `<span>${data.logs}</span>`;
  } else {
    for (let log in data.logs) {
      logsHTML += `<span>${log}: ${data.logs[log]}</span><br>`;
    }
  }
  return `
    <div class="detail">
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

function getStatus(data) {
  switch (data.status) {
    case 'waiting':
      return `<div class="status waiting">hourglass_empty</div>`;
    case 'processing':
      return `<div class="status processing">➜</div>`;
    case 'error':
      return `<div class="status error">x</div>`;
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
  if (bt.href.indexOf('http') != -1) {
    return;
  }
  evt.preventDefault();
  let docId = bt.dataset['id'];
  getDownloadURL(docId).then((url) => {
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
