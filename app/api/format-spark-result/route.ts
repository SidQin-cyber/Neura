import { NextRequest, NextResponse } from 'next/server'
import { generateText } from 'ai'
import { openai } from '@ai-sdk/openai'

// 🎯 新的 Spark 结果优化 Prompt
const SPARK_OPTIMIZER_PROMPT = `你是一名高级招聘搜索策略师。你的任务是将结构化的候选人或职位数据，转换为两种为混合搜索（Hybrid Search）量身定制的优化文本。

**输入：** 一个包含解析后搜索条件的 JSON 对象。

**输出要求：** 直接返回一个包含两个字段的 JSON 对象，不要使用任何 markdown 代码块标记：
1. \`embeddingText\`: 一段流畅、语义丰富的自然语言描述。这段文本将用于生成高质量的向量嵌入（Embedding）。它应该完整地表达搜索意图，突出核心要求和吸引力。
2. \`ftsKeywords\`: 一个由 3-5 个最核心、最相关的关键词组成的字符串，用空格分隔。这些关键词将用于全文搜索（FTS），必须精炼、高命中率。

---
**核心原则：**

• **Embedding 文本：** 追求"意图完整"和"语义丰富"。将所有关键信息自然地串联成一句话。
• **FTS 关键词：** 追求"高信噪比"和"高区分度"。只选择最不可能被误解的核心词汇。避免使用宽泛的词（如"工程师"、"要求"）。

---
**示例：**

输入 (候选人搜索):
{
  "role": ["Go工程师"],
  "skills_must": ["Go", "Kubernetes"],
  "experience_min": 5,
  "location": ["北京"]
}

输出:
{
  "embeddingText": "寻找一名位于北京、具备5年以上工作经验、精通Go语言和Kubernetes技术的后端工程师。",
  "ftsKeywords": "Go工程师 Kubernetes 5年 北京"
}

---

输入 (职位搜索):
{
  "role": ["产品经理"],
  "skills_must": ["数据分析", "用户研究"],
  "industry": ["互联网"],
  "company": ["大型科技公司"]
}

输出:
{
  "embeddingText": "招聘来自大型科技公司、具备互联网行业背景、精通数据分析和用户研究的高级产品经理职位。",
  "ftsKeywords": "产品经理 数据分析 用户研究 科技公司"
}

请直接返回 JSON 对象，不要添加任何解释文字或代码块标记。`

export async function POST(request: NextRequest) {
  try {
    const { parsedData } = await request.json()

    if (!parsedData) {
      return NextResponse.json(
        { error: 'parsedData is required' },
        { status: 400 }
      )
    }

    console.log('🚀 Spark 优化流程启动，输入数据:', parsedData)

    // 调用 LLM 进行智能优化
    const { text } = await generateText({
      model: openai('gpt-4o-mini'),
      system: SPARK_OPTIMIZER_PROMPT,
      prompt: JSON.stringify(parsedData, null, 2),
      temperature: 0.2,
      maxTokens: 300
    })

    console.log('🤖 LLM 优化结果:', text)

    // 清理 LLM 返回的文本，移除可能的 markdown 标记
    const cleanedText = text
      .replace(/```json\s*/g, '')  // 移除开始的 ```json
      .replace(/```\s*$/g, '')     // 移除结尾的 ```
      .trim()

    console.log('🧹 清理后的文本:', cleanedText)

    // 解析 LLM 返回的 JSON
    let optimizedResult: { embeddingText: string; ftsKeywords: string }
    try {
      optimizedResult = JSON.parse(cleanedText)
    } catch (e) {
      console.error('❌ 解析 LLM 优化结果失败:', e)
      // 如果解析失败，提供一个基于规则的、更安全的后备方案
      const fallbackFts = parsedData.skills_must?.join(' ') || parsedData.role?.join(' ') || ''
      const fallbackEmbedding = parsedData.rewritten_query || JSON.stringify(parsedData)
      return NextResponse.json({
        success: false,
        error: 'Failed to parse optimizer response',
        embeddingText: fallbackEmbedding,
        ftsKeywords: fallbackFts,
        meta: {
          fallback_mode: true
        }
      })
    }

    console.log('✅ 优化成功:', {
      embeddingText: optimizedResult.embeddingText?.substring(0, 100) + '...',
      ftsKeywords: optimizedResult.ftsKeywords,
      optimization_model: 'gpt-4o-mini'
    })

    return NextResponse.json({
      success: true,
      embeddingText: optimizedResult.embeddingText,
      ftsKeywords: optimizedResult.ftsKeywords,
      meta: {
        optimization_model: 'gpt-4o-mini',
        embedding_length: optimizedResult.embeddingText?.length || 0,
        keyword_count: optimizedResult.ftsKeywords?.split(' ').length || 0
      }
    })

  } catch (error) {
    console.error('❌ Spark 格式化失败:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}