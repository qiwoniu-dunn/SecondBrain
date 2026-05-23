import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '200px',
          padding: '24px',
          color: 'rgba(255,255,255,0.7)',
          textAlign: 'center',
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
        }}>
          <p style={{ fontSize: '14px', marginBottom: '16px' }}>
            页面出现了错误
          </p>
          <button
            onClick={this.handleRetry}
            style={{
              padding: '8px 24px',
              borderRadius: '10px',
              border: '1px solid rgba(59,130,246,0.3)',
              background: 'rgba(59,130,246,0.15)',
              color: '#F0F0F0',
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            重试
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
