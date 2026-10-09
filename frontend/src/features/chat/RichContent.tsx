import { lazy, memo, Suspense, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import ContentCopyOutlined from '@mui/icons-material/ContentCopyOutlined';
import CheckOutlined from '@mui/icons-material/CheckOutlined';
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

  if (!className)
    return (
      <Box
        component="code"
        sx={{
          fontFamily: 'Consolas, monospace',
          fontSize: '.88em',
          bgcolor: 'action.hover',
          px: 0.5,
          borderRadius: 0.5,
        }}
      >
        {children}
      </Box>
    );

  const lang = className?.replace('language-', '') ?? '';
  const label = lang ? lang.charAt(0).toUpperCase() + lang.slice(1) : '';

  return (
    <Box component="span" sx={{ display: 'block', position: 'relative' }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 1.5,
          py: 0.75,
          borderRadius: '8px 8px 0 0',
          bgcolor: 'action.selected',
        }}
      >
        <Typography
          variant="caption"
          sx={{ fontFamily: 'Consolas, monospace', opacity: 0.8 }}
        >
          {label}
        </Typography>
        <Tooltip title={copied ? 'Copied' : 'Copy code'}>
          <IconButton
            aria-label="Copy code"
            size="small"
            onClick={() => {
              void navigator.clipboard
                .writeText(code.current?.textContent ?? text)
                .then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                })
                .catch(() => setCopied(false));
            }}
          >
            {copied ? (
              <CheckOutlined fontSize="small" />
            ) : (
              <ContentCopyOutlined fontSize="small" />
            )}
          </IconButton>
        </Tooltip>
      </Box>
      <code ref={code} className={className}>
        {children}
      </code>
    </Box>
  );
}

export const RichContent = memo(function RichContent({
  content,
  streaming = false,
}: {
  content: string;
  streaming?: boolean;
}) {
  return (
    <Box
      sx={{
        overflowWrap: 'anywhere',
        lineHeight: 1.8,
        '& p:first-of-type': { mt: 0 },
        '& p': { mt: 1.5, mb: 0 },
        '& pre': {
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
          maxWidth: '100%',
          p: 2,
          borderRadius: '0 0 8px 8px',
          bgcolor: 'action.hover',
          whiteSpace: 'pre',
        },
        '& code': { fontFamily: 'Consolas, monospace', fontSize: '.88em' },
        '& :not(pre) > code': {
          bgcolor: 'action.hover',
          px: 0.5,
          borderRadius: 0.5,
        },
        '& blockquote': {
          borderLeft: '3px solid',
          borderColor: 'primary.main',
          pl: 2,
          ml: 0,
          color: 'text.secondary',
          fontStyle: 'italic',
        },
        '& ul, & ol': { pl: 3 },
        '& li': { mb: 0.5 },
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
        '& .hljs-comment, & .hljs-quote': { color: 'text.secondary', fontStyle: 'italic' },
        '& .hljs-function, & .hljs-title': { color: 'primary.main' },
        '& .hljs-built_in, & .hljs-builtin-name': { color: 'secondary.main' },
        '& .hljs-attr, & .hljs-attribute': { color: 'primary.main' },
        '& .hljs-variable, & .hljs-template-variable': { color: 'text.primary' },
        '& .hljs-literal': { color: 'secondary.main' },
        '& .hljs-type, & .hljs-class': { color: 'secondary.main' },
        '& .hljs-tag': { color: 'text.secondary' },
        '& .hljs-name': { color: 'primary.main' },
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
      {streaming && (
        <Box
          component="span"
          sx={{
            animation: 'blink 1s step-end infinite',
            '@keyframes blink': {
              '0%, 100%': { opacity: 1 },
              '50%': { opacity: 0 },
            },
          }}
        >
          ▋
        </Box>
      )}
    </Box>
  );
});
