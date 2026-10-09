import { lazy, memo, Suspense, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { Box, Button } from '@mui/material';
import ContentCopyOutlined from '@mui/icons-material/ContentCopyOutlined';
const Chart = lazy(() => import('./Chart'));
function Code({ className, children }: { className?: string; children?: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  const code = useRef<HTMLElement>(null);
  const text = String(children).replace(/\n$/, '');
  if (className?.includes('language-chart'))
    return (
      <Suspense fallback={<code>{text}</code>}>
        <Chart text={text} />
      </Suspense>
    );
  if (!className) return <code>{children}</code>;
  return (
    <Box component="span" sx={{ display: 'block', position: 'relative' }}>
      <Button
        size="small"
        startIcon={<ContentCopyOutlined fontSize="small" />}
        onClick={() => {
          void navigator.clipboard
            .writeText(code.current?.textContent || text)
            .then(() => setCopied(true))
            .catch(() => setCopied(false));
        }}
        sx={{ mb: 1 }}
      >
        {copied ? 'Copied' : 'Copy code'}
      </Button>
      <code ref={code} className={className}>
        {children}
      </code>
    </Box>
  );
}
export const RichContent = memo(function RichContent({ content }: { content: string }) {
  return (
    <Box
      sx={{
        overflowWrap: 'anywhere',
        lineHeight: 1.8,
        '& p:first-of-type': { mt: 0 },
        '& pre': {
          overflowX: 'auto',
          p: 2,
          borderRadius: 2,
          bgcolor: 'action.hover',
          whiteSpace: 'pre-wrap',
        },
        '& code': { fontFamily: 'Consolas, monospace', fontSize: '.88em' },
        '& table': {
          display: 'block',
          overflowX: 'auto',
          borderCollapse: 'collapse',
          maxWidth: '100%',
        },
        '& th, & td': { p: 1, border: '1px solid', borderColor: 'divider' },
        '& img': { maxWidth: '100%', maxHeight: 400, borderRadius: 2 },
        '& a': { color: 'primary.main' },
        '& .hljs-keyword, & .hljs-selector-tag': { color: 'secondary.main' },
        '& .hljs-string, & .hljs-number': { color: 'primary.main' },
      }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeHighlight, { detect: false, ignoreMissing: true }]]}
        components={{
          code: ({ className, children }) => <Code className={className}>{children}</Code>,
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
          img: ({ src, alt }) =>
            typeof src === 'string' && /^\/api\/files\/[0-9a-f-]{36}$/.test(src) ? (
              <img src={src} alt={alt || 'Attached image'} loading="lazy" />
            ) : (
              <span>[External image omitted: {alt}]</span>
            ),
        }}
      >
        {content}
      </ReactMarkdown>
    </Box>
  );
});
