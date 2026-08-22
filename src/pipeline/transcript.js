function runTranscriptStage(job) {
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

module.exports = {
  runTranscriptStage
};
