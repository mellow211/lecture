import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { authenticateRequest } from '@/lib/auth';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

export async function POST(req: NextRequest) {
  try {
    // 1. Guard check: Presenter only (By-passed internally)
    const user = authenticateRequest(req);
    if (!user || user.role !== 'presenter') {
      return NextResponse.json(
        { error: 'Only presenters can access AI generation.' },
        { status: 403 }
      );
    }

    // 2. Parse request body
    const { topic } = await req.json();
    if (!topic) {
      return NextResponse.json(
        { error: 'Topic string is required.' },
        { status: 400 }
      );
    }

    // 3. Gemini Generation with Fallback
    let generatedSlides = [];

    if (GEMINI_API_KEY) {
      try {
        console.log(`Invoking Google Gemini AI for rich curriculum topic: "${topic}"`);
        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        // Use gemini-1.5-pro or gemini-1.5-flash for reliable structured JSON schemas
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        const systemInstruction = 
          "You are a professional curriculum designer. Build a highly comprehensive, detailed, and professional presentation slide sequence (between 5 and 8 slides) based on the user's topic.\n" +
          "Your output must be a valid JSON array, containing objects with the exact keys: 'title', 'subtitle', 'content', and 'gradient'.\n" +
          "Guidelines for slide content:\n" +
          "1. Provide rich, in-depth text content. Do NOT write simple summaries. The 'content' field MUST contain at least 4 to 8 detailed sentences, including exact code snippets (e.g. JavaScript, HTML, CSS formats) where applicable, specific design principles, or technical analysis.\n" +
          "2. Ensure the slides follow a structured learning journey: Introduction, Core Concepts, Code Examples/Case Studies, Best Practices, and Future/Advanced Summary.\n" +
          "Choose one of the following beautiful Tailwind gradient strings for each slide's 'gradient' property:\n" +
          "- 'from-blue-600 via-indigo-600 to-violet-600'\n" +
          "- 'from-purple-600 via-pink-600 to-rose-600'\n" +
          "- 'from-rose-600 via-orange-600 to-amber-600'\n" +
          "- 'from-teal-600 via-emerald-600 to-green-600'\n" +
          "- 'from-indigo-600 via-cyan-600 to-teal-600'\n" +
          "- 'from-slate-700 via-slate-800 to-slate-900'\n" +
          "Do not include markdown wrappers like ```json. Return ONLY the raw JSON array.";

        const prompt = `Topic: "${topic}"\nProvide the 5-8 slides presentation outline with extensive content matching the strict JSON format.`;

        const result = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: `${systemInstruction}\n\n${prompt}` }] }],
          generationConfig: {
            responseMimeType: 'application/json',
          }
        });

        const responseText = result.response.text();
        generatedSlides = JSON.parse(responseText);

      } catch (geminiError) {
        console.error('Gemini SDK call failed, falling back to mock generator:', geminiError);
        generatedSlides = generateMockSlides(topic);
      }
    } else {
      console.log('No GEMINI_API_KEY environment variable found. Using local mock slide generator.');
      generatedSlides = generateMockSlides(topic);
    }

    return NextResponse.json(generatedSlides);

  } catch (error: any) {
    console.error('AI Generate API error:', error);
    return NextResponse.json(
      { error: 'Internal server error.' },
      { status: 500 }
    );
  }
}

/**
 * Local Fallback Rich Slide Generator (5 Slides, detailed text & code)
 */
