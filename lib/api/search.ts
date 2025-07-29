// Types will be defined inline since they may not exist in the types file yet

export interface SearchParams {
  query: string
  mode: 'candidates' | 'jobs'
  filters: {
    location?: string[]
    experience?: string
    salary?: string
    skills?: string[]
    education?: string[]
    // Spark 模式特殊标记
    _sparkMode?: boolean
    _ftsQuery?: string
    _embeddingQuery?: string
  }
  rerank?: boolean  // ✨ 新增 rerank 参数
}

export interface SearchResponse {
  success: boolean
  data?: any
  error?: string
}

export interface StreamingSearchResponse {
  success: boolean
  stream?: ReadableStream<Uint8Array>
  error?: string
}

export interface SearchStreamChunk {
  type: 'meta' | 'chunk' | 'complete' | 'error' | 'results'
  data?: any
  chunk_info?: {
    chunk_number: number
    total_chunks: number
    candidates_in_chunk: number
    is_final: boolean
  }
  total?: number
  processed?: number
  phase?: string
  reranked?: number
  total_processed?: number
  pipeline_summary?: {
    recall_count: number
    rerank_count: number
    top_score: number
    chunks_delivered: number
  }
  error?: string
  count?: number
}

// Enhanced streaming search function
export async function universalSearchStreaming(params: SearchParams): Promise<StreamingSearchResponse> {
  try {
    const { query, mode, filters, rerank } = params

    // Call the streaming search API
    const response = await fetch('/api/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        query,
        mode,
        filters,
        rerank
      })
    })

    if (!response.ok) {
      const errorData = await response.json()
      return { success: false, error: errorData.error || 'Search request failed' }
    }

    // Return the streaming response
    return { 
      success: true, 
      stream: response.body || undefined 
    }
  } catch (error) {
    console.error('搜索API错误:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : '搜索请求失败' 
    }
  }
}

// Legacy non-streaming search function (kept for backward compatibility)
export async function universalSearch(params: SearchParams): Promise<SearchResponse> {
  try {
    const { query, mode, filters, rerank } = params

    // 调用服务器端搜索API
    const response = await fetch('/api/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        query,
        mode,
        filters,
        rerank
      })
    })

    if (!response.ok) {
      const errorData = await response.json()
      return { success: false, error: errorData.error || 'Search request failed' }
    }

    const result = await response.json()
    return result
  } catch (error) {
    console.error('搜索API错误:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : '搜索请求失败' 
    }
  }
}

// Enhanced utility function to parse chunked streaming search responses
export async function parseSearchStream(
  stream: ReadableStream<Uint8Array>,
  onChunk: (chunk: SearchStreamChunk) => void,
  onComplete: (results: any[]) => void,
  onError: (error: string) => void
): Promise<void> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  const allResults: any[] = []
  let chunksReceived = 0

  try {
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      
      if (done) break

      // Decode the chunk and add to buffer
      buffer += decoder.decode(value, { stream: true })
      
      // Process complete lines
      const lines = buffer.split('\n')
      buffer = lines.pop() || '' // Keep the incomplete line in buffer

      for (const line of lines) {
        if (line.trim()) {
          try {
            const chunk: SearchStreamChunk = JSON.parse(line)
            
            // Handle different chunk types
            switch (chunk.type) {
              case 'meta':
                console.log('📊 Meta info:', chunk.phase, chunk.total, chunk.reranked)
                onChunk(chunk)
                break
              
              case 'results':
                // Handle direct search results from our backend
                if (chunk.data && Array.isArray(chunk.data)) {
                  console.log('🎯 Direct results received:', chunk.data.length, 'candidates')
                  allResults.push(...chunk.data)
                  onChunk(chunk)
                  
                  // Immediately call onComplete for direct results
                  console.log('✅ Calling onComplete with', allResults.length, 'results')
                  onComplete(allResults)
                  return
                } else {
                  // Handle empty results
                  console.log('📭 Empty results received')
                  onComplete([])
                  return
                }
              
              case 'chunk':
                if (chunk.data && Array.isArray(chunk.data)) {
                  // Add candidates from this chunk to the total results
                  allResults.push(...chunk.data)
                  chunksReceived++
                  
                  console.log(`📦 Chunk ${chunk.chunk_info?.chunk_number || chunksReceived} received:`, {
                    candidates: chunk.data.length,
                    total_so_far: allResults.length,
                    is_final: chunk.chunk_info?.is_final
                  })
                  
                  // Call onChunk for UI updates
                  onChunk(chunk)
                  
                  // If this is the final chunk, we can call onComplete immediately
                  // Otherwise, we'll wait for the 'complete' signal
                  if (chunk.chunk_info?.is_final) {
                    console.log('🎉 Final chunk received, calling onComplete with', allResults.length, 'total candidates')
                    onComplete(allResults)
                    return
                  }
                }
                break
              
              case 'complete':
                console.log('✅ Stream completion signal received')
                console.log('📊 Pipeline summary:', chunk.pipeline_summary)
                onChunk(chunk)
                
                // Call onComplete with all accumulated results
                // (this may be redundant if we already called it on final chunk)
                if (allResults.length > 0) {
                  onComplete(allResults)
                } else {
                  // Handle case where no candidates were found
                  onComplete([])
                }
                return
              
              case 'error':
                console.error('❌ Stream error:', chunk.error)
                onError(chunk.error || 'Unknown streaming error')
                return
              
              default:
                console.warn('Unknown chunk type:', chunk.type)
            }
          } catch (parseError) {
            console.error('Failed to parse streaming chunk:', parseError, 'Raw line:', line)
          }
        }
      }
    }

    // If we reach here without a complete signal, still call onComplete
    if (allResults.length > 0) {
      console.log('🎯 Stream ended without complete signal, calling onComplete with', allResults.length, 'candidates')
      onComplete(allResults)
    }

  } catch (error) {
    console.error('Error reading search stream:', error)
    onError(error instanceof Error ? error.message : 'Stream reading failed')
  } finally {
    reader.releaseLock()
  }
} 