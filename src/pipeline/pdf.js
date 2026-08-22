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

function runPackagingStage(job, annotations, summary) {
  const lines = [
    'AgentA+ Study Packet',
    `Job: ${job.id}`,
    `Priority order: ${summary.priorityOrder.join(' > ') || 'lecture materials'}`,
    `Audio transcription: ${summary.transcriptionProvider}`,
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

  return buildPdfBuffer(lines);
}

module.exports = {
  runPackagingStage
};
