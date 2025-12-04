# Shopify PIM System - Implementation Plan

## Executive Summary
Building a Product Information Management (PIM) system for ~1,000 products with media management, product data editing, and Shopify synchronization. The system will migrate from Google Drive storage to a database-driven solution with cloud storage.

## Architecture Overview

### Technology Stack
- **Frontend**: React (deployed on Vercel)
- **Backend**: Node.js API (deployed on Vercel serverless functions or separate Node server)
- **Database**: PostgreSQL (Supabase)
- **File Storage**: Storj (S3-compatible)
- **Authentication**: Auth0 with Google OAuth
- **External Integrations**:
  - Shopify Admin GraphQL API
  - Video encoding GraphQL API (upload via URL, query by name)
- **Media Processing Libraries**:
  - Image editing: `react-image-crop` + `sharp` (crop, resize, rotate)
  - Video editing: `ffmpeg.js` or `remotion` (trim, stitch intro/outro)

### Key Design Decisions

#### 1. SKU/Product Identification Strategy
- **Primary Key**: Use Shopify Product ID as the main identifier
- **Import Strategy**: During Google Drive import, create mapping between folder names → Shopify Product IDs
- **Rationale**: Shopify Product ID is guaranteed unique and provides direct integration path

#### 2. Media Asset Management (Reference-Based)
- **Central Media Library**: All images/videos stored once in media table
- **Association Model**: Many-to-many relationships via junction tables
- **Use Cases Supported**:
  - Product-level media (hero images, galleries)
  - Variant-level media (specific to size/color variants)
  - Collection-level media (future: collection hero images)
  - Shared media across products (bundles)

#### 3. Media Workflow States
```
Images:  raw → edited → ready_for_publish → published
Videos:  raw → edited → encoding_submitted → encoded → ready_for_publish → published
```

## Database Schema

### Core Tables

#### `products`
```sql
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shopify_product_id BIGINT UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  description_html TEXT,
  handle VARCHAR(255),
  vendor VARCHAR(255),
  product_type VARCHAR(255),
  tags TEXT[], -- PostgreSQL array
  status VARCHAR(50) DEFAULT 'draft', -- draft, active, archived
  shopify_status VARCHAR(50), -- ACTIVE, DRAFT, ARCHIVED (from Shopify)
  shopify_published_at TIMESTAMP,
  metadata JSONB, -- flexible metafields storage
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_synced_at TIMESTAMP,
  google_drive_folder_path VARCHAR(500) -- for import reference
);

CREATE INDEX idx_products_shopify_id ON products(shopify_product_id);
CREATE INDEX idx_products_status ON products(status);
```

#### `product_variants`
```sql
CREATE TABLE product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  shopify_variant_id BIGINT UNIQUE NOT NULL,
  sku VARCHAR(255),
  title VARCHAR(255),
  price DECIMAL(10,2),
  compare_at_price DECIMAL(10,2),
  weight DECIMAL(10,2),
  weight_unit VARCHAR(10), -- lb, oz, kg, g
  dimensions JSONB, -- {length, width, height, unit}
  inventory_quantity INTEGER,
  position INTEGER,
  option1 VARCHAR(255), -- size, color, etc.
  option2 VARCHAR(255),
  option3 VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_variants_product_id ON product_variants(product_id);
CREATE INDEX idx_variants_shopify_id ON product_variants(shopify_variant_id);
CREATE INDEX idx_variants_sku ON product_variants(sku);
```

