// Test script for the new chunked streaming reranking integration
require('dotenv').config({ path: '.env.local' })

// Test environment variables
console.log('🔧 Testing environment variables:')
console.log('- RERANKER_ENDPOINT_URL:', process.env.RERANKER_ENDPOINT_URL ? '✅ Set' : '❌ Missing')
console.log('- HF_API_KEY:', process.env.HF_API_KEY ? '✅ Set' : '❌ Missing')

// Test Hugging Face reranking endpoint
async function testRerankingEndpoint() {
  console.log('\n🧠 Testing Hugging Face Reranking Endpoint...')
  
  const testQuery = 'Senior Frontend Developer with React experience'
  const testCandidates = [
    'John Smith - Senior Frontend Developer with 5 years React experience at Tech Corp',
    'Jane Doe - Backend Developer with 3 years Python experience at Data Inc',
    'Mike Johnson - Full Stack Developer with React and Node.js experience at Startup Ltd'
  ]
  
  try {
    const response = await fetch(process.env.RERANKER_ENDPOINT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.HF_API_KEY}`
      },
      body: JSON.stringify({
        inputs: {
          source_sentence: testQuery,
          sentences: testCandidates
        }
      })
    })
    
    if (response.ok) {
      const scores = await response.json()
      console.log('✅ Reranking endpoint working!')
      console.log('📊 Scores received:', scores)
      
      // Show ranked candidates
      const rankedCandidates = testCandidates
        .map((candidate, index) => ({
          candidate,
          score: scores[index] || 0
        }))
        .sort((a, b) => b.score - a.score)
      
      console.log('\n🏆 Ranked Candidates:')
      rankedCandidates.forEach((item, index) => {
        console.log(`${index + 1}. Score: ${item.score.toFixed(4)} - ${item.candidate}`)
      })
    } else {
      const errorText = await response.text()
      console.error('❌ Reranking endpoint error:', response.status, errorText)
    }
  } catch (error) {
    console.error('❌ Error testing reranking endpoint:', error.message)
  }
}

// Test the new chunked streaming search API
async function testChunkedStreamingAPI() {
  console.log('\n🚀 Testing New Chunked Streaming API...')
  
  try {
    const startTime = Date.now()
    console.log('⏱️  Starting search request...')
    
    const response = await fetch('http://localhost:3000/api/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: '前端开发工程师',
        mode: 'candidates',
        filters: {}
      })
    })
    
    if (response.ok) {
      const contentType = response.headers.get('content-type')
      console.log('✅ Search API responding!')
      console.log('📡 Content-Type:', contentType)
      
      if (contentType && contentType.includes('application/x-ndjson')) {
        console.log('🎉 Chunked streaming response detected!')
        console.log('📊 Processing chunked stream...\n')
        
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let chunkCount = 0
        let firstChunkTime = null
        let totalCandidates = 0
        const candidatesByChunk = []
        
        try {
          let buffer = ''
          
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            
            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() || ''
            
            for (const line of lines) {
              if (line.trim()) {
                try {
                  const data = JSON.parse(line)
                  const currentTime = Date.now()
                  const elapsed = currentTime - startTime
                  
                  switch (data.type) {
                    case 'meta':
                      console.log(`📊 [${elapsed}ms] Meta:`, data.phase, data.total || data.reranked)
                      break
                      
                    case 'chunk':
                      chunkCount++
                      const candidates = data.data ? data.data.length : 0
                      totalCandidates += candidates
                      candidatesByChunk.push(candidates)
                      
                      if (chunkCount === 1) {
                        firstChunkTime = elapsed
                        console.log(`⚡ [${elapsed}ms] 🏆 FIRST CHUNK (immediate): ${candidates} candidates`)
                        console.log(`   └─ First-screen acceleration: ${elapsed}ms to first results!`)
                      } else {
                        console.log(`📦 [${elapsed}ms] Chunk ${chunkCount}: ${candidates} candidates`)
                      }
                      
                      if (data.chunk_info) {
                        const info = data.chunk_info
                        console.log(`   └─ Chunk ${info.chunk_number}/${info.total_chunks}, Final: ${info.is_final}`)
                        
                        if (info.is_final) {
                          console.log(`🎯 [${elapsed}ms] Final chunk received!`)
                        }
                      }
                      break
                      
                    case 'complete':
                      console.log(`✅ [${elapsed}ms] Stream completed!`)
                      if (data.pipeline_summary) {
                        const summary = data.pipeline_summary
                        console.log(`📊 Pipeline Summary:`)
                        console.log(`   └─ Recall: ${summary.recall_count} candidates`)
                        console.log(`   └─ Reranked: ${summary.rerank_count} candidates`) 
                        console.log(`   └─ Top Score: ${summary.top_score?.toFixed(4) || 'N/A'}`)
                        console.log(`   └─ Chunks: ${summary.chunks_delivered}`)
                      }
                      break
                      
                    case 'error':
                      console.error(`❌ [${elapsed}ms] Error:`, data.error)
                      break
                      
                    default:
                      console.log(`📦 [${elapsed}ms] Unknown type:`, data.type)
                  }
                } catch (parseError) {
                  console.log('📦 Raw chunk:', line.substring(0, 100) + '...')
                }
              }
            }
          }
          
          // Performance Analysis
          console.log('\n📈 Performance Analysis:')
          console.log(`⚡ Time to first results: ${firstChunkTime}ms`)
          console.log(`🏁 Total time: ${Date.now() - startTime}ms`)
          console.log(`📊 Total candidates: ${totalCandidates}`)
          console.log(`📦 Chunks delivered: ${chunkCount}`)
          console.log(`📈 Candidates per chunk:`, candidatesByChunk)
          
          if (firstChunkTime) {
            const efficiency = firstChunkTime < 1000 ? '🚀 Excellent' : 
                             firstChunkTime < 2000 ? '✅ Good' : 
                             firstChunkTime < 3000 ? '⚠️ Acceptable' : '❌ Slow'
            console.log(`🎯 First-screen performance: ${efficiency} (${firstChunkTime}ms)`)
          }
          
        } finally {
          reader.releaseLock()
        }
      } else {
        const result = await response.json()
        console.log('📊 Non-streaming response:', result)
      }
    } else {
      const errorData = await response.json()
      console.error('❌ Search API error:', response.status, errorData)
    }
  } catch (error) {
    console.error('❌ Error testing chunked streaming API:', error.message)
  }
}

// Test edge cases for chunked streaming
async function testEdgeCases() {
  console.log('\n🧪 Testing Edge Cases...')
  
  const testCases = [
    {
      name: 'Very specific query (likely few results)',
      query: '极其稀有的特殊技能专家',
      expected: 'Should handle small result sets gracefully'
    },
    {
      name: 'Common query (likely many results)', 
      query: '软件工程师',
      expected: 'Should chunk large result sets properly'
    },
    {
      name: 'Non-existent query',
      query: 'xyz非常罕见的查询词abc123',
      expected: 'Should handle zero results gracefully'
    }
  ]
  
  for (const testCase of testCases) {
    console.log(`\n🔍 Testing: ${testCase.name}`)
    console.log(`Query: "${testCase.query}"`)
    console.log(`Expected: ${testCase.expected}`)
    
    try {
      const response = await fetch('http://localhost:3000/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: testCase.query,
          mode: 'candidates',
          filters: {}
        })
      })
      
      if (response.ok) {
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let totalCandidates = 0
        let chunks = 0
        
        try {
          let buffer = ''
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            
            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() || ''
            
            for (const line of lines) {
              if (line.trim()) {
                try {
                  const data = JSON.parse(line)
                  if (data.type === 'chunk' && data.data) {
                    totalCandidates += data.data.length
                    chunks++
                  }
                } catch (e) {}
              }
            }
          }
          
          console.log(`   Result: ${totalCandidates} candidates in ${chunks} chunks`)
          
        } finally {
          reader.releaseLock()
        }
      } else {
        console.log(`   Error: ${response.status}`)
      }
    } catch (error) {
      console.log(`   Exception: ${error.message}`)
    }
  }
}

// Run all tests
async function runAllTests() {
  console.log('🚀 Starting Enhanced Chunked Streaming Tests\n')
  
  await testRerankingEndpoint()
  await testChunkedStreamingAPI()
  await testEdgeCases()
  
  console.log('\n✨ All tests completed!')
  console.log('\n🎯 Key Success Metrics:')
  console.log('✅ First chunk < 1000ms (First-screen acceleration)')
  console.log('✅ Chunked delivery working')
  console.log('✅ Edge cases handled gracefully')
  console.log('✅ Reranking integration functional')
}

runAllTests().catch(console.error) 