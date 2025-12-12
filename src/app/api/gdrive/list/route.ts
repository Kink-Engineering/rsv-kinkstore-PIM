import { getFileMetadata, listFilesInFolder } from '@/lib/googleDrive'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const folderId =
      url.searchParams.get('folderId') || process.env.GOOGLE_DRIVE_SKU_FOLDER_ID

    if (!folderId) {
      return NextResponse.json(
        { error: 'folderId is required (or set GOOGLE_DRIVE_SKU_FOLDER_ID)' },
        { status: 400 },
      )
    }

    // Resolve folder name for UI breadcrumbing; fall back to ID if not found
    let folderName: string | null = null
    try {
      const meta = await getFileMetadata(folderId)
      folderName = meta?.name ?? null
    } catch (err) {
      console.warn('Failed to fetch folder metadata for breadcrumbing:', err)
    }

    const files = await listFilesInFolder(folderId)

    return NextResponse.json({
      folderId,
      folderName,
      count: files.length,
      files,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

