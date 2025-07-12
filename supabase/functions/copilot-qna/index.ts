// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'

const openaiApiKey = Deno.env.get('OPENAI_API_KEY')!

interface QnARequest {
  question: string
  context?: {
    candidate?: any
    job?: any
    interaction?: any
  }
}

interface QnAResponse {
  success: boolean
  answer: string
  usage?: any
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { question, context } = await req.json()

    if (!question) {
      return new Response(
        JSON.stringify({ error: 'Missing question parameter' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log('Processing question:', question)

    // 构建上下文信息
    const contextInfo = buildContextInfo(context)

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a recruitment assistant AI specialized in helping HR professionals and recruiters. You have access to context information about candidates, jobs, and interactions. 

Your role is to:
1. Analyze candidate profiles and job requirements
2. Provide matching insights and recommendations
3. Help with interview questions and evaluation
4. Suggest next steps in the recruitment process
5. Answer questions about recruitment best practices

Always provide practical, actionable advice based on the context provided.

Context Information:
${contextInfo}`
          },
          {
            role: 'user',
            content: question
          }
        ],
        temperature: 0.7,
        max_tokens: 1000
      })
    })

    const result = await response.json()

    if (!response.ok) {
      console.error('OpenAI API error:', result.error)
      return new Response(
        JSON.stringify({ error: `OpenAI API error: ${result.error?.message}` }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const responseData = {
      success: true,
      answer: result.choices[0].message.content,
      usage: result.usage
    }

    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Copilot QnA error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

function buildContextInfo(context) {
  const parts = []

  if (context?.candidate) {
    parts.push(`Candidate Information:
    - Name: ${context.candidate.name}
    - Current Title: ${context.candidate.current_title}
    - Company: ${context.candidate.current_company}
    - Location: ${context.candidate.location}
    - Experience: ${context.candidate.years_of_experience} years
    - Skills: ${context.candidate.skills?.join(', ')}
    - Expected Salary: ${context.candidate.expected_salary_min} - ${
      context.candidate.expected_salary_max
    }`)
  }

  if (context?.job) {
    parts.push(`Job Information:
    - Title: ${context.job.title}
    - Company: ${context.job.company}
    - Location: ${context.job.location}
    - Employment Type: ${context.job.employment_type}
    - Salary Range: ${context.job.salary_min} - ${context.job.salary_max}
    - Required Skills: ${context.job.skills_required?.join(', ')}
    - Required Experience: ${context.job.experience_required} years
    - Description: ${context.job.description}`)
  }

  if (context?.interaction) {
    parts.push(`Recent Interaction:
    - Type: ${context.interaction.type}
    - Subject: ${context.interaction.subject}
    - Content: ${context.interaction.content}
    - Date: ${context.interaction.created_at}`)
  }

  return parts.join('\n\n')
}
 