const http = require('http');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');
const JOBS_DIR = path.join(DATA_DIR, 'jobs');
const STATE_FILE = path.join(DATA_DIR, 'state.json');

const jobs = new Map();
const scheduled = new Map();
const supportedAudioExts = new Set(['.wav']);
const supportedSlideExts = new Set(['.pdf', '.pptx']);

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

function isSlideFile(file) {
  return isPdf(file) || supportedSlideExts.has(extName(file?.name));
}

function isAudio(file) {
  return (file?.type || '').startsWith('audio/') || supportedAudioExts.has(extName(file?.name));
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
    async loadJobs() {
      return [...jobs.values()];
    },
    async writeArtifact(jobId, fileName, buffer) {
      const jobDir = path.join(JOBS_DIR, jobId);
      await fsp.mkdir(jobDir, { recursive: true });
      const filePath = path.join(jobDir, fileName);
      await fsp.writeFile(filePath, buffer);
      return filePath;
    },
    async readArtifact(jobId, fileName) {
      return fsp.readFile(path.join(JOBS_DIR, jobId, fileName));
    },
    async deleteJob(jobId) {
      jobs.delete(jobId);
      const jobDir = path.join(JOBS_DIR, jobId);
      await fsp.rm(jobDir, { recursive: true, force: true });
      await saveState();
    }
  };
}

function createTranscriptAdapter() {
  return {
    transcribe(job) {
      const chunks = job.inputs.audio.map((file, index) => ({
        id: index + 1,
        start: index * 60,
        end: (index + 1) * 60,
        text: `Transcript chunk from ${file.name}`
      }));
      return {
        provider: 'local-placeholder',
        chunks
      };
    }
  };
}

function createCopilotOrchestrator() {
  return {
    runStage(stageName, input, handler) {
      const result = handler(input);
      return result;
    },
    runPipeline(job, stages) {
      const output = {};
      for (const stage of stages) {
        output[stage.name] = this.runStage(stage.name, stage.input(job, output), stage.handler);
      }
      return handler(input);
    }
  };
}

function createSlideParser() {
  return {
    parse(job) {
      const slideCount = Math.max(1, job.inputs.slides.length);
      return job.inputs.slides.map((file, index) => ({
        page: index + 1,
        title: `Slide ${index + 1}`,
        source: file.name,
        content: `Parsed content from ${file.name}`,
        slideCount
      }));
    }
  };
}

function createPdfRenderer() {
  return {
    render(lines) {
      return buildPdfBuffer(lines);
    }
  };
}

const storage = createStorageAdapter();
const transcriptAdapter = createTranscriptAdapter();
const slideParser = createSlideParser();
const pdfRenderer = createPdfRenderer();
const copilotOrchestrator = createCopilotOrchestrator();

