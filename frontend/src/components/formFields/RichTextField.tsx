import 'react-quill/dist/quill.snow.css';

import AttachFileIcon from '@mui/icons-material/AttachFile';
import ImageIcon from '@mui/icons-material/Image';
import { Box, FormControl, Typography } from '@mui/material';
import DOMPurify from 'dompurify';
import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import ReactQuill from 'react-quill';
import { useTranslation } from 'react-i18next';
import { uploadDraftFile, uploadTicketFile } from '../../services/ticket';

function toQuillSafeImageSrc(src: string): string {
  if (!src) return src;
  if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:')) {
    return src;
  }
  if (src.startsWith('//')) {
    return `${window.location.protocol}${src}`;
  }
  try {
    return new URL(src, window.location.origin).toString();
  } catch {
    return src;
  }
}

/** Map blob: URLs shown in the editor to persisted API paths (img cannot load /api/... without Authorization). */
function rewriteEditorHtmlToPersisted(html: string, blobToApi: Map<string, string>): string {
  let result = html;
  blobToApi.forEach((apiUrl, blobUrl) => {
    if (result.includes(blobUrl)) {
      result = result.split(blobUrl).join(apiUrl);
    }
  });
  return result;
}

interface RichTextFieldProps {
  value: any;
  onChange: (value: string) => void;
  mode: 'view' | 'edit';
  props: any;
  ticketId?: string;
}