#### `media_assets`
```sql
CREATE TABLE media_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_type VARCHAR(20) NOT NULL, -- image, video
  workflow_state VARCHAR(50) NOT NULL, -- raw, edited, encoding_submitted, encoded, ready_for_publish, published

  -- File storage
  raw_file_url VARCHAR(500), -- Storj URL for raw file
  raw_file_key VARCHAR(500), -- Storj object key
  raw_file_size BIGINT,
  raw_file_mime_type VARCHAR(100),

  edited_file_url VARCHAR(500), -- Storj URL for edited file
  edited_file_key VARCHAR(500),
  edited_file_size BIGINT,
  edited_file_mime_type VARCHAR(100),

  -- Video-specific
  encoding_job_id VARCHAR(255), -- external encoding API job ID
  encoded_video_url VARCHAR(500), -- final encoded video URL from API
  video_metadata JSONB, -- duration, resolution, codec, etc.

  -- Image-specific
  image_metadata JSONB, -- width, height, format, etc.

  -- Common metadata
  alt_text TEXT,
  title VARCHAR(255),
  original_filename VARCHAR(255),

  -- Tracking
  uploaded_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Import tracking
  google_drive_file_id VARCHAR(255),
  import_source VARCHAR(255)
);

CREATE INDEX idx_media_workflow_state ON media_assets(workflow_state);
CREATE INDEX idx_media_type ON media_assets(media_type);
```

#### `product_media` (Junction Table)
```sql
CREATE TABLE product_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  media_asset_id UUID REFERENCES media_assets(id) ON DELETE CASCADE,
  association_type VARCHAR(50) NOT NULL, -- product_hero, product_gallery, variant_specific, collection_hero
  variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE, -- nullable, only for variant-specific
  position INTEGER DEFAULT 0, -- for ordering gallery images
  is_featured BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(product_id, media_asset_id, association_type, variant_id)
);

CREATE INDEX idx_product_media_product ON product_media(product_id);
CREATE INDEX idx_product_media_asset ON product_media(media_asset_id);
CREATE INDEX idx_product_media_variant ON product_media(variant_id);
```

#### `users`
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth0_user_id VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  role VARCHAR(50) NOT NULL, -- admin, photographer, writer, viewer
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  last_login_at TIMESTAMP
);

CREATE INDEX idx_users_auth0_id ON users(auth0_user_id);
CREATE INDEX idx_users_email ON users(email);
```

#### `sync_logs`
```sql
CREATE TABLE sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_type VARCHAR(50) NOT NULL, -- import_from_shopify, publish_to_shopify, import_from_gdrive
  entity_type VARCHAR(50), -- product, media
  entity_id UUID,
  status VARCHAR(50) NOT NULL, -- success, failed, partial
  error_message TEXT,
  details JSONB,
  performed_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_sync_logs_type ON sync_logs(sync_type);
CREATE INDEX idx_sync_logs_created ON sync_logs(created_at);
```

#### `audit_logs`
```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name VARCHAR(100) NOT NULL,
  record_id UUID NOT NULL,
  action VARCHAR(50) NOT NULL, -- create, update, delete
  old_values JSONB,
  new_values JSONB,
  user_id UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_table_record ON audit_logs(table_name, record_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);
```

## Application Architecture

### Backend API Structure

```
/api
├── /auth
│   ├── POST /login (Auth0 callback)
│   ├── POST /logout
│   └── GET /me (current user info)
├── /products
│   ├── GET /products (list with pagination, filtering)
│   ├── GET /products/:id
│   ├── POST /products (create)
│   ├── PUT /products/:id (update)
│   ├── DELETE /products/:id
│   ├── POST /products/:id/sync-to-shopify
│   └── POST /products/:id/publish-to-shopify
├── /variants
│   ├── GET /products/:productId/variants
│   ├── POST /products/:productId/variants
│   ├── PUT /variants/:id
│   └── DELETE /variants/:id
├── /media
│   ├── GET /media (list with filtering by state, type)
│   ├── GET /media/:id
│   ├── POST /media/upload-raw (multipart upload)
│   ├── POST /media/:id/upload-edited (multipart upload)
│   ├── PUT /media/:id (update metadata)
│   ├── DELETE /media/:id
│   ├── POST /media/:id/submit-for-encoding (video only)
│   ├── GET /media/:id/encoding-status (poll encoding job)
│   └── POST /media/:id/mark-ready (move to ready_for_publish)
├── /product-media
│   ├── POST /products/:productId/media (associate media)
│   ├── PUT /product-media/:id (update association)
│   ├── DELETE /product-media/:id (remove association)
│   └── PUT /products/:productId/media/reorder (reorder gallery)
├── /shopify
│   ├── POST /shopify/import-products (bulk import from Shopify)
│   ├── POST /shopify/import-product/:shopifyId
│   └── GET /shopify/sync-status
├── /import
│   ├── POST /import/google-drive (initiate import job)
│   ├── GET /import/jobs/:id (check import progress)
│   └── POST /import/map-folders (map GDrive folders to products)
└── /admin
    ├── GET /admin/users
    ├── PUT /admin/users/:id/role
    └── GET /admin/logs
