import { Component, type ReactNode } from 'react'
import { withTranslation, type WithTranslation } from 'react-i18next'
import { Button } from './ui/button'

interface Props extends WithTranslation {
  children: ReactNode
}

class Boundary extends Component<Props, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div role="alert" className="flex flex-col items-start gap-3 p-6">
        <p>{this.props.t('common.error')}</p>
        <Button onClick={() => location.reload()}>{this.props.t('common.reload')}</Button>
      </div>
    )
  }
}

export const ErrorBoundary = withTranslation()(Boundary)