function RichTextField({ value = '', onChange, mode, props, ticketId }: RichTextFieldProps) {
  const { t } = useTranslation();
  const placeholder = props?.placeholder || t('workflow.componentCategories.richTextComponentDefaultPlaceholder');
  const quillRef = useRef<any>(null);
  const normalizeHtml = useCallback((html: string) => (html === '<p><br></p>' ? '' : html), []);
  const lastEmittedValueRef = useRef<string>(normalizeHtml((value ?? '').toString()));
  const blobSrcToApiUrlRef = useRef<Map<string, string>>(new Map());
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const insertImageByUploadRef = useRef<(quillInstance?: any) => Promise<void>>(async () => {});
  const insertAttachmentByUploadRef = useRef<(quillInstance?: any) => Promise<void>>(async () => {});
  const [uploadError, setUploadError] = useState('');
  const toolbarId = useId().replace(/:/g, '_');
  // react-quill reinstantiates the editor when `defaultValue` changes; keep mount-time default only.
  const defaultHtmlRef = useRef<string | null>(null);
  if (defaultHtmlRef.current === null) {
    defaultHtmlRef.current = normalizeHtml((value ?? '').toString());
  }

  const viewHtml = useMemo(() => {
    const rawHtml = (value ?? '').toString();
    if (!rawHtml.trim()) return '';
    return DOMPurify.sanitize(rawHtml, { USE_PROFILES: { html: true } });
  }, [value]);

  const handleChange = (content: string) => {
    const html = normalizeHtml(rewriteEditorHtmlToPersisted(content, blobSrcToApiUrlRef.current));
    if (lastEmittedValueRef.current === html) return;
    lastEmittedValueRef.current = html;
    onChangeRef.current(html);
  };

  useEffect(() => {
    const blobMap = blobSrcToApiUrlRef.current;
    return () => {
      blobMap.forEach((_apiUrl, blobUrl) => URL.revokeObjectURL(blobUrl));
      blobMap.clear();
    };
  }, []);

  useEffect(() => {
    if (mode !== 'edit') return;
    const quill = quillRef.current?.getEditor?.();
    if (!quill) return;

    const targetHtml = normalizeHtml((value ?? '').toString());
    const rawInner = quill.root?.innerHTML || '';
    const currentHtml = normalizeHtml(rewriteEditorHtmlToPersisted(rawInner, blobSrcToApiUrlRef.current));

    // Only apply external value when it differs from the editor and was not just emitted from here.
    if (targetHtml !== currentHtml && targetHtml !== lastEmittedValueRef.current) {
      quill.clipboard.dangerouslyPasteHTML(targetHtml);
      lastEmittedValueRef.current = targetHtml;
    }
  }, [value, mode, normalizeHtml]);

  const pickFile = useCallback((accept?: string): Promise<File | null> => {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      if (accept) input.accept = accept;
      input.style.display = 'none';
      document.body.appendChild(input);
      input.onchange = () => {
        const files = input.files;
        const file = files && files.length > 0 ? files[0] : null;
        document.body.removeChild(input);
        resolve(file);
      };
      input.click();
    });
  }, []);

  const uploadFile = useCallback(async (file: File) => {
    const upload = ticketId ? (f: File) => uploadTicketFile(ticketId, f) : uploadDraftFile;
    return upload(file) as Promise<{ code?: number; msg?: string; data?: { url: string; name: string } }>;
  }, [ticketId]);

  const syncSpecificQuillHtml = useCallback((quill: any) => {
    const raw = quill?.root?.innerHTML || '';
    const normalizedHtml = normalizeHtml(rewriteEditorHtmlToPersisted(raw, blobSrcToApiUrlRef.current));
    if (lastEmittedValueRef.current !== normalizedHtml) {
      lastEmittedValueRef.current = normalizedHtml;
      onChangeRef.current(normalizedHtml);
    }
  }, [normalizeHtml]);

  const insertImageByUpload = useCallback(async (quillInstance?: any) => {
    const file = await pickFile('image/*');
    if (!file) return;
    setUploadError('');
    try {
      const res = await uploadFile(file);
      if (res?.code === 0 && res.data?.url) {
        const quill = quillInstance || quillRef.current?.getEditor();
        if (!quill) return;
        const apiUrl = res.data.url;
        let displaySrc = toQuillSafeImageSrc(apiUrl);
        if (displaySrc !== apiUrl) {
          blobSrcToApiUrlRef.current.set(displaySrc, apiUrl);
        }
        const range = quill.getSelection(true);
        const index = range ? range.index : quill.getLength();
        quill.insertEmbed(index, 'image', displaySrc, 'user');
        quill.setSelection(index + 1);
        quill.update('user');
        requestAnimationFrame(() => syncSpecificQuillHtml(quill));
      } else {
        setUploadError((res as { msg?: string })?.msg || t('common.error'));
      }
    } catch {
      setUploadError(t('common.error'));
    }
  }, [pickFile, uploadFile, syncSpecificQuillHtml, t]);

  const insertAttachmentByUpload = useCallback(async (quillInstance?: any) => {
    const file = await pickFile();
    if (!file) return;
    setUploadError('');
    try {
      const res = await uploadFile(file);
      if (res?.code === 0 && res.data?.url) {
        const quill = quillInstance || quillRef.current?.getEditor();
        if (!quill) return;
        const range = quill.getSelection(true);
        const index = range ? range.index : quill.getLength();
        const text = res.data.name || file.name;
        // Quill expects `formats` object: { link: url }
        quill.insertText(index, text, { link: res.data.url }, 'user');
        quill.setSelection(index + text.length);
        quill.update('user');
        requestAnimationFrame(() => syncSpecificQuillHtml(quill));
      } else {
        setUploadError((res as { msg?: string })?.msg || t('common.error'));
      }
    } catch {
      setUploadError(t('common.error'));
    }
  }, [pickFile, uploadFile, syncSpecificQuillHtml, t]);

  insertImageByUploadRef.current = insertImageByUpload;
  insertAttachmentByUploadRef.current = insertAttachmentByUpload;

  // Keep `modules` referentially stable: react-quill destroys the editor when `modules` changes (lodash isEqual).
  const modules = useMemo(() => {
    return {
      toolbar: {
        container: `#${toolbarId}`,
        handlers: {
          richImage: function (this: any) {
            insertImageByUploadRef.current(this?.quill);
          },
          attachment: function (this: any) {
            insertAttachmentByUploadRef.current(this?.quill);
          },
        },
      },
    };
  }, [toolbarId]);

  if (mode === 'view') {
    if (!viewHtml) {
      return (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {t('common.noData')}
        </Typography>
      );
    }
    return (
      <Box
        sx={{
          '& img': { maxWidth: '100%' },
          '& a': { wordBreak: 'break-all' },
        }}
        dangerouslySetInnerHTML={{ __html: viewHtml }}
      />
    );
  }

  return (
    <FormControl fullWidth={true}>
      <Box
        id={toolbarId}
        className="ql-toolbar ql-snow"
        sx={{
          px: 1,
          py: 0.5,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 0.5,
          '& .ql-attachment': {
            width: 28,
            height: 28,
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'rgba(0,0,0,0.6)',
          },
          '& .ql-attachment:hover': {
            color: 'rgba(0,0,0,0.9)',
          },
          '& .ql-richImage': {
            width: 28,
            height: 28,
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'rgba(0,0,0,0.6)',
          },
          '& .ql-richImage:hover': {
            color: 'rgba(0,0,0,0.9)',
          },
        }}
      >
        <span className="ql-formats">
          <button className="ql-bold" type="button" />
          <button className="ql-italic" type="button" />
          <button className="ql-underline" type="button" />
          <button className="ql-strike" type="button" />
        </span>
        <span className="ql-formats">
          <select className="ql-header" defaultValue={''}>
            <option value="1" />
            <option value="2" />
            <option value="3" />
            <option value="" />
          </select>
        </span>
        <span className="ql-formats">
          <button className="ql-list" value="ordered" type="button" />
          <button className="ql-list" value="bullet" type="button" />
        </span>
        <span className="ql-formats">
          <button className="ql-blockquote" type="button" />
          <button className="ql-code-block" type="button" />
        </span>
        <span className="ql-formats">
          <button className="ql-link" type="button" />
          <button className="ql-richImage" type="button" aria-label={t('workflow.componentCategories.richTextUploadImage')}>
            <ImageIcon fontSize="small" />
          </button>
          <button
            className="ql-attachment"
            type="button"
            aria-label={t('workflow.componentCategories.fileComponent')}
          >
            <AttachFileIcon fontSize="small" />
          </button>
        </span>
        <span className="ql-formats">
          <button className="ql-clean" type="button" />
        </span>
      </Box>
      {uploadError && (
        <Typography variant="caption" color="error" sx={{ mb: 1, display: 'block' }}>
          {uploadError}
        </Typography>
      )}
      <Box
        sx={{
          '& .ql-container.ql-snow': {
            borderColor: 'divider',
            borderTopLeftRadius: 0,
            borderTopRightRadius: 0,
            borderBottomLeftRadius: 4,
            borderBottomRightRadius: 4,
            minHeight: 160,
          },
          [`& .ql-toolbar.ql-snow#${toolbarId}`]: {
            borderColor: 'divider',
            borderBottom: 'none',
            borderTopLeftRadius: 4,
            borderTopRightRadius: 4,
          },
          [`& .ql-toolbar.ql-snow:not(#${toolbarId})`]: {
            display: 'none',
          },
        }}
      >
        <ReactQuill
          ref={quillRef}
          defaultValue={defaultHtmlRef.current ?? ''}
          onChange={handleChange}
          placeholder={placeholder}
          modules={modules}
          formats={[
            'bold',
            'italic',
            'underline',
            'strike',
            'header',
            'list',
            'bullet',
            'blockquote',
            'code-block',
            'link',
            'image'
          ]}
          theme="snow"
        />
      </Box>
    </FormControl>
  );
}

export default RichTextField;