async function readJson(file, fallback) {
  try {
    const raw = await fsp.readFile(file, 'utf8');
    return JSON.parse(raw);
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

function base64ToBuffer(dataUrlOrBase64) {
  const value = String(dataUrlOrBase64 || '');
  const raw = value.includes(',') ? value.split(',').pop() : value;
  return Buffer.from(raw, 'base64');
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
    inputs: {
      slides: job.inputs.slides.map(({ name, size, type }) => ({ name, size, type })),
      audio: job.inputs.audio.map(({ name, size, type }) => ({ name, size, type })),
      examPapers: job.inputs.examPapers.map(({ name, size, type }) => ({ name, size, type })),
      examText: job.inputs.examText ? { length: job.inputs.examText.length } : null,
      reviewText: job.inputs.reviewText ? { length: job.inputs.reviewText.length } : null,
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

function makeAnnotations(job, transcript) {
  const slides = slideParser.parse(job);
  const chunks = transcript.chunks.length ? transcript.chunks : [{ id: 1, start: 0, end: 60, text: 'No audio transcript available' }];
  return slides.map((slide, index) => {
    const chunk = chunks[Math.min(index, chunks.length - 1)];
    return {
      slide: slide.page,
      transcriptRef: `Transcript chunk ${chunk.id} (${chunk.start}-${chunk.end}s)`,
      emphasis: index === 0
        ? 'Priority topic from lecture + exam signals'
        : 'Aligned by temporal chunk order',
      slideTitle: slide.title,
      transcriptText: chunk.text
    };
  });
}

function classifyJobStage(errorMessage) {
  const message = String(errorMessage || '').toLowerCase();
  if (message.includes('transcript')) return 'transcription';
  if (message.includes('slide')) return 'slide-matching';
  if (message.includes('pdf')) return 'pdf-generation';
  if (message.includes('ocr')) return 'ocr';
  return 'processing';
}

function extractJobStageResult(job) {
  return {
    transcript: transcriptAdapter.transcribe(job),
    slides: slideParser.parse(job)
  };
}

function parseAndMatch(job) {
  const transcript = transcriptAdapter.transcribe(job);
  return {
    transcript,
    annotations: makeAnnotations(job, transcript)
  };
}

function escapePdfText(text) {
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '?');
}

function buildPdfBuffer(lines) {
  const contentLines = [];
  let y = 750;
  for (const line of lines) {
    contentLines.push(`BT /F1 12 Tf 72 ${y} Td (${escapePdfText(line)}) Tj ET`);
    y -= 18;
    if (y < 72) break;
  }
  const content = contentLines.join('\n');
  const objects = [];
  objects.push('<< /Type /Catalog /Pages 2 0 R >>');
  objects.push('<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  objects.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>');
  objects.push(`<< /Length ${Buffer.byteLength(content, 'utf8')} >>\nstream\n${content}\nendstream`);
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (let i = 0; i < objects.length; i += 1) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xrefStart = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i < offsets.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return Buffer.from(pdf, 'utf8');
}

async function processJob(jobId) {
  if (scheduled.has(jobId)) return;
  const timer = setTimeout(async () => {
    scheduled.delete(jobId);
    const job = jobs.get(jobId);
    if (!job || job.status !== 'queued') return;
    try {
      job.status = 'processing';
      job.progress = 35;
      job.updatedAt = nowIso();
      await saveState();

      const stageResult = copilotOrchestrator.runStage('parsing-and-transcription', job, extractJobStageResult);
      const matched = copilotOrchestrator.runStage('slide-matching', { job, transcript: stageResult.transcript }, ({ job: currentJob, transcript: currentTranscript }) => parseAndMatch(currentJob, currentTranscript));
      const transcript = stageResult.transcript;
      const annotations = matched.annotations;
      const summaryLines = [
        'AgentA+ Study Packet',
        `Job: ${job.id}`,
        `Priority order: ${buildPromptOrder(job).join(' > ') || 'lecture materials'}`,
        `Audio transcription: ${transcript.provider}`,
        `Slides: ${job.inputs.slides.length}`,
        `Audio files: ${job.inputs.audio.length}`,
        `Exam papers: ${job.inputs.examPapers.length}`,
        `Exam text length: ${job.inputs.examText ? job.inputs.examText.length : 0}`,
        `Review length: ${job.inputs.reviewText ? job.inputs.reviewText.length : 0}`,
        '',
        'Alignment placeholder:',
        ...annotations.map(a => `Slide ${a.slide} -> ${a.transcriptRef} (${a.emphasis})`),
        '',
        'Notes:',
        job.inputs.examPapers.length || job.inputs.examText
          ? 'Exam-paper signals were prioritized above review text.'
          : 'No exam paper provided; review signals remain lower priority.'
      ];
      const pdfBuffer = pdfRenderer.render(summaryLines);
      await storage.writeArtifact(jobId, 'study-packet.pdf', pdfBuffer);
      await storage.writeArtifact(jobId, 'result.json', Buffer.from(JSON.stringify({
        annotations,
        summary: {
          priorityOrder: buildPromptOrder(job),
          alignmentMode: 'placeholder',
          examPriorityApplied: Boolean(job.inputs.examPapers.length || job.inputs.examText)
        }
      }, null, 2)));

      job.status = 'completed';
      job.progress = 100;
      job.updatedAt = nowIso();
      job.result = {
        annotations,
        summary: {
          priorityOrder: buildPromptOrder(job),
          alignmentMode: 'placeholder',
          examPriorityApplied: Boolean(job.inputs.examPapers.length || job.inputs.examText)
        }
      };
      await storage.saveJob(jobId, job);
    } catch (error) {
      job.status = 'failed';
      job.progress = 100;
      job.error = error.message || 'Unknown failure';
      job.failedStage = classifyJobStage(job.error);
      job.retryGuidance = `Retry from ${job.failedStage} after correcting the input or transient error.`;
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

  const invalid = [...slideFiles, ...audioFiles, ...examFiles].find(file => file && !isSlideFile(file) && !isAudio(file) && !isTextFile(file));
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
      const buffer = file.data ? base64ToBuffer(file.data) : Buffer.from(String(file.text || ''), 'utf8');
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
  processJob(jobId);
  return sendJson(res, 201, { job: summarizeJob(job) });
}

async function handleDeleteJob(req, res, jobId) {
  if (!jobs.has(jobId)) {
    return sendJson(res, 404, { error: 'Job not found' });
  }
  await storage.deleteJob(jobId);
  return sendJson(res, 200, { ok: true });
}

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

async function serveStatic(req, res, urlPath) {
  let filePath = path.join(PUBLIC_DIR, urlPath === '/' ? 'index.html' : urlPath);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  async function handleJobDetail(req, res, jobId) {
    const job = jobs.get(jobId);
    if (!job) {
      return sendJson(res, 404, { error: 'Job not found' });
    }
    return sendJson(res, 200, summarizeJob(job));
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
      processJob(job.id);
    }
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    try {
      if (req.method === 'GET' && url.pathname === '/api/jobs') {
        return sendJson(res, 200, { jobs: [...jobs.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(summarizeJob) });
      }
      if (req.method === 'GET' && /^\/api\/jobs\/[^/]+$/.test(url.pathname)) {
        const jobId = url.pathname.split('/')[3];
        return await handleJobDetail(req, res, jobId);
      }
      if (req.method === 'POST' && url.pathname === '/api/jobs') {
        return await handleCreateJob(req, res);
      }
      if (req.method === 'DELETE' && /^\/api\/jobs\/[^/]+$/.test(url.pathname)) {
        const jobId = url.pathname.split('/')[3];
        return await handleDeleteJob(req, res, jobId);
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
    console.log(`AgentA+ scaffold running at http://localhost:${PORT}`);
  });
}

start().catch(error => {
  console.error(error);
  process.exit(1);
});
