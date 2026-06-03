# Document Upload Guide

## Supported File Types

LibreChat now supports comprehensive document uploads including Office files (xlsx, pptx, docx) and many other formats.

### Office Documents
- **Word**: `.docx`, `.doc` (Microsoft Word documents)
- **Excel**: `.xlsx`, `.xls` (Spreadsheets and data files)
- **PowerPoint**: `.pptx`, `.ppt` (Presentations)

### Other Document Types
- **PDF**: `.pdf` (Portable Document Format)
- **Text Files**: `.txt`, `.md`, `.csv`, `.html`, `.css`, `.xml`, `.json`, `.yaml`, `.yml`
- **Code Files**: `.js`, `.ts`, `.py`, `.java`, `.c`, `.cpp`, `.php`, `.rb`, `.sh`, `.sql`
- **Archives**: `.zip`, `.tar`
- **E-books**: `.epub`
- **Images**: `.jpg`, `.png`, `.gif`, `.webp`, `.heic`, `.heif`, `.svg`
- **Audio**: `.mp3`, `.wav`, `.ogg`, `.m4a`, `.flac`, `.opus`
- **Video**: `.mp4`, `.avi`, `.mov`, `.webm`, `.mkv`

## How to Upload Documents

### Method 1: Using the Context Tool Resource (Recommended for Office Files)

1. Click the **attachment icon** (📎) in the chat input
2. Select **"Upload OCR/Text"** from the menu
3. Choose your document file (docx, xlsx, pptx, pdf, etc.)
4. The file will be processed using OCR and text extraction
5. The extracted content will be available to the AI in the conversation

**Benefits:**
- Extracts text content from Office documents
- Processes PDFs with OCR
- Handles scanned documents and images
- Best for documents where you want the AI to read and understand the content

### Method 2: Direct Upload for Document-Supported Providers

For providers that support document attachments natively (Anthropic, Google, etc.):

1. Click the **attachment icon** (📎)
2. Select **"Upload to Provider"**
3. Choose your file
4. The file is sent directly to the AI provider

**Benefits:**
- Native document understanding
- Faster processing for supported providers
- Works with images, PDFs, and some document formats

### Method 3: File Search for Agents

For agent-based conversations with RAG (Retrieval Augmented Generation):

1. Click the **attachment icon** (📎)
2. Select **"Upload for File Search"**
3. Choose your documents
4. Files are indexed in a vector database
5. The agent can search and reference these files during conversation

**Benefits:**
- Create a knowledge base from multiple documents
- Semantic search across large document collections
- Persistent file storage for agent workflows

## Configuration

### Enabling OCR for Office Documents

The configuration has been updated in `librechat.yaml` to enable OCR processing:

```yaml
endpoints:
  agents:
    capabilities:
      - ocr  # Enable OCR for document processing
      - context  # Enable context extraction
      - file_search
      - execute_code

fileConfig:
  ocr:
    supportedMimeTypes:
      - "^application/vnd\\.openxmlformats-officedocument\\.(wordprocessingml\\.document|presentationml\\.presentation|spreadsheetml\\.sheet)$"
      - "^application/pdf$"
      - "^image/.*$"
```

### File Size Limits

Default limits configured:
- **Per file**: 20 MB for standard endpoints, 50 MB for agents
- **Total upload**: 100 MB for standard, 200 MB for agents
- Server-side limit: 100 MB

These can be adjusted in `librechat.yaml` under the `fileConfig` section.

## Troubleshooting

### "Unsupported file type" Error

**For Office files (docx, xlsx, pptx):**
- Make sure you're using the **Context tool resource** option
- Verify OCR capability is enabled in your configuration
- Check that the file extension and MIME type are correct

**Solution:**
1. Click attachment icon → Select "Upload OCR/Text"
2. If still not working, check `librechat.yaml` has OCR enabled
3. Restart the server after configuration changes

### "File too large" Error

**Solutions:**
1. Compress the file (especially for Office documents and PDFs)
2. Split large documents into smaller parts
3. For images in documents, reduce image resolution
4. Adjust file size limits in configuration if needed

### No Text Extracted from Office Documents

**Possible causes:**
- Document is password-protected
- Document contains only images (no selectable text)
- OCR service is not configured

**Solutions:**
1. Remove password protection from the document
2. For image-only documents, ensure OCR is properly configured
3. Try converting to PDF first

### Office Files Not Showing in Upload Dialog

**Check:**
1. Browser file picker filters - make sure "All Files" is selected
2. File extension is correct (.docx not .doc.txt)
3. MIME type is being detected correctly

## Best Practices

1. **For Text-Heavy Documents**: Use Context tool resource for best text extraction
2. **For Data Files (Excel)**: CSV export often works better than xlsx for data analysis
3. **For Large PDFs**: Consider splitting into chapters or sections
4. **For Presentations**: Extract speaker notes and slide text works best with Context
5. **For Images in Documents**: Ensure images are clear and high-resolution for OCR

## Technical Details

### OCR Processing

When you upload an Office document via the Context tool resource:

1. File is uploaded to the server
2. MIME type is validated against supported types
3. Document is processed through OCR pipeline (if configured)
4. Text content is extracted and stored
5. Content becomes available in the conversation context

### Supported MIME Types

Full list of supported MIME types is configured in `packages/data-provider/src/file-config.ts`:

- Office XML formats: `application/vnd.openxmlformats-officedocument.*`
- Legacy Office: `application/vnd.ms-*`, `application/msword`
- Excel variations: Multiple Excel MIME types supported
- Text formats: All standard text MIME types
- Media: Images, audio, video with proper codecs

## Getting Help

If you continue to have issues with document uploads:

1. Check the browser console for error messages
2. Review server logs for upload failures
3. Verify your configuration matches this guide
4. Ensure all required services are running (OCR provider if configured)
5. Test with a simple text file first to verify basic upload works

## Recent Changes

✅ Added OCR capability to agent configuration
✅ Enabled comprehensive Office file MIME types
✅ Added helpful error messages for unsupported files
✅ Improved UI feedback for Office document uploads
✅ Documented all supported file types and upload methods
