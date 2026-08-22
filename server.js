const http = require('http');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { createCopilotStageRunner } = require('./src/orchestration/copilot');
const { createCopilotSdkRunner } = require('./src/orchestration/copilot-sdk');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');
const JOBS_DIR = path.join(DATA_DIR, 'jobs');
const STATE_FILE = path.join(DATA_DIR, 'state.json');

const jobs = new Map();
const scheduled = new Map();

async function ensureDirs() {
  await fsp.mkdir(PUBLIC_DIR, { recursive: true });
  await fsp.mkdir(JOBS_DIR, { recursive: true });
}

function safeName(name) {
  return String(name || 'file').replace(/[^a-zA-Z0-9._-]+/g, '_');
}

function extName(name) {
  return path.extname(String(name || '')).toLowerCase();
}

function isPdf(file) {
  return file?.type === 'application/pdf' || extName(file?.name) === '.pdf';
}

function isAudio(file) {
  return (file?.type || '').startsWith('audio/') || extName(file?.name) === '.wav';
}

function isTextFile(file) {
  return file?.type === 'text/plain' || ['.txt', '.md', '.json'].includes(extName(file?.name));
}

function createStorageAdapter() {
  return {
    async saveJob(jobId, job) {
      jobs.set(jobId, job);
      await saveState();
    },
    async writeArtifact(jobId, fileName, buffer) {
      const jobDir = path.join(JOBS_DIR, jobId);
      await fsp.mkdir(jobDir, { recursive: true });
      const filePath = path.join(jobDir, fileName);
      await fsp.writeFile(filePath, buffer);
      return filePath;
    },
    async deleteJob(jobId) {
      jobs.delete(jobId);
      await fsp.rm(path.join(JOBS_DIR, jobId), { recursive: true, force: true });
      await saveState();
    }
  };
}

function createSlideParser() {
  return {
    parse(job) {
      return job.inputs.slides.map((file, index) => ({
        page: index + 1,
        title: `Slide ${index + 1}`,
        source: file.name,
        content: `Parsed content from ${file.name}`
      }));
    }
  };
}

const storage = createStorageAdapter();
const slideParser = createSlideParser();
const sdkRunner = createCopilotSdkRunner({
  logger: console,
  store: {
    async getSlides(jobId) {
      const job = jobs.get(jobId);
      return job ? job.inputs.slides : [];
    }
  }
});
const copilotRunner = createCopilotStageRunner({
  sdkRunner
});

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fsp.readFile(file, 'utf8'));
  } catch {
    return fallback;
  }
}

async function writeJson(file, value) {
  await fsp.writeFile(file, JSON.stringify(value, null, 2), 'utf8');
}

async function loadState() {
  const state = await readJson(STATE_FILE, { jobs: [] });
  for (const job of state.jobs || []) jobs.set(job.id, job);
}

async function saveState() {
  await writeJson(STATE_FILE, { jobs: [...jobs.values()] });
}

function nowIso() {
  return new Date().toISOString();
}

function makeJobId() {
  return `job_${crypto.randomUUID()}`;
}

function summarizeJob(job) {
  return {
    id: job.id,
    status: job.status,
    progress: job.progress,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    error: job.error || null,
    failedStage: job.failedStage || null,
    retryGuidance: job.retryGuidance || null,
    stages: job.stages || [],
    inputs: {
      slides: job.inputs.slides.map(({ name, size, type }) => ({ name, size, type })),
      audio: job.inputs.audio.map(({ name, size, type }) => ({ name, size, type })),
      examPapers: job.inputs.examPapers.map(({ name, size, type }) => ({ name, size, type })),
      examText: job.inputs.examText ? { length: job.inputs.examText.length } : null,
      reviewText: job.inputs.reviewText ? { length: job.inputs.reviewText.length } : null
    },
    result: job.result ? {
      pdfUrl: `/api/jobs/${job.id}/result.pdf`,
      annotations: job.result.annotations,
      summary: job.result.summary
    } : null
  };
}

function buildPromptOrder(job) {
  const priorities = [];
  if (job.inputs.examPapers.length || job.inputs.examText) priorities.push('exam papers');
  if (job.inputs.slides.length) priorities.push('lecture materials');
  if (job.inputs.audio.length) priorities.push('lecture audio transcript');
  if (job.inputs.reviewText) priorities.push('course reviews');
  return priorities;
}

function validateStageOutput(stageName, output) {
  if (!output) throw new Error(`${stageName} produced no output`);
}

function updateStage(job, stageName, patch) {
  const stages = job.stages || [];
  let stage = stages.find(item => item.name === stageName);
  if (!stage) {
    stage = { name: stageName };
    stages.push(stage);
  }
  Object.assign(stage, patch);
  job.stages = stages;
}

