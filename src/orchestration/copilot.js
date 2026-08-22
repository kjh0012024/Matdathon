function createCopilotStageRunner({ transcriptStage, matchStage, packageStage }) {
  return {
    runStage(name, input) {
      if (name === 'parsing-and-transcription') {
        return transcriptStage(input);
      }
      if (name === 'slide-matching') {
        return matchStage(input.job, input.transcript, input.slides);
      }
      if (name === 'packaging') {
        return packageStage(input.job, input.annotations, input.summary);
      }
      throw new Error(`Unknown stage: ${name}`);
    },
    runPipeline(job, slides) {
      const transcript = this.runStage('parsing-and-transcription', job);
      const matched = this.runStage('slide-matching', { job, transcript, slides });
      return {
        transcript,
        annotations: matched.annotations
      };
    }
  };
}

module.exports = {
  createCopilotStageRunner
};
