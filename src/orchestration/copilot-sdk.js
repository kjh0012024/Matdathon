const { runTranscriptStage } = require('../pipeline/transcript');
const { runSlideMatchStage } = require('../pipeline/slide-match');
const { runPackagingStage } = require('../pipeline/pdf');

function createCopilotSdkRunner({ logger, store }) {
  const stages = {
    'parsing-and-transcription': async (job) => {
      logger?.info?.(`stage start: ${job.id}:parsing-and-transcription`);
      const transcript = await runTranscriptStage(job);
      logger?.info?.(`stage end: ${job.id}:parsing-and-transcription`);
      return transcript;
    },
    'slide-matching': async ({ job, transcript, slides }) => {
      logger?.info?.(`stage start: ${job.id}:slide-matching`);
      const result = await runSlideMatchStage(job, transcript, slides);
      logger?.info?.(`stage end: ${job.id}:slide-matching`);
      return result;
    },
    packaging: async ({ job, annotations, summary }) => {
      logger?.info?.(`stage start: ${job.id}:packaging`);
      const pdf = await runPackagingStage(job, annotations, summary);
      logger?.info?.(`stage end: ${job.id}:packaging`);
      return pdf;
    }
  };

  return {
    async runStage(name, input) {
      const stage = stages[name];
      if (!stage) throw new Error(`Unknown stage: ${name}`);
      return stage(input);
    },

    async runPipeline(job) {
      const transcript = await this.runStage('parsing-and-transcription', job);
      const slides = store?.getSlides ? await store.getSlides(job.id) : job.inputs.slides;
      const matched = await this.runStage('slide-matching', { job, transcript, slides });
      return {
        transcript,
        annotations: matched.annotations
      };
    },

    async package(job, annotations, summary) {
      return this.runStage('packaging', { job, annotations, summary });
    }
  };
}

module.exports = {
  createCopilotSdkRunner
};
