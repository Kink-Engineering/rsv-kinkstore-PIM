-- Allow media_buckets without a linked product
-- - product_id becomes nullable
-- - drop uniqueness on product_id (buckets can exist without products or share null)

BEGIN;

-- Drop the unique constraint on product_id
ALTER TABLE public.media_buckets
  DROP CONSTRAINT IF EXISTS media_buckets_product_id_key;

-- Make product_id nullable
ALTER TABLE public.media_buckets
  ALTER COLUMN product_id DROP NOT NULL;

-- Note: The existing FK (media_buckets_product_id_fkey) already allows NULLs,
-- so no change is needed for the foreign key itself.

COMMENT ON TABLE public.media_buckets IS 'Organizational storage container. One bucket per sku_label. product_id may be NULL when no product exists for the sku_label.';

COMMIT;

