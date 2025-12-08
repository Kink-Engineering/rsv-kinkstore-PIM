/**
 * Shopify Admin GraphQL API Client
 * 
 * Features:
 * - GraphQL queries and mutations
 * - Automatic rate limiting (respects Shopify's cost-based throttling)
 * - Retry logic with exponential backoff
 * - Pagination helpers
 */

const SHOPIFY_API_VERSION = '2024-01'

interface ShopifyConfig {
  storeDomain: string
  accessToken: string
}

interface GraphQLResponse<T> {
  data?: T
  errors?: Array<{
    message: string
    locations?: Array<{ line: number; column: number }>
    path?: string[]
    extensions?: {
      code: string
      requestId: string
    }
  }>
  extensions?: {
    cost: {
      requestedQueryCost: number
      actualQueryCost: number
      throttleStatus: {
        maximumAvailable: number
        currentlyAvailable: number
        restoreRate: number
      }
    }
  }
}

interface RateLimitState {
  available: number
  restoreRate: number
  lastUpdate: number
}

class ShopifyClient {
  private config: ShopifyConfig
  private rateLimitState: RateLimitState = {
    available: 1000, // Default max
    restoreRate: 50, // Points per second
    lastUpdate: Date.now(),
  }

  constructor(config: ShopifyConfig) {
    this.config = config
  }

  private get endpoint(): string {
    return `https://${this.config.storeDomain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`
  }

  private updateRateLimit(extensions?: GraphQLResponse<unknown>['extensions']) {
    if (extensions?.cost?.throttleStatus) {
      const { currentlyAvailable, restoreRate } = extensions.cost.throttleStatus
      this.rateLimitState = {
        available: currentlyAvailable,
        restoreRate,
        lastUpdate: Date.now(),
      }
    }
  }

  private async waitForRateLimit(cost: number = 100): Promise<void> {
    // Estimate current available points
    const elapsed = (Date.now() - this.rateLimitState.lastUpdate) / 1000
    const restored = elapsed * this.rateLimitState.restoreRate
    const estimated = Math.min(1000, this.rateLimitState.available + restored)

    if (estimated < cost) {
      const waitTime = ((cost - estimated) / this.rateLimitState.restoreRate) * 1000
      console.log(`Rate limit: waiting ${Math.ceil(waitTime)}ms`)
      await new Promise(resolve => setTimeout(resolve, waitTime + 100))
    }
  }

  async query<T>(
    query: string,
    variables?: Record<string, unknown>,
    options?: { estimatedCost?: number; retries?: number }
  ): Promise<T> {
    const { estimatedCost = 100, retries = 3 } = options || {}
    
    await this.waitForRateLimit(estimatedCost)

    let lastError: Error | null = null

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const response = await fetch(this.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': this.config.accessToken,
          },
          body: JSON.stringify({ query, variables }),
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        const json: GraphQLResponse<T> = await response.json()
        
        // Update rate limit tracking
        this.updateRateLimit(json.extensions)

        // Check for GraphQL errors
        if (json.errors?.length) {
          const errorMessages = json.errors.map(e => e.message).join(', ')
          
          // Check for throttling error
          if (json.errors.some(e => e.extensions?.code === 'THROTTLED')) {
            console.log('Shopify throttled, waiting...')
            await new Promise(resolve => setTimeout(resolve, 2000))
            continue
          }
          
          throw new Error(`GraphQL Error: ${errorMessages}`)
        }

        if (!json.data) {
          throw new Error('No data in response')
        }

        return json.data
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        
        if (attempt < retries - 1) {
          const backoff = Math.pow(2, attempt) * 1000
          console.log(`Retry ${attempt + 1}/${retries} after ${backoff}ms`)
          await new Promise(resolve => setTimeout(resolve, backoff))
        }
      }
    }

    throw lastError || new Error('Unknown error')
  }

  /**
   * Paginate through all results using cursor-based pagination
   */
  async *paginate<T, N>(
    query: string,
    variables: Record<string, unknown>,
    getPageInfo: (data: T) => { hasNextPage: boolean; endCursor: string | null },
    getNodes: (data: T) => N[],
    options?: { pageSize?: number }
  ): AsyncGenerator<N[], void, unknown> {
    const { pageSize = 50 } = options || {}
    let cursor: string | null = null
    let hasNextPage = true

    while (hasNextPage) {
      const data = await this.query<T>(query, {
        ...variables,
        first: pageSize,
        after: cursor,
      })

      const nodes = getNodes(data)
      if (nodes.length > 0) {
        yield nodes
      }

      const pageInfo = getPageInfo(data)
      hasNextPage = pageInfo.hasNextPage
      cursor = pageInfo.endCursor
    }
  }
}

// Singleton instance
let client: ShopifyClient | null = null

export function getShopifyClient(): ShopifyClient {
  if (!client) {
    const storeDomain = process.env.SHOPIFY_STORE_DOMAIN
    const accessToken = process.env.SHOPIFY_ACCESS_TOKEN

    if (!storeDomain || !accessToken) {
      throw new Error('Missing Shopify credentials. Set SHOPIFY_STORE_DOMAIN and SHOPIFY_ACCESS_TOKEN')
    }

    client = new ShopifyClient({ storeDomain, accessToken })
  }

  return client
}

export { ShopifyClient }
export type { GraphQLResponse }

