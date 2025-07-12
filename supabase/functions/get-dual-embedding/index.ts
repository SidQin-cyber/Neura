// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
}

interface DualEmbeddingRequest {
  text: string
  input_type?: 'search_query' | 'search_document'
}

interface DualEmbeddingResponse {
  embedding_small: number[]
  embedding_large: number[]
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    const {
      data: { user }
    } = await supabase.auth.getUser(
      req.headers.get('Authorization')?.replace('Bearer ', '') ?? ''
    )

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { text, input_type = 'search_document' } = await req.json()

    if (!text || text.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'Text is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // 并行请求两个模型的embeddings
    const [smallEmbeddingResponse, largeEmbeddingResponse] = await Promise.all([
      // text-embedding-3-small (1536 dimensions)
      fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          input: text,
          model: 'text-embedding-3-small',
          encoding_format: 'float'
        })
      }),
      // text-embedding-3-large (3072 dimensions)
      fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          input: text,
          model: 'text-embedding-3-large',
          encoding_format: 'float'
        })
      })
    ])

    if (!smallEmbeddingResponse.ok || !largeEmbeddingResponse.ok) {
      const smallError = smallEmbeddingResponse.ok
        ? null
        : await smallEmbeddingResponse.text()
      const largeError = largeEmbeddingResponse.ok
        ? null
        : await largeEmbeddingResponse.text()

      return new Response(
        JSON.stringify({
          error: 'Failed to get embeddings',
          small_error: smallError,
          large_error: largeError
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const smallData = await smallEmbeddingResponse.json()
    const largeData = await largeEmbeddingResponse.json()

    const response = {
      embedding_small: smallData.data[0].embedding,
      embedding_large: largeData.data[0].embedding
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Error in get-dual-embedding:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
 