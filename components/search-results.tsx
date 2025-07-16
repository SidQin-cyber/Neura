'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { SearchResultItem } from '@/lib/types'
import Link from 'next/link'
import { useState } from 'react'

export interface SearchResultsProps {
  results: SearchResultItem[]
  displayMode?: 'grid' | 'list'
}

export function SearchResults({
  results,
  displayMode = 'grid'
}: SearchResultsProps) {
  // State to manage whether to display the results
  const [showAllResults, setShowAllResults] = useState(false)

  const handleViewMore = () => {
    setShowAllResults(true)
  }

  // Logic for grid mode
  const displayedGridResults = showAllResults ? results : results.slice(0, 3)
  const additionalResultsCount = results.length > 3 ? results.length - 3 : 0
  const displayUrlName = (url: string) => {
    const hostname = new URL(url).hostname
    const parts = hostname.split('.')
    return parts.length > 2 ? parts.slice(1, -1).join('.') : parts[0]
  }

  // --- List Mode Rendering ---
  if (displayMode === 'list') {
    return (
      <div className="flex flex-col gap-3">
        {results.map((result, index) => (
          <Link
            href={result.url}
            key={index}
            passHref
            target="_blank"
            className="block"
          >
            <Card className="w-full hover:bg-muted/50 transition-colors">
              <CardContent className="p-4 flex items-start space-x-3">
                <Avatar className="h-4 w-4 mt-1 flex-shrink-0">
                  <AvatarImage
                    src={`https://www.google.com/s2/favicons?domain=${
                      new URL(result.url).hostname
                    }`}
                    alt={new URL(result.url).hostname}
                  />
                  <AvatarFallback>
                    {new URL(result.url).hostname[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium text-text-primary line-clamp-1 mb-2">
                    {result.title}
                  </h3>
                  <p className="text-xs text-text-secondary line-clamp-2 mb-2">
                    {result.content}
                  </p>
                  <div className="text-xs text-text-placeholder truncate">
                    {displayUrlName(result.url)}
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    )
  }

  // --- Grid Mode Rendering (Existing Logic) ---
  return (
    <div className="flex flex-wrap gap-3">
      {displayedGridResults.map((result, index) => (
        <div className="w-[calc(50%-0.375rem)] md:w-[calc(25%-0.5625rem)]" key={index}>
          <Link href={result.url} passHref target="_blank">
            <Card className="flex-1 h-full hover:bg-muted/50 transition-colors">
              <CardContent className="p-4 flex flex-col justify-between h-full">
                <p className="text-xs text-text-primary line-clamp-2 min-h-[2.5rem] leading-relaxed">
                  {result.title || result.content}
                </p>
                <div className="mt-4 flex items-center space-x-2">
                  <Avatar className="h-4 w-4">
                    <AvatarImage
                      src={`https://www.google.com/s2/favicons?domain=${
                        new URL(result.url).hostname
                      }`}
                      alt={new URL(result.url).hostname}
                    />
                    <AvatarFallback>
                      {new URL(result.url).hostname[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="text-xs text-text-placeholder truncate">
                    {`${displayUrlName(result.url)} - ${index + 1}`}
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>
      ))}
      {!showAllResults && additionalResultsCount > 0 && (
        <div className="w-[calc(50%-0.375rem)] md:w-[calc(25%-0.5625rem)]">
          <Card className="flex-1 flex h-full items-center justify-center">
            <CardContent className="p-4">
              <Button
                variant={'link'}
                className="text-text-secondary"
                onClick={handleViewMore}
              >
                View {additionalResultsCount} more
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