```

### Frontend Application Structure

```
/src
├── /components
│   ├── /auth
│   │   ├── LoginButton.tsx
│   │   ├── LogoutButton.tsx
│   │   └── ProtectedRoute.tsx
│   ├── /products
│   │   ├── ProductList.tsx
│   │   ├── ProductCard.tsx
│   │   ├── ProductDetail.tsx
│   │   ├── ProductEditor.tsx
│   │   └── ProductVariantEditor.tsx
│   ├── /media
│   │   ├── MediaLibrary.tsx
│   │   ├── MediaUploader.tsx
│   │   ├── MediaCard.tsx
│   │   ├── MediaEditor.tsx
│   │   ├── ImageEditor.tsx (basic crop/resize)
│   │   └── VideoEncoder.tsx
│   ├── /associations
│   │   ├── ProductMediaManager.tsx
│   │   └── MediaAssociationModal.tsx
│   ├── /import
│   │   ├── GoogleDriveImporter.tsx
│   │   ├── ShopifyImporter.tsx
│   │   └── FolderMappingTool.tsx
│   └── /common
│       ├── Button.tsx
│       ├── Modal.tsx
│       ├── Table.tsx
│       ├── FileUpload.tsx
│       └── StatusBadge.tsx
├── /pages
│   ├── Dashboard.tsx
│   ├── ProductsPage.tsx
│   ├── ProductDetailPage.tsx
│   ├── MediaLibraryPage.tsx
│   ├── ImportPage.tsx
│   └── AdminPage.tsx
├── /hooks
│   ├── useAuth.ts
│   ├── useProducts.ts
│   ├── useMedia.ts
│   └── useFileUpload.ts
├── /services
│   ├── api.ts (axios instance)
│   ├── auth.ts (Auth0 integration)
│   ├── shopify.ts
│   ├── storage.ts (Storj S3 operations)
│   └── videoEncoding.ts
├── /contexts
│   └── AuthContext.tsx
└── /utils
    ├── validation.ts
    └── formatting.ts
