import { Box, Typography } from '@mui/material';
import { motion, useReducedMotion } from 'framer-motion';

/** Three bouncing dots shown while the assistant hasn't emitted any tokens yet. */
export function ThinkingIndicator() {
  const reduced = useReducedMotion();

  const dotVariants = {
    bounce: (i: number) => ({
      y: reduced ? 0 : [0, -6, 0],
      transition: {
        duration: 0.6,
        repeat: Infinity,
        delay: i * 0.15,
        ease: 'easeInOut' as const,
      },
    }),
  };

  return (
    <Box display="flex" alignItems="center" gap={1} py={0.5} aria-label="Thinking" role="status">
      <Box display="flex" alignItems="center" gap={0.5}>
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            custom={i}
            animate="bounce"
            variants={dotVariants}
            style={{
              display: 'inline-block',
              width: 6,
              height: 6,
              borderRadius: '50%',
              backgroundColor: 'currentColor',
              opacity: 0.6,
            }}
          />
        ))}
      </Box>
      <Typography variant="caption" color="text.secondary" fontStyle="italic">
        Thinking…
      </Typography>
    </Box>
  );
}
