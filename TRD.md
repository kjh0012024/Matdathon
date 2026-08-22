# TRD: 에이전트A+

## 1. Scope

에이전트A+는 시험기간이 급한 대학생을 위한 웹앱이다.  
사용자는 강의 슬라이드/PDF, 강의 녹음, 선택적 족보/강의평/시험 정보를 업로드한다.  
시스템은 이를 비동기 처리해 슬라이드별 주석이 포함된 학습 자료를 PDF로 생성한다.

## 2. Fixed decisions

- Platform: web app
- Device support: mobile and desktop equally
- Authentication: anonymous usage
- AI orchestration: Copilot SDK
- Deployment: Azure
- Processing mode: asynchronous
- Core output: PDF study packet
- Primary knowledge source priority: exam papers > lecture materials > transcript > reviews > external knowledge

## 3. Architecture overview

### 3.1 Azure components
- Azure App Service: web frontend and API
- Azure Blob Storage: uploaded files and generated PDFs
- Azure Functions: async job execution and pipeline steps
- Azure AI Search: retrieval layer for transcript, slides, and exam text
- Azure Cosmos DB: job state, metadata, user settings, output references

### 3.2 System boundaries
The app is responsible for:
- file ingestion
- document parsing
- transcript processing
- slide matching
- retrieval
- generation
- result packaging

The app is not responsible for:
- school LMS integration
- live lecture capture
- guaranteed exam prediction

## 4. User flow

1. User opens the web app without logging in.
2. User uploads lecture slides/PDF and lecture audio.
3. User optionally adds exam-paper files or pasted text.
4. User optionally adds course reviews or exam info.
5. The app validates inputs and creates a processing job.
6. Background workers process files asynchronously.
7. The app shows job progress and failure states.
8. The app returns a downloadable PDF study packet.

## 5. Input contract

### 5.1 Supported file types
- PDF
- PPTX
- images
- audio

### 5.2 Exam-paper input
- file upload
- text paste

### 5.3 Validation rules
- Reject unsupported file types
- Reject files that exceed configured size limits
- Reject missing required lecture materials
- Surface validation errors clearly to the user

## 6. Processing pipeline

### 6.1 Ingestion
Responsibilities:
- store original files in Blob Storage
- create job and file metadata in Cosmos DB
- queue background processing

### 6.2 Document parsing
Responsibilities:
- extract text from PDFs and PPTX files
- OCR image-based slide content when needed
- normalize text into page-level chunks

### 6.3 Audio transcription
Responsibilities:
- convert lecture audio to text
- preserve timestamps when available
- split transcript into semantic chunks

### 6.4 Slide-to-transcript alignment
Responsibilities:
- align transcript chunks to slide pages
- use timestamps when available
- use semantic similarity when timestamps are missing or noisy

### 6.5 Emphasis extraction
Responsibilities:
- detect repeated terms
- detect emphasis phrases and teacher cues
- rank likely exam-relevant segments

### 6.6 Retrieval augmentation
Responsibilities:
- index parsed content in Azure AI Search
- retrieve relevant slide, transcript, and exam-paper chunks
- optionally enrich with external knowledge only when course-specific evidence is insufficient

### 6.7 Generation
Responsibilities:
- generate annotated notes
- generate lecture summary
- generate exam-style observations
- format output into a PDF study packet

## 7. Copilot SDK responsibilities

Copilot SDK is used to orchestrate the following agent stages:
- parsing assistant
- matching assistant
- emphasis assistant
- retrieval assistant
- summarization assistant
- packaging assistant

Copilot SDK does not own:
- storage
- queueing
- persistence
- access control

## 8. Data model

### 8.1 Stored entities
- Job
- UploadedFile
- TranscriptChunk
- SlideChunk
- AlignmentResult
- EmphasisMarker
- RetrievalResult
- GeneratedPacket
- UserSetting

### 8.2 Minimum job state
- jobId
- status: queued | processing | completed | failed
- progressPercent
- createdAt
- updatedAt
- errorMessage

### 8.3 Retention
- Keep data until user deletes it
- Allow explicit deletion of files and generated outputs

## 9. Retrieval and ranking policy

### 9.1 Priority order
1. Uploaded exam papers / past tests
2. Uploaded lecture materials
3. Uploaded lecture audio transcript
4. Course reviews / exam info
5. External knowledge

### 9.2 Ranking rules
- Past exams outrank reviews for question style inference
- Lecture materials outrank external knowledge for content truth
- External knowledge may fill missing context but must not override course-specific evidence

## 10. Output specification

### Primary output
- downloadable PDF study packet

### PDF contents
- slide-by-slide notes
- emphasis markers
- lecture summary
- exam-style observations
- optional exam-paper-derived hints

### Persisted output
- PDF download reference
- summary text
- annotation data
- processing metadata

## 11. Error handling

### Required errors
- unsupported file type
- file too large
- OCR failure
- transcription failure
- slide matching failure
- retrieval failure
- PDF generation failure

### UX behavior
- show the failing stage
- show retry guidance
- preserve successful intermediate artifacts when possible

## 12. Non-functional requirements

- anonymous access
- minimal-cost Azure setup
- async UI responsiveness
- clear job progress
- explicit failure feedback
- basic privacy controls and deletion support

## 13. MVP definition

### Must have
- lecture slide upload
- lecture audio upload
- exam-paper upload or paste
- parsing and transcription
- slide-to-transcript alignment
- annotated PDF generation
- job progress UI

### Not in MVP
- personalized study planning
- advanced question prediction
- full external knowledge expansion
- school LMS integration

## 14. Open items

These are intentionally deferred:
- transcription provider selection
- OCR implementation detail
- exact prompt design per agent stage
- annotation schema format
- PDF layout system

## 15. One-line technical summary

**에이전트A+는 Azure에서 동작하는 Copilot SDK 기반 웹앱으로, 강의 슬라이드·녹음·족보를 비동기 처리해 주석 포함 PDF 학습 자료를 생성하는 시험 대비 시스템이다.**
