import { createClient } from '@/lib/supabase/client'

export interface DualSearchFilters {
  location?: string
  experienceMin?: number
  experienceMax?: number
  salaryMin?: number
  salaryMax?: number
  skills?: string[]
  employmentType?: string
  experienceRequired?: number
}

export interface DualSearchOptions {
  similarityThresholdSmall?: number
  similarityThresholdLarge?: number
  firstStageCount?: number
  finalCount?: number
  enableDualStage?: boolean
}

export interface DualSearchResult {
  id: string
  name?: string
  title?: string
  company?: string
  location?: string
  similarity_small: number
  similarity_large?: number
  final_score?: number
  created_at: string
  updated_at: string
  [key: string]: any
}

export interface DualEmbeddingResponse {
  embedding_small: number[]
  embedding_large: number[]
}

export class DualSearchTool {
  private supabase = createClient()

  /**
   * 获取双模型embeddings
   */
  async getDualEmbeddings(text: string): Promise<DualEmbeddingResponse> {
    const { data, error } = await this.supabase.functions.invoke(
      'get-dual-embedding',
      {
        body: { text, input_type: 'search_query' }
      }
    )

    if (error) {
      throw new Error(`Failed to get embeddings: ${error.message}`)
    }

    return data
  }

  /**
   * 双阶段候选人搜索
   */
  async searchCandidatesDualStage(
    query: string,
    filters: DualSearchFilters = {},
    options: DualSearchOptions = {}
  ): Promise<DualSearchResult[]> {
    const {
      similarityThresholdSmall = 0.6,
      similarityThresholdLarge = 0.7,
      firstStageCount = 20,
      finalCount = 10,
      enableDualStage = true
    } = options

    try {
      // 获取查询的双模型embeddings
      const embeddings = await this.getDualEmbeddings(query)

      if (!enableDualStage) {
        // 如果禁用双阶段，只使用small模型
        return this.searchCandidatesSingleStage(
          embeddings.embedding_small,
          filters,
          {
            similarityThreshold: similarityThresholdSmall,
            matchCount: finalCount
          }
        )
      }

      // 执行双阶段搜索
      const { data, error } = await this.supabase.rpc(
        'search_candidates_dual_stage_rpc',
        {
          query_embedding_small: embeddings.embedding_small,
          query_embedding_large: embeddings.embedding_large,
          similarity_threshold_small: similarityThresholdSmall,
          similarity_threshold_large: similarityThresholdLarge,
          first_stage_count: firstStageCount,
          final_count: finalCount,
          location_filter: filters.location,
          experience_min: filters.experienceMin,
          experience_max: filters.experienceMax,
          salary_min: filters.salaryMin,
          salary_max: filters.salaryMax,
          skills_filter: filters.skills,
          status_filter: 'active'
        }
      )

      if (error) {
        throw new Error(`Search error: ${error.message}`)
      }

      return data || []
    } catch (error) {
      console.error('Dual stage candidate search error:', error)
      throw error
    }
  }

  /**
   * 双阶段职位搜索
   */
  async searchJobsDualStage(
    query: string,
    filters: DualSearchFilters = {},
    options: DualSearchOptions = {}
  ): Promise<DualSearchResult[]> {
    const {
      similarityThresholdSmall = 0.6,
      similarityThresholdLarge = 0.7,
      firstStageCount = 20,
      finalCount = 10,
      enableDualStage = true
    } = options

    try {
      // 获取查询的双模型embeddings
      const embeddings = await this.getDualEmbeddings(query)

      if (!enableDualStage) {
        // 如果禁用双阶段，只使用small模型
        return this.searchJobsSingleStage(embeddings.embedding_small, filters, {
          similarityThreshold: similarityThresholdSmall,
          matchCount: finalCount
        })
      }

      // 执行双阶段搜索
      const { data, error } = await this.supabase.rpc(
        'search_jobs_dual_stage_rpc',
        {
          query_embedding_small: embeddings.embedding_small,
          query_embedding_large: embeddings.embedding_large,
          similarity_threshold_small: similarityThresholdSmall,
          similarity_threshold_large: similarityThresholdLarge,
          first_stage_count: firstStageCount,
          final_count: finalCount,
          location_filter: filters.location,
          employment_type_filter: filters.employmentType,
          salary_min_filter: filters.salaryMin,
          salary_max_filter: filters.salaryMax,
          skills_filter: filters.skills,
          experience_required_filter: filters.experienceRequired,
          status_filter: 'active'
        }
      )

      if (error) {
        throw new Error(`Search error: ${error.message}`)
      }

      return data || []
    } catch (error) {
      console.error('Dual stage job search error:', error)
      throw error
    }
  }

  /**
   * 单阶段候选人搜索（后备方案）
   */
  private async searchCandidatesSingleStage(
    queryEmbedding: number[],
    filters: DualSearchFilters,
    options: { similarityThreshold: number; matchCount: number }
  ): Promise<DualSearchResult[]> {
    const { data, error } = await this.supabase.rpc('search_candidates_rpc', {
      query_embedding: queryEmbedding,
      similarity_threshold: options.similarityThreshold,
      match_count: options.matchCount,
      location_filter: filters.location,
      experience_min: filters.experienceMin,
      experience_max: filters.experienceMax,
      salary_min: filters.salaryMin,
      salary_max: filters.salaryMax,
      skills_filter: filters.skills,
      status_filter: 'active'
    })

    if (error) {
      throw new Error(`Single stage search error: ${error.message}`)
    }

    // 转换为双模型格式
    return (data || []).map((item: any) => ({
      ...item,
      similarity_small: item.similarity,
      similarity_large: null,
      final_score: item.similarity
    }))
  }

