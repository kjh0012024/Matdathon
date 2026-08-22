const form = document.getElementById('uploadForm');
const jobsEl = document.getElementById('jobs');
const messageEl = document.getElementById('message');
const refreshBtn = document.getElementById('refreshBtn');

function fileToObject(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({
      name: file.name,
      type: file.type,
      data: String(reader.result)
    });
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function collectFiles(input) {
  const files = [...input.files];
  return Promise.all(files.map(fileToObject));
}

async function loadJobs() {
  const response = await fetch('/api/jobs');
  const data = await response.json();
  renderJobs(data.jobs || []);
}

function statusClass(status) {
  return `status ${status}`;
}

function renderJobs(jobs) {
  jobsEl.innerHTML = jobs.length ? jobs.map(job => `
    <article class="job">
      <div class="row">
        <strong>${job.id}</strong>
        <span class="${statusClass(job.status)}">${job.status} · ${job.progress}%</span>
      </div>
      <div class="meta">Created ${new Date(job.createdAt).toLocaleString()}</div>
      <div class="grid">
        <div><span>Slides/PDF</span>${job.inputs.slides.length}</div>
        <div><span>WAV audio</span>${job.inputs.audio.length}</div>
        <div><span>Exam papers</span>${job.inputs.examPapers.length}</div>
      </div>
      ${job.stages?.length ? `
        <details>
          <summary>Stages</summary>
          <pre>${job.stages.map(stage => `${stage.name}: ${stage.status}${stage.errorMessage ? ` (${stage.errorMessage})` : ''}`).join('\n')}</pre>
        </details>
      ` : ''}
      ${job.error ? `<p class="error">${job.error}</p>` : ''}
      ${job.failedStage ? `<p class="result">Failed stage: ${job.failedStage}${job.retryGuidance ? ` · ${job.retryGuidance}` : ''}</p>` : ''}
      ${job.result ? `
        <p class="result">Priority: ${job.result.summary.priorityOrder.join(' > ')}</p>
        <a class="download" href="${job.result.pdfUrl}">Download annotated PDF</a>
      ` : '<p class="hint">Processing in the background…</p>'}
      ${job.result?.annotations?.length ? `<details><summary>Alignment placeholder</summary><pre>${job.result.annotations.map(a => `Slide ${a.slide} → ${a.transcriptRef}`).join('\n')}</pre></details>` : ''}
      <button type="button" class="ghost" data-delete-job="${job.id}">Delete job</button>
    </article>
  `).join('') : '<p class="empty">No jobs yet.</p>';

  document.querySelectorAll('[data-delete-job]').forEach(button => {
    button.addEventListener('click', async () => {
      const jobId = button.getAttribute('data-delete-job');
      const response = await fetch(`/api/jobs/${jobId}`, { method: 'DELETE' });
      if (!response.ok) {
        const data = await response.json();
        messageEl.textContent = data.error || 'Delete failed';
        return;
      }
      messageEl.textContent = `Deleted ${jobId}`;
      await loadJobs();
    });
  });
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  messageEl.textContent = 'Uploading…';

  const slides = await collectFiles(document.getElementById('slides'));
  const audio = await collectFiles(document.getElementById('audio'));
  const examPapers = await collectFiles(document.getElementById('examPapers'));
  const payload = {
    slides,
    audio,
    examPapers,
    examText: document.getElementById('examText').value,
    reviewText: document.getElementById('reviewText').value
  };

  const response = await fetch('/api/jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const result = await response.json();
  if (!response.ok) {
    messageEl.textContent = result.error || 'Upload failed';
    return;
  }
  messageEl.textContent = `Created ${result.job.id}`;
  form.reset();
  await loadJobs();
});

refreshBtn.addEventListener('click', loadJobs);
loadJobs();
setInterval(loadJobs, 2000);
