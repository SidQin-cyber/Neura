// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'

const openaiApiKey = Deno.env.get('OPENAI_API_KEY')!

interface EmbeddingRequest {
  text: string
  input_type?: 'search_query' | 'search_document'
}

interface EmbeddingResponse {
  success: boolean
  embedding: number[]
  usage?: any
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { text, input_type = 'search_document' }: EmbeddingRequest = await req.json()

    if (!text) {
      return new Response(JSON.stringify({ error: 'Missing text parameter' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log('Generating embedding for text:', text.substring(0, 100))

    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text,
        encoding_format: 'float'
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

    const responseData: EmbeddingResponse = {
      success: true,
      embedding: result.data[0].embedding,
      usage: result.usage
    }

    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Get embedding error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
 