  /**
   * 单阶段职位搜索（后备方案）
   */
  private async searchJobsSingleStage(
    queryEmbedding: number[],
    filters: DualSearchFilters,
    options: { similarityThreshold: number; matchCount: number }
  ): Promise<DualSearchResult[]> {
    const { data, error } = await this.supabase.rpc('search_jobs_rpc', {
      query_embedding: queryEmbedding,
      similarity_threshold: options.similarityThreshold,
      match_count: options.matchCount,
      location_filter: filters.location,
      employment_type_filter: filters.employmentType,
      salary_min_filter: filters.salaryMin,
      salary_max_filter: filters.salaryMax,
      skills_filter: filters.skills,
      experience_required_filter: filters.experienceRequired,
      status_filter: 'active'
    })

    if (error) {
      throw new Error(`Single stage search error: ${error.message}`)
    }

    // 转换为双模型格式
    return (data || []).map((item: any) => ({
      ...item,
      similarity_small: item.similarity,
      similarity_large: null,
      final_score: item.similarity
    }))
  }

  /**
   * 生成双模型匹配
   */
  async generateDualMatches(
    candidateId?: string,
    jobId?: string,
    options: { matchCount?: number; minScore?: number } = {}
  ) {
    const { matchCount = 10, minScore = 0.7 } = options

    const { data, error } = await this.supabase.rpc(
      'generate_dual_matches_rpc',
      {
        candidate_id_param: candidateId,
        job_id_param: jobId,
        match_count: matchCount,
        min_score: minScore
      }
    )

    if (error) {
      throw new Error(`Generate matches error: ${error.message}`)
    }

    return data || []
  }

  /**
   * 获取双模型搜索统计
   */
  async getDualSearchStats() {
    const { data, error } = await this.supabase.rpc('get_dual_search_stats_rpc')

    if (error) {
      throw new Error(`Get stats error: ${error.message}`)
    }

    return (
      data?.[0] || {
        total_resumes: 0,
        total_jobs: 0,
        resumes_with_both_embeddings: 0,
        jobs_with_both_embeddings: 0,
        embedding_coverage_percentage: 0
      }
    )
  }

  /**
   * 获取需要处理的记录（用于批量生成large embeddings）
   */
  async getRecordsForDualEmbedding(
    tableName: 'resumes' | 'jobs',
    limitCount: number = 10
  ) {
    const { data, error } = await this.supabase.rpc(
      'get_records_for_dual_embedding_rpc',
      {
        table_name_param: tableName,
        limit_count: limitCount
      }
    )

    if (error) {
      throw new Error(`Get records error: ${error.message}`)
    }

    return data || []
  }

  /**
   * 更新记录的large embedding
   */
  async updateLargeEmbedding(
    tableName: 'resumes' | 'jobs',
    recordId: string,
    embeddingLarge: number[]
  ) {
    const { error } = await this.supabase
      .from(tableName)
      .update({ embedding_large: embeddingLarge })
      .eq('id', recordId)

    if (error) {
      throw new Error(`Update embedding error: ${error.message}`)
    }

    // 更新状态
    await this.supabase.rpc('update_dual_embedding_status', {
      table_name_param: tableName,
      record_id_param: recordId,
      status_param: 'completed'
    })
  }

  /**
   * 批量处理large embeddings
   */
  async batchProcessLargeEmbeddings(
    tableName: 'resumes' | 'jobs',
    batchSize: number = 5
  ) {
    const records = await this.getRecordsForDualEmbedding(tableName, batchSize)

    if (records.length === 0) {
      return { processed: 0, message: 'No records to process' }
    }

    let processed = 0
    const errors: string[] = []

    for (const record of records) {
      try {
        // 标记为处理中
        await this.supabase.rpc('update_dual_embedding_status', {
          table_name_param: tableName,
          record_id_param: record.id,
          status_param: 'processing'
        })

        // 生成large embedding
        const { data } = await this.supabase.functions.invoke(
          'get-dual-embedding',
          {
            body: { text: record.content, input_type: 'search_document' }
          }
        )

        if (data?.embedding_large) {
          await this.updateLargeEmbedding(
            tableName,
            record.id,
            data.embedding_large
          )
          processed++
        } else {
          throw new Error('No embedding_large in response')
        }
      } catch (error) {
        console.error(`Error processing ${record.id}:`, error)
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        errors.push(`${record.id}: ${errorMessage}`)

        // 标记为失败
        await this.supabase.rpc('update_dual_embedding_status', {
          table_name_param: tableName,
          record_id_param: record.id,
          status_param: 'failed',
          error_message_param: errorMessage
        })
      }
    }

    return {
      processed,
      total: records.length,
      errors,
      message: `Processed ${processed}/${records.length} records`
    }
  }
}

// 创建全局实例
export const dualSearchTool = new DualSearchTool()