```

## Implementation Phases

### Phase 1: Foundation & Authentication (Week 1)
**Goal**: Set up project structure, database, and authentication

1. **Project Setup**
   - Initialize monorepo or separate repos for frontend/backend
   - Set up Vercel deployment configs
   - Configure Supabase PostgreSQL database
   - Set up Storj S3 bucket and credentials

2. **Database Setup**
   - Create all tables with migrations
   - Set up Supabase Row Level Security (RLS) policies
   - Create database functions/triggers for updated_at timestamps
   - Set up audit logging triggers

3. **Authentication**
   - Configure Auth0 tenant with Google OAuth
   - Implement Auth0 integration in backend
   - Create Auth0 React SDK integration
   - Build login/logout flow
   - Implement role-based access control (RBAC) middleware
   - Create user management endpoints

4. **Basic Frontend Shell**
   - Set up React app with routing
   - Create layout components (header, sidebar, nav)
   - Implement protected routes
   - Build basic dashboard page

**Deliverable**: Working app with authentication, empty dashboard

### Phase 2: Shopify Integration & Product Import (Week 2)
**Goal**: Import existing products from Shopify

1. **Shopify API Client**
   - Create GraphQL client for Shopify Admin API
   - Implement rate limiting/throttling
   - Build query/mutation wrappers for products
   - Build query/mutation wrappers for variants

2. **Import Service**
   - Build bulk import from Shopify
   - Map Shopify products to database schema
   - Import products with variants
   - Handle pagination for large datasets
   - Store sync timestamps

3. **Product CRUD Operations**
   - Build product list API with filtering/pagination
   - Build product detail API
   - Build product update API
   - Create sync-to-shopify endpoint (update existing)

4. **Product UI**
   - Build product list page with search/filter
   - Build product detail/editor page
   - Create variant editor component
   - Implement product metadata editor (tags, dimensions, weight)

**Deliverable**: Can import and view all Shopify products, basic editing

### Phase 3: Media Management Core (Week 3)
**Goal**: Upload, store, and manage media assets

1. **Storage Service**
   - Configure Storj S3 client
   - Implement signed URL generation for uploads
   - Implement signed URL generation for downloads
   - Build file upload handlers (multipart)
   - Create thumbnail generation service (images)

2. **Media API**
   - Build media upload endpoints (raw, edited)
   - Build media list/detail endpoints
   - Implement media metadata update
   - Create media deletion (with orphan checks)
   - Build media state transition endpoints

3. **Media Library UI**
   - Build media library page with grid/list views
   - Create media upload component (drag & drop)
   - Build media card with preview
   - Create media detail/editor modal
   - Implement workflow state visualization
   - Add filtering by state, type, date

4. **Basic Image Handling**
   - Display image previews
   - Show image metadata (dimensions, size)
   - Allow alt text editing

5. **Image Editing Tools**
   - Integrate `react-image-crop` component
   - Build backend endpoint with `sharp` for processing
   - Implement crop, resize, rotate operations
   - Save edited version to Storj
   - Preview edited image before saving

6. **Video Editing Tools**
   - Set up `fluent-ffmpeg` on backend (requires ffmpeg binary)
   - Build trim/cut endpoint (specify start/end timestamps)
   - Build stitch endpoint (combine intro/video/outro)
   - Create video preview player
   - Save edited version to Storj

**Deliverable**: Can upload images and videos, view in library, edit metadata, perform basic editing

### Phase 4: Product-Media Association (Week 4)
**Goal**: Connect media assets to products

1. **Association API**
   - Build endpoints to associate media with products
   - Build endpoints to associate media with variants
   - Implement position/ordering for galleries
   - Create batch association endpoints
   - Build media reordering endpoint

2. **Association UI**
   - Create media association modal/drawer
   - Build drag-and-drop media gallery editor
   - Create variant media selector
   - Implement hero image selector
   - Build shared media indicator (shows where media is used)

3. **Product Detail Enhancement**
   - Show associated media in product detail
   - Display variant-specific media
   - Show media workflow states
   - Create inline media upload from product page

**Deliverable**: Can associate media with products, set hero images, reorder galleries

### Phase 5: Google Drive Import (Week 5)
**Goal**: Migrate existing media from Google Drive

1. **Google Drive Integration**
   - Set up Google Drive API credentials
   - Build folder traversal service
   - Implement file download from Drive
   - Create folder → product mapping tool

2. **Import Service**
   - Build mapping UI (folder name → Shopify Product ID)
   - Create bulk download from Drive
   - Upload files to Storj
   - Create media_assets records
   - Auto-associate with products based on mapping
   - Track import progress/status

3. **Import UI**
   - Build import wizard
   - Create folder mapping interface
   - Show import progress
   - Display import results/errors
   - Allow retry of failed imports

**Deliverable**: Can import all media from Google Drive folders to PIM

### Phase 6: Video Encoding Integration (Week 6)
**Goal**: Handle video encoding workflow

1. **Video Encoding Service**
   - Create GraphQL client for encoding API
   - Build upload endpoint (get upload URL from API, upload edited video)
   - Generate unique video names (e.g., `product-{shopify_id}-{timestamp}`)
   - Submit video with name for encoding
   - Implement polling mechanism to query video by name
   - Parse response to extract encoded video URL
   - Store encoded URL in `media_assets.encoded_video_url`
   - Update workflow state to 'encoded'

2. **Video Workflow UI**
   - Create video upload flow (raw → edited)
   - Build "Submit for Encoding" button
   - Show encoding progress/status
   - Display encoded video preview
   - Allow marking as ready for publish

3. **Video Player**
   - Integrate video player component
   - Show video metadata (duration, resolution)
   - Display encoding status

**Deliverable**: Complete video workflow from upload to encoded URL

### Phase 7: Shopify Publishing (Week 7)
**Goal**: Publish products and media to Shopify

1. **Publishing Service**
   - Build product publish/unpublish to Shopify
   - Implement media upload to Shopify
   - Handle Shopify media associations
   - Create product update sync (description, tags, etc.)
   - Build variant sync
   - Implement conflict resolution (handle changes on Shopify side)

2. **Publishing UI**
   - Create "Publish to Shopify" button
   - Build publish preview (show what will change)
   - Display publish status
   - Show sync history
   - Create "Unpublish from Shopify" action

3. **Sync Management**
   - Build sync status dashboard
   - Show last sync time per product
   - Display sync errors
   - Create manual re-sync trigger

**Deliverable**: Can publish complete products with media to Shopify

### Phase 8: Polish & Admin Features (Week 8)
**Goal**: Complete admin features, improve UX

1. **Admin Panel**
   - Build user management UI
   - Create role assignment
   - Display audit logs
   - Show sync logs
   - Create system health dashboard

2. **Enhanced Filtering & Search**
   - Add full-text search for products
   - Create advanced filters (tags, status, date ranges)
   - Build saved filter presets
   - Implement bulk operations

3. **UX Improvements**
   - Add loading states
   - Implement error handling/toast notifications
   - Create keyboard shortcuts
   - Add bulk selection
   - Build undo/redo for critical operations

4. **Documentation**
   - Write user guide
   - Create API documentation
   - Document deployment process
   - Write troubleshooting guide

**Deliverable**: Production-ready PIM system

## Security Considerations

### Authentication & Authorization
- Auth0 JWT validation on all API endpoints
- Role-based access control (RBAC)
  - **Admin**: Full access
  - **Photographer**: Upload/edit media, view products
  - **Writer**: Edit product descriptions, manage metadata, view media
  - **Viewer**: Read-only access
- Supabase RLS policies to enforce data access

### File Storage
- Signed URLs with expiration for Storj uploads/downloads
- Validate file types and sizes on upload
- Scan for malware (optional: integrate ClamAV or similar)
- Separate buckets for raw vs. published media

### API Security
- Rate limiting on API endpoints
- CORS configuration for frontend origin only
- Input validation and sanitization
- SQL injection prevention (parameterized queries)
- XSS prevention (sanitize HTML input)

### Secrets Management
- Store API keys in environment variables
- Use Vercel environment variables for deployment
- Rotate Shopify access tokens periodically
- Never commit secrets to git

## Performance Considerations

### Database
- Indexes on foreign keys and frequently queried columns
- Pagination for large result sets (products, media)
- Consider materialized views for complex queries
- Use JSONB for flexible metadata (with GIN indexes if needed)

### File Storage
- Generate thumbnails for images (100x100, 400x400)
- Use CDN in front of Storj for faster delivery
- Lazy load images in UI
- Implement progressive image loading

### API
- Cache frequently accessed data (products list)
- Use React Query for client-side caching
- Implement debouncing for search inputs
- Consider Redis for session/cache storage (if needed)

### Shopify API
- Respect rate limits (cost-based throttling)
- Batch operations where possible
- Cache Shopify data with appropriate TTL
- Implement exponential backoff for retries

## Media Editing Features

### Image Editing (Built-in, Basic)
**Libraries**: `react-image-crop` (frontend) + `sharp` (backend processing)

**Features**:
- Crop to custom dimensions or aspect ratios
- Resize/scale
- Rotate (90°, 180°, 270°)
- Preview before save
- Non-destructive (keeps original raw file)

**Implementation**:
- Frontend: React component with `react-image-crop` for interactive cropping
- Backend: `sharp` library to process and save edited version
- Store both raw and edited versions in Storj
- Update `media_assets.edited_file_url` on save

### Video Editing (Built-in, Basic)
**Libraries**: `ffmpeg.wasm` (browser-based) or `fluent-ffmpeg` (server-side)

**Features**:
- Trim start/end (cut beginning and end)
- Stitch intro/outro clips (add leadins/leadouts)
- Preview trimmed video
- Non-destructive (keeps original raw file)

**Implementation**:
- Option 1: `ffmpeg.wasm` - runs in browser, no server load, slower for large files
- Option 2: `fluent-ffmpeg` on backend - faster, requires ffmpeg binary on server
- Recommended: Use `fluent-ffmpeg` on backend for better performance
- Store raw, edited, and encoded versions separately
- Update workflow: raw → edited (trimmed/stitched) → submit for encoding → encoded

**Video Workflow Enhancement**:
```
1. Upload raw video → Storj (raw_file_url)
2. Download, trim/stitch in PIM → Save edited version (edited_file_url)
3. Submit edited version to encoding API with name
4. Poll/query encoding API by name for completion
5. Retrieve encoded URL → Store in encoded_video_url
6. Mark as ready_for_publish → Publish to Shopify
```

### Video Encoding API Integration
**API Type**: GraphQL
**Upload**: Video file uploaded to provided URL
**Tracking**: Videos queryable by name (given at upload time)
**Workflow**: Query for video by name to check encoding status and retrieve final URL

**Implementation**:
- Create GraphQL client for encoding API
- Upload edited video with unique name (e.g., `product-{shopify_id}-{timestamp}`)
- Store encoding job name in `media_assets.encoding_job_id`
- Poll API periodically to query video by name
- Update `media_assets.encoded_video_url` when complete
- Update `media_assets.workflow_state` to 'encoded'

## Open Questions / TBD

1. **Collection Media**
   - Do you need collection management now or future phase?
   - Should collections be imported from Shopify?

2. **Variant Options**
   - How many option dimensions? (Shopify supports 3 max: option1, option2, option3)
   - Should option names/values be editable in PIM?

3. **Backup Strategy**
   - Automated database backups via Supabase
   - Storj versioning enabled?
   - Point-in-time recovery requirements?

4. **Monitoring & Alerts**
   - Error tracking (Sentry, LogRocket)?
   - Uptime monitoring?
   - Alert on sync failures?

## Cost Estimates (Monthly)

- **Vercel**: $20/month (Pro plan) or $0 (Hobby, if within limits)
- **Supabase**: $25/month (Pro plan for better performance) or $0 (Free tier for testing)
- **Storj**: ~$4/TB/month storage + $7/TB bandwidth (depends on usage)
- **Auth0**: $0 (Free tier for up to 7,000 active users)
- **Video Encoding API**: TBD based on provider

**Estimated Total**: $50-100/month depending on storage and usage

## Success Metrics

- All ~1,000 products imported from Shopify ✓
- All media migrated from Google Drive ✓
- 5-10 users can log in and manage products ✓
- Media workflow (upload → edit → publish) functional ✓
- Products can be published to Shopify with media ✓
- System handles media sharing across products ✓
- Role-based access working correctly ✓

## Next Steps

Once this plan is approved:
1. Create project repositories (monorepo or separate repos)
2. Set up Supabase project and run migrations
3. Configure Auth0 tenant
4. Set up Storj bucket
5. Begin Phase 1 implementation

---

**Plan Version**: 1.0
**Last Updated**: 2025-12-03
**Status**: Awaiting Approval
