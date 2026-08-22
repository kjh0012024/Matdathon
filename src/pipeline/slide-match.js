function runSlideMatchStage(job, transcript, slides) {
  const chunks = transcript.chunks.length ? transcript.chunks : [{ id: 1, start: 0, end: 60, text: 'No audio transcript available' }];
  const annotations = slides.map((slide, index) => {
    const chunk = chunks[Math.min(index, chunks.length - 1)];
    return {
      slide: slide.page,
      transcriptRef: `Transcript chunk ${chunk.id} (${chunk.start}-${chunk.end}s)`,
      emphasis: index === 0 ? 'Priority topic from lecture + exam signals' : 'Aligned by temporal chunk order',
      slideTitle: slide.title,
      transcriptText: chunk.text
    };
  });

  return { annotations };
}

module.exports = {
  runSlideMatchStage
};
