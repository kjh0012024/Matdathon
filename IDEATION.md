# IDEATION

## English version

## Project idea
Build a **personalized exam-prep agent for university students**.

The user uploads:
- lecture recordings
- lecture slides or PDFs
- optional course/community exam info
- optional exam past papers or "previous tests" if available

The agent then:
- maps spoken explanations to specific slide pages
- highlights what the professor emphasized
- infers exam style from course reviews and exam hints
- generates annotated notes, a full lecture summary, and predicted exam questions
- estimates study time per subject based on user level and learning style
- builds a study plan that fits the exam schedule

## Core problem
Students usually know:
- they have exams coming up
- they have slides and notes
- they have some lecture recordings

But they do **not** know:
- what matters most
- how the professor tests
- how much time each subject actually needs
- how to organize study days before the exam

This app turns raw class material into an actionable exam strategy.

## User value
1. Reduce time spent manually reviewing lectures.
2. Focus on what the professor is likely to ask.
3. Turn weak notes into annotated study material.
4. Create a realistic study plan before it is too late.

## Main features
### 1. Lecture-to-slide alignment
Analyze the audio transcript and match each explanation to slide pages or document sections.

### 2. Emphasis detection
Detect repeated terms, stressed phrases, and explicit cues like:
- "important"
- "this will be on the exam"
- "remember this part"

### 3. Exam style inference
Use course reviews and exam info to estimate:
- Korean vs. English questions
- multiple choice vs. essay
- calculation-heavy vs. theory-heavy
- memorization vs. application

If past exam papers are uploaded, use them as a higher-priority signal than reviews for detecting question patterns, wording style, and topic frequency.

### 4. Annotated study materials
Generate a version of the slides with:
- page-level annotations
- key takeaways
- likely exam focus
- missing explanations from the lecture

### 5. Summary and predicted questions
Provide:
- full lecture summary
- chapter-by-chapter review
- expected exam questions

### 6. Personalized study planner
Estimate study time by subject using:
- current familiarity level
- learning style
- course difficulty
- exam date

Then create a day-by-day plan.

## Suggested MVP
Keep the first version focused:
- upload slides
- upload lecture audio
- generate transcript alignment
- highlight important sections
- create summary and study plan

Optional later phase:
- course review/exam style scraping
- question prediction
- adaptive study time estimation

## Demo story
1. Student uploads a 40-minute lecture recording and slides.
2. The app shows which slide pages were discussed.
3. It highlights professor-emphasized parts.
4. It summarizes the lecture into study notes.
5. It produces a 7-day exam plan.

## One-line pitch
**An AI exam-prep agent that turns lecture recordings and slides into personalized study notes, predicted exam patterns, and a realistic study schedule.**

---

## 한국어 버전

## 프로젝트 아이디어
**대학생 시험기간용 개인 맞춤형 시험 대비 에이전트**를 만든다.

사용자는 다음을 업로드한다:
- 강의 녹음
- 강의 슬라이드 또는 PDF
- 선택적으로 에브리타임 같은 강의평/시험정보
- 선택적으로 시험 족보나 기출문제

에이전트는 다음을 수행한다:
- 교수님의 설명을 어떤 슬라이드 페이지와 연결되는지 분석
- 교수님이 강조한 부분을 표시
- 강의평과 시험정보를 바탕으로 시험 스타일 추론
- 필기 보강본, 강의 전체 요약, 예상 시험문제 생성
- 사용자의 수준과 학습 스타일을 바탕으로 과목별 공부 시간 추정
- 시험 일정에 맞는 공부 계획 자동 생성

## 핵심 문제
학생들은 보통 다음은 알고 있다:
- 시험이 다가오고 있다
- 슬라이드와 필기가 있다
- 강의 녹음이 있다

하지만 다음은 잘 모른다:
- 무엇이 가장 중요한지
- 교수님이 어떤 방식으로 시험을 내는지
- 과목마다 실제로 얼마나 공부해야 하는지
- 시험 전 며칠을 어떻게 나눠 써야 하는지

이 앱은 흩어진 강의 자료를 **실행 가능한 시험 전략**으로 바꾼다.

## 사용자 가치
1. 강의를 수동으로 다시 보는 시간을 줄인다.
2. 교수님이 낼 가능성이 높은 부분에 집중한다.
3. 부족한 필기를 시험 대비용 자료로 바꾼다.
4. 늦기 전에 현실적인 공부 계획을 만든다.

## 주요 기능
### 1. 강의와 슬라이드 연결
오디오 전사 내용을 분석해 각 설명이 어떤 슬라이드 페이지나 문서 구간과 연결되는지 찾는다.

### 2. 강조 포인트 탐지
반복되는 용어, 강하게 말한 표현, 그리고 다음 같은 직접 신호를 찾는다:
- "중요합니다"
- "시험에 나옵니다"
- "이 부분 기억하세요"

### 3. 시험 스타일 추론
강의평과 시험 정보를 활용해 다음을 추정한다:
- 한국어 문제인지 영어 문제인지
- 객관식인지 서술형인지
- 계산문제가 많은지 이론 위주인지
- 암기형인지 응용형인지

시험 족보나 기출문제가 업로드되면, 강의평보다 더 높은 우선순위의 신호로 사용해 문제 경향, 문항 표현 방식, 출제 빈도를 분석한다.

### 4. 주석이 추가된 학습 자료
슬라이드에 다음을 추가한 버전을 만든다:
- 페이지별 주석
- 핵심 요약
- 시험 가능성이 높은 부분
- 강의에서 부족했던 설명 보완

### 5. 요약과 예상문제
다음 자료를 제공한다:
- 강의 전체 요약
- 챕터별 복습 정리
- 예상 시험문제

### 6. 개인 맞춤 공부 플래너
다음을 바탕으로 과목별 공부 시간을 추정한다:
- 현재 이해도
- 학습 스타일
- 과목 난이도
- 시험 날짜

그 후 하루 단위 공부 계획을 만든다.

## 추천 MVP
첫 버전은 단순하게 시작한다:
- 슬라이드 업로드
- 강의 녹음 업로드
- 전사 내용과 슬라이드 연결
- 중요한 부분 표시
- 요약과 공부 계획 생성

나중에 추가할 기능:
- 강의평/시험 스타일 수집
- 예상문제 고도화
- 학습 시간 자동 조정

## 데모 시나리오
1. 학생이 40분짜리 강의 녹음과 슬라이드를 업로드한다.
2. 앱이 어떤 슬라이드가 설명되었는지 보여준다.
3. 교수님이 강조한 부분을 표시한다.
4. 강의 내용을 공부노트로 요약한다.
5. 7일짜리 시험 대비 계획을 만든다.

## 한 줄 소개
**강의 녹음과 슬라이드를 개인 맞춤형 시험 노트, 예상 출제 패턴, 현실적인 공부 일정으로 바꿔주는 AI 시험 대비 에이전트**