function classifyJobStage(errorMessage) {
  const message = String(errorMessage || '').toLowerCase();
  if (message.includes('transcript')) return 'transcription';
  if (message.includes('slide')) return 'slide-matching';
  if (message.includes('pdf')) return 'pdf-generation';
  return 'processing';
}

async function deleteJobArtifacts(jobId) {
  await fsp.rm(path.join(JOBS_DIR, jobId), { recursive: true, force: true });
}

async function deleteJobRecord(jobId) {
  jobs.delete(jobId);
  await saveState();
}

async function processJob(jobId, runner) {
  if (scheduled.has(jobId)) return;
  const timer = setTimeout(async () => {
    scheduled.delete(jobId);
    const job = jobs.get(jobId);
    if (!job || job.status !== 'queued') return;

    try {
      job.status = 'processing';
      job.progress = 10;
      updateStage(job, 'parsing-and-transcription', { status: 'running', startedAt: nowIso() });
      await saveState();

      const pipelineResult = await runner.runPipeline(job);
      const stageResult = pipelineResult.transcript;
      validateStageOutput('parsing-and-transcription', stageResult);
      updateStage(job, 'parsing-and-transcription', {
        status: 'completed',
        endedAt: nowIso(),
        outputSummary: { chunks: stageResult.chunks.length, provider: stageResult.provider }
      });
      job.progress = 45;
      await saveState();

      updateStage(job, 'slide-matching', { status: 'running', startedAt: nowIso() });
      const matched = { annotations: pipelineResult.annotations };
      validateStageOutput('slide-matching', matched);
      updateStage(job, 'slide-matching', {
        status: 'completed',
        endedAt: nowIso(),
        outputSummary: { annotations: matched.annotations.length }
      });
      job.progress = 70;
      await saveState();

      updateStage(job, 'packaging', { status: 'running', startedAt: nowIso() });
      const summary = {
        priorityOrder: buildPromptOrder(job),
        transcriptionProvider: stageResult.provider
      };
      const pdfBuffer = await sdkRunner.package(job, matched.annotations, summary);
      validateStageOutput('packaging', pdfBuffer);
      await storage.writeArtifact(jobId, 'study-packet.pdf', pdfBuffer);
      await storage.writeArtifact(jobId, 'result.json', Buffer.from(JSON.stringify({
        annotations: matched.annotations,
        summary: {
          priorityOrder: buildPromptOrder(job),
          alignmentMode: 'temporal-order',
          examPriorityApplied: Boolean(job.inputs.examPapers.length || job.inputs.examText)
        }
      }, null, 2)));
      updateStage(job, 'packaging', {
        status: 'completed',
        endedAt: nowIso(),
        outputSummary: { pdf: true }
      });

      job.status = 'completed';
      job.progress = 100;
      job.updatedAt = nowIso();
      job.result = {
        annotations: matched.annotations,
        summary: {
          priorityOrder: buildPromptOrder(job),
          alignmentMode: 'temporal-order',
          examPriorityApplied: Boolean(job.inputs.examPapers.length || job.inputs.examText)
        }
      };
      await storage.saveJob(jobId, job);
    } catch (error) {
      const failedStage = classifyJobStage(error.message || 'Unknown failure');
      job.status = 'failed';
      job.progress = 100;
      job.error = error.message || 'Unknown failure';
      job.failedStage = failedStage;
      job.retryGuidance = `Retry from ${failedStage} after correcting the input or transient error.`;
      updateStage(job, failedStage, { status: 'failed', endedAt: nowIso(), errorMessage: job.error });
      job.updatedAt = nowIso();
      await saveState();
    }
  }, 1200);
  scheduled.set(jobId, timer);
}

