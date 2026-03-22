import { useEffect, useRef } from 'react';

interface Props {
  lines: string[];
}

export default function SolverPanel({ lines }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  return (
    <div style={panelStyle}>
      <div style={titleBarStyle}>Solver</div>
      <div style={logStyle}>
        {lines.length === 0 ? (
          <span style={emptyStyle}>— no output —</span>
        ) : (
          lines.map((line, i) => <div key={i}>{line}</div>)
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

const panelStyle: React.CSSProperties = {
  width: 280,
  flexShrink: 0,
  display: 'flex',
  flexDirection: 'column',
  borderLeft: '1px solid #0f3460',
  background: '#11182b',
  overflow: 'hidden',
};

const titleBarStyle: React.CSSProperties = {
  padding: '8px 12px',
  fontSize: '0.75rem',
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: '#8899aa',
  borderBottom: '1px solid #0f3460',
  userSelect: 'none',
};

const logStyle: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: '8px 12px',
  fontFamily: 'monospace',
  fontSize: '0.8rem',
  lineHeight: 1.6,
  color: '#ccd6f6',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-all',
};

const emptyStyle: React.CSSProperties = {
  color: '#445566',
  fontStyle: 'italic',
};
