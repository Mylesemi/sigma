"use client";

import { Component, type ReactNode } from "react";

interface Props {
  fallback: ReactNode;
  resetKey?: unknown; // 값이 바뀌면(예: 새 데이터 도착) 다시 렌더링 시도
  children: ReactNode;
}

// 한 영역의 렌더링 오류가 대시보드 전체를 멈추지 않도록 격리
export default class ErrorBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error(error);
  }

  componentDidUpdate(prev: Props) {
    if (this.state.failed && prev.resetKey !== this.props.resetKey) this.setState({ failed: false });
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
