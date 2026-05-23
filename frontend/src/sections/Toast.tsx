interface Props {
  message: string;
  visible: boolean;
}

export default function Toast({ message, visible }: Props) {
  if (!visible) return null;

  return (
    <div
      className="fixed bottom-24 left-1/2 z-50 px-5 py-2.5 rounded-full text-sm toast-enter"
      style={{
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
        background: 'rgba(30, 30, 40, 0.9)',
        backdropFilter: 'blur(12px)',
        color: 'rgba(255,255,255,0.8)',
        border: '1px solid rgba(255,255,255,0.08)',
        transform: 'translateX(-50%)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
      }}
    >
      {message}
    </div>
  );
}
