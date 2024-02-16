async function start() {
  let files = await (await fetch('/api/file-list')).json();
  let jobs = await (await fetch('/api/jobs')).json();
  files.sort((a, b) => {
    if (a.folder !== b.folder) {
      return a.folder > b.folder ? 1 : -1;
    }
    return a.size > b.size ? -1 : 1
  });
  let html = '<div class="file-list">', lastFolder;
  for (let { file, folder, size } of files) {
    if (folder[0] === '_') {

    }
    lastFolder !== folder && (html += `<h3>${folder.replace(/_/g, '').replace(/-/g, ' ')}</h3>`);
    lastFolder = folder;
    let job = jobs.find(x => JSON.stringify(x).includes(file));
    let sampleSize = job?.sampleSizePercent;
    let url = job?.url;
    html += `<p><a download href="${file}">${file}</a><span>${niceSize(size)}</span>
       ${lastFolder.includes('samples') ? `<i>sample size: ${sampleSize}%</i>` : ''}</p>
       ${folder[0] === '_' ? `<p class="description"><a href="${url}" target="_blank">
         Beskrivning av data-setet</a></p>` : ''}`;
  }
  html += '</div>';
  document.body.innerHTML = html;
}


function niceSize(x) {
  let prefixes = ['KB', 'MB', 'GB', 'TB'], last;
  for (let i = 1; i <= prefixes.length; i++) {
    let size = (x / 1024 ** i);
    if (size < 1) {
      return last.toFixed(1).replace(/\./, ',') + ' ' + prefixes[i - 2];
    }
    last = size;
  }
}

start();