async function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > 80 * 1024 * 1024) {
        reject(new Error('Payload too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

async function handleCreateJob(req, res) {
  const body = await parseJsonBody(req);
  const slideFiles = Array.isArray(body.slides) ? body.slides : [];
  const audioFiles = Array.isArray(body.audio) ? body.audio : [];
  const examFiles = Array.isArray(body.examPapers) ? body.examPapers : [];

  if (!slideFiles.length || !audioFiles.length) {
    return sendJson(res, 400, { error: 'Lecture slide/PDF and lecture audio are required.' });
  }

  if (slideFiles.length > 1 || audioFiles.length > 1) {
    return sendJson(res, 400, { error: 'The MVP supports one slide/PDF and one WAV audio file per job.' });
  }

  const invalid = [...slideFiles, ...audioFiles, ...examFiles].find(file => file && !isPdf(file) && !isAudio(file) && !isTextFile(file));
  if (invalid) {
    return sendJson(res, 400, { error: `Unsupported file type: ${invalid.name || 'unknown file'}` });
  }

  if (jobs.size > 0) {
    return sendJson(res, 409, { error: 'Only one active job is supported in the MVP.' });
  }

  const jobId = makeJobId();
  const jobDir = path.join(JOBS_DIR, jobId);
  await fsp.mkdir(jobDir, { recursive: true });

  const saveFiles = async (files, kind) => {
    const stored = [];
    for (const file of files) {
      const name = safeName(file.name);
      const buffer = file.data ? Buffer.from(String(file.data).split(',').pop(), 'base64') : Buffer.from(String(file.text || ''), 'utf8');
      const filePath = path.join(jobDir, `${kind}-${name}`);
      await fsp.writeFile(filePath, buffer);
      stored.push({
        name: file.name,
        type: file.type || (kind === 'examText' ? 'text/plain' : 'application/octet-stream'),
        size: buffer.length,
        path: filePath
      });
    }
    return stored;
  };

  const job = {
    id: jobId,
    status: 'queued',
    progress: 0,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    error: null,
    failedStage: null,
    retryGuidance: null,
    stages: [],
    inputs: {
      slides: await saveFiles(slideFiles, 'slides'),
      audio: await saveFiles(audioFiles, 'audio'),
      examPapers: await saveFiles(examFiles, 'exam'),
      examText: typeof body.examText === 'string' && body.examText.trim() ? String(body.examText).trim() : '',
      reviewText: typeof body.reviewText === 'string' && body.reviewText.trim() ? String(body.reviewText).trim() : ''
    },
    result: null
  };

  await storage.saveJob(jobId, job);
  processJob(jobId, copilotRunner);
  return sendJson(res, 201, { job: summarizeJob(job) });
}

async function handleDeleteJob(req, res, jobId) {
  if (!jobs.has(jobId)) {
    return sendJson(res, 404, { error: 'Job not found' });
  }
  await deleteJobArtifacts(jobId);
  await deleteJobRecord(jobId);
  return sendJson(res, 200, { ok: true });
}

async function handleJobDetail(req, res, jobId) {
  const job = jobs.get(jobId);
  if (!job) {
    return sendJson(res, 404, { error: 'Job not found' });
  }
  return sendJson(res, 200, summarizeJob(job));
}

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

async function serveStatic(req, res, urlPath) {
  const filePath = path.join(PUBLIC_DIR, urlPath === '/' ? 'index.html' : urlPath);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  try {
    const data = await fsp.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const type = ext === '.html' ? 'text/html; charset=utf-8'
      : ext === '.js' ? 'application/javascript; charset=utf-8'
      : ext === '.css' ? 'text/css; charset=utf-8'
      : ext === '.pdf' ? 'application/pdf'
      : 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
}

async function start() {
  await ensureDirs();
  await loadState();
  for (const job of jobs.values()) {
    if (job.status === 'queued' || job.status === 'processing') {
      job.status = 'queued';
      job.progress = 0;
      processJob(job.id, copilotRunner);
    }
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    try {
      if (req.method === 'GET' && url.pathname === '/api/jobs') {
        return sendJson(res, 200, { jobs: [...jobs.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(summarizeJob) });
      }
      if (req.method === 'GET' && /^\/api\/jobs\/[^/]+$/.test(url.pathname)) {
        return await handleJobDetail(req, res, url.pathname.split('/')[3]);
      }
      if (req.method === 'POST' && url.pathname === '/api/jobs') {
        return await handleCreateJob(req, res);
      }
      if (req.method === 'DELETE' && /^\/api\/jobs\/[^/]+$/.test(url.pathname)) {
        return await handleDeleteJob(req, res, url.pathname.split('/')[3]);
      }
      if (req.method === 'GET' && /^\/api\/jobs\/[^/]+\/result\.pdf$/.test(url.pathname)) {
        const jobId = url.pathname.split('/')[3];
        const job = jobs.get(jobId);
        const pdfPath = path.join(JOBS_DIR, jobId, 'study-packet.pdf');
        if (!job || job.status !== 'completed' || !fs.existsSync(pdfPath)) {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('Result not available');
          return;
        }
        const pdf = await fsp.readFile(pdfPath);
        res.writeHead(200, {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="agenta-study-packet-${jobId}.pdf"`
        });
        res.end(pdf);
        return;
      }
      return await serveStatic(req, res, url.pathname);
    } catch (error) {
      sendJson(res, 500, { error: error.message || 'Server error' });
    }
  });

  server.listen(PORT, () => {
    console.log(`AgentA+ running at http://localhost:${PORT}`);
  });
}

start().catch(error => {
  console.error(error);
  process.exit(1);
});
