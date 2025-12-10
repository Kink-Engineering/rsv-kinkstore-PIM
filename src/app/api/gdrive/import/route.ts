import { downloadDriveFile, listFolderTree } from '@/lib/googleDrive'
import { uploadObject } from '@/lib/storj'
import { createUntypedClient } from '@/lib/supabase/server-untyped'
import { NextResponse } from 'next/server'

export const maxDuration = 300

function cleanPrefix(prefix?: string | null) {
  if (!prefix) return ''
  return prefix.replace(/^\/+/, '').replace(/\/+$/, '')
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const folderId = body.folderId || process.env.GOOGLE_DRIVE_SKU_FOLDER_ID
    const bucket = process.env.STORJ_S3_BUCKET || process.env.STORJ_BUCKET
    const supabase = await createUntypedClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!folderId) {
      return NextResponse.json({ error: 'folderId is required (or set GOOGLE_DRIVE_SKU_FOLDER_ID)' }, { status: 400 })
    }
    if (!bucket) {
      return NextResponse.json({ error: 'bucket is required (set STORJ_S3_BUCKET or STORJ_BUCKET)' }, { status: 400 })
    }
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const basePath =
      cleanPrefix(body.basePath) ||
      cleanPrefix(process.env.STORJ_BASE_PATH || process.env.STORJ_PATH_PREFIX || '')

    const files = await listFolderTree(folderId)

    const results = {
      total: files.length,
      uploaded: 0,
      failed: 0,
      errors: [] as Array<{ path: string; message: string }>,
      assetsCreated: 0,
      bucketsCreated: 0,
      skippedNoProduct: 0,
    }

    const bucketCache = new Map<
      string,
      { id: string; storjPath: string }
    >()

    for (const file of files) {
      try {
        const buffer = await downloadDriveFile(file.id)
        const pathParts = file.path.split('/')
        const skuLabel = pathParts[0]

        if (!skuLabel) {
          throw new Error('Missing SKU label in path')
        }

        // Lookup/create media bucket for sku_label
        let bucketInfo = bucketCache.get(skuLabel)
        if (!bucketInfo) {
          const { data: product } = await supabase
            .from('products')
            .select('id, sku_label')
            .eq('sku_label', skuLabel)
            .single()

          if (!product?.id) {
            results.skippedNoProduct += 1
            continue
          }

          const storjPath = [basePath, `products/${skuLabel}/`].filter(Boolean).join('')

          const { data: mb, error: bucketErr } = await supabase
            .from('media_buckets')
            .upsert(
              {
                product_id: product.id,
                sku_label: skuLabel,
                storj_path: storjPath,
                bucket_status: 'active',
                google_drive_folder_path: file.path.split('/').slice(0, -1).join('/'),
                last_upload_at: new Date().toISOString(),
              },
              { onConflict: 'product_id', ignoreDuplicates: false },
            )
            .select('id, storj_path')
            .single()

          if (bucketErr) {
            throw new Error(`Bucket upsert failed for ${skuLabel}: ${bucketErr.message}`)
          }

          if (mb) {
            if (mb.id !== undefined) {
              results.bucketsCreated += 1
            }
            bucketInfo = { id: mb.id, storjPath: mb.storj_path }
            bucketCache.set(skuLabel, bucketInfo)
          } else {
            throw new Error(`Bucket upsert returned no data for ${skuLabel}`)
          }
        }

        const key = [basePath, file.path].filter(Boolean).join('/')
        await uploadObject(bucket, key, buffer, file.mimeType)
        results.uploaded += 1

        const mediaType = file.mimeType.startsWith('image/')
          ? 'image'
          : file.mimeType.startsWith('video/')
            ? 'video'
            : 'file'

        const { error: assetErr } = await supabase.from('media_assets').insert({
          media_bucket_id: bucketInfo.id,
          media_type: mediaType,
          workflow_state: 'imported',
          workflow_category: 'raw',
          file_url: `storj://${bucket}/${key}`,
          file_key: key,
          file_size: buffer.length,
          file_mime_type: file.mimeType,
          original_filename: file.name,
          source_folder_path: file.path,
          google_drive_file_id: file.id,
          google_drive_folder_path: file.path.split('/').slice(0, -1).join('/'),
          import_source: 'google_drive',
        })

        if (assetErr) {
          throw new Error(`Asset insert failed for ${file.path}: ${assetErr.message}`)
        }

        results.assetsCreated += 1
      } catch (err) {
        results.failed += 1
        results.errors.push({
          path: file.path,
          message: err instanceof Error ? err.message : 'Unknown error',
        })
      }
    }

    return NextResponse.json({
      folderId,
      bucket,
      basePath,
      ...results,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