function generateMockSlides(topic: string) {
  return [
    {
      title: `1. ${topic}의 핵심 개요 및 도입`,
      subtitle: '배경과 기술의 필요성 고찰',
      content: `오늘날 소프트웨어 공학과 UX 디자인 생태계에서 '${topic}'은 매우 중요한 핵심 패러다임으로 자리 잡았습니다. 이 개념은 전통적인 개발 패러다임에서 발생하는 복잡성과 비효율성을 해소하고, 유지보수가 용이하며 재사용성이 높은 모듈을 신속하게 설계하기 위한 목적으로 태동하였습니다. 본 단원에서는 이 개념이 등장하게 된 역사적 배경과 구조적인 설계 흐름, 그리고 우리가 실무에서 직면할 수 있는 다양한 문제를 어떻게 돌파할 수 있는지에 대해 총체적으로 탐구합니다.`,
      gradient: 'from-blue-600 via-indigo-600 to-violet-600'
    },
    {
      title: `2. ${topic}를 지탱하는 핵심 개념과 규칙`,
      subtitle: '구조적 핵심 설계 아키텍처 이론',
      content: `'${topic}'을 올바르게 구사하기 위해 우리는 몇 가지 핵심 원칙을 숙지해야 합니다. 첫째, 하나의 모듈은 단 하나의 명확한 책임만을 담당하도록 단순하게 설계해야 합니다. 둘째, 내부 로직의 임의 변경 없이도 기능을 확장할 수 있는 유연성을 제공해야 합니다. 셋째, 결합도를 낮추고 모듈 간의 의존성을 캡슐화하여 독립적인 테스트 및 릴리즈가 가능하도록 구성해야 합니다. 이 이론적 개념들을 바탕으로 코드의 결합력과 응집력을 최적화하는 최적의 디자인 패턴에 대해 알아봅니다.`,
      gradient: 'from-indigo-600 via-cyan-600 to-teal-600'
    },
    {
      title: `3. ${topic}의 구체적인 구현 예제 코드`,
      subtitle: '실전 예시를 통한 고효율 코드 분석',
      content: `실제 실무에서 사용하는 예시 코드를 살펴보겠습니다.\n\n// Code Example Block\nfunction initializeLectureModule(config) {\n  const sessionName = config.name || "Default LUNA Session";\n  const maxSlots = config.slots ?? 30;\n  console.log(\`Initializing \${sessionName} with \${maxSlots} slots...\`);\n  return { active: true, timestamp: Date.now() };\n}\n\n위 자바스크립트 헬퍼 함수 예시처럼, 인풋 설정을 캡슐화하고 안전한 기본값을 할당하여 모듈의 오동작을 원천 방지하는 구조가 바로 실무 설계의 모범 사례입니다.`,
      gradient: 'from-purple-600 via-pink-600 to-rose-600'
    },
    {
      title: `4. 실무 도입 시 반드시 체크해야 할 팁`,
      subtitle: '함정 피하기 및 주의점 체크리스트',
      content: `'${topic}'을 기업형 프로덕션 환경에 실제로 통합할 때는 간과하기 쉬운 몇 가지 기술적 함정(Anti-Patterns)이 존재합니다. 초기 설계에 너무 많은 유연성을 부여하려다 보면 오히려 코드가 비대해지고 가독성이 떨어지는 '오버 엔지니어링(Over-Engineering)'에 빠지기 쉽습니다. 실전에서는 언제나 복잡도를 최소화하는 단순함을 최우선 가치로 두어야 하며, 모듈의 입출력 명세(API Contract)를 문서화하여 협업 효율성을 극대화해야 합니다.`,
      gradient: 'from-rose-600 via-orange-600 to-amber-600'
    },
    {
      title: `5. ${topic}의 기술 동향 및 종합 요약`,
      subtitle: '미래 발전 방향과 학습 요약정리',
      content: `이번 단원에서는 '${topic}'의 기본 사상부터 시작하여 실무 적용 원칙, 코드 예시 및 흔히 범하는 안티 패턴에 대해 종합적으로 학습해 보았습니다. 앞으로의 웹과 앱 플랫폼 기술은 모듈의 독립성과 경량화, 그리고 클라우드 네이티브 환경으로의 이식성을 점점 더 강력하게 요구할 것입니다. 오늘 배운 5장의 개념들을 실전에 점진적으로 도입하며 본인만의 실무 프레임워크를 단단히 다져나가시기 바랍니다.`,
      gradient: 'from-teal-600 via-emerald-600 to-green-600'
    }
  ];
}
