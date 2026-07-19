import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { authenticateRequest } from '@/lib/auth';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

export async function POST(req: NextRequest) {
  try {
    // 1. Guard check: Presenter only
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
        console.log(`Invoking Google Gemini AI for topic: "${topic}"`);
        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        const systemInstruction = 
          "You are a professional curriculum designer. Build a concise, highly-engaging presentation slide sequence (exactly 3 slides) based on the user's topic.\n" +
          "Your output must be a valid JSON array, containing objects with the exact keys: 'title', 'subtitle', 'content', and 'gradient'.\n" +
          "Pick one of the following beautiful Tailwind gradient strings for each slide's 'gradient' property:\n" +
          "- 'from-blue-600 via-indigo-600 to-violet-600'\n" +
          "- 'from-purple-600 via-pink-600 to-rose-600'\n" +
          "- 'from-rose-600 via-orange-600 to-amber-600'\n" +
          "- 'from-teal-600 via-emerald-600 to-green-600'\n" +
          "Do not include markdown wrappers like ```json or trailing text. Return only the raw JSON array.";

        const prompt = `Topic: "${topic}"\nProvide the 3-slide presentation outline matching the strict JSON format.`;

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
 * Local Fallback Slide Outliner Generator
 */
function generateMockSlides(topic: string) {
  return [
    {
      title: `1장. ${topic}의 이해와 기초`,
      subtitle: '기본 개념 학습 및 입문하기',
      content: `이 슬라이드는 '${topic}'의 근간을 이루는 기초 이론과 역사적 배경에 대해 설명합니다. 입문자 수준에서 이해해야 할 핵심 용어 정의 및 앞으로 배울 커리큘럼의 지향점을 소개합니다.`,
      gradient: 'from-blue-600 via-indigo-600 to-violet-600'
    },
    {
      title: `2장. ${topic} 실무 핵심 사례`,
      subtitle: '현장 실전 팁과 노하우 적용하기',
      content: `이 슬라이드는 '${topic}'을 실무 프로젝트나 연구에 적용할 때 벌어지는 구체적인 성공/실패 사례들을 고찰합니다. 데이터 분석 및 설계 과정에서 주의해야 할 체크리스트를 전달합니다.`,
      gradient: 'from-purple-600 via-pink-600 to-rose-600'
    },
    {
      title: `3장. ${topic}의 미래 전망과 요약`,
      subtitle: '새로운 기술 동향 및 종합 정리',
      content: `마지막 슬라이드는 '${topic}'의 최신 트렌드와 미래 발전 과제에 대해 내다봅니다. 오늘 배운 세 장의 핵심 키워드를 리마인드하고 질의응답 및 추가 학습 방향을 설정하며 프레젠테이션을 맺습니다.`,
      gradient: 'from-rose-600 via-orange-600 to-amber-600'
    }
  ];
}
