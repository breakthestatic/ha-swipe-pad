import {LitElement, html, css} from 'lit'
import {customElement, property} from 'lit/decorators'
import {ResizeController} from '@lit-labs/observers/resize-controller'
import {InternalConfig, HaTouchPadConfig, TouchActionEvent} from './types'

@customElement('touch-pad')
class TouchPad extends LitElement {
  static styles = css`
    .touchpad {
      position: relative;
      width: 100%;
      padding-bottom: 100%;
    }
    .circle {
      position: absolute;
      border-radius: 50%;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
    }
  `

  @property()
  private _config: InternalConfig

  _resizeController = new ResizeController(this, {})

  private _circle: HTMLElement
  private _startX: number
  private _startY: number
  private _lastTouch: number
  private _timeout: number
  private _mouseDown: boolean

  private _fireEvent = (action: string) => {
    const config = this._config[`${action}_action`]

    if (!config) return

    const event: TouchActionEvent = new Event('hass-action', {bubbles: true, composed: true})

    event.detail = {
      config: {tap_action: config},
      action: 'tap',
    }

    this.dispatchEvent(event)
  }

  private _handleStart = (event: TouchEvent | MouseEvent) => {
    const isTouch = event instanceof TouchEvent
    event.preventDefault()
    event.stopPropagation()

    this._mouseDown = !isTouch

    this._startX = isTouch ? event.changedTouches[0].clientX : event.clientX
    this._startY = isTouch ? event.changedTouches[0].clientY : event.clientY
    this._circle.style.transition = 'none'
  }

  private _handleMove = (event: TouchEvent | MouseEvent) => {
    const isTouch = event instanceof TouchEvent
    event.preventDefault()
    event.stopPropagation()

    if (!isTouch && !this._mouseDown) return

    const {clientX, clientY} = isTouch ? event.changedTouches[0] : event

    // Bind circle coords to touch container
    const maxDeltaX = (this.offsetWidth - this._circle.offsetWidth) / 2
    const maxDeltaY = (this.offsetHeight - this._circle.offsetHeight) / 2
    const left = Math.max(Math.min(clientX - this._startX, maxDeltaX), -maxDeltaX)
    const top = Math.max(Math.min(clientY - this._startY, maxDeltaY), -maxDeltaY)

    // Update circle as movement occurs
    this._circle.style.left = `calc(50% + ${left}px)`
    this._circle.style.top = `calc(50% + ${top}px)`
  }

  private _handleEnd = (event: TouchEvent | MouseEvent) => {
    const isTouch = event instanceof TouchEvent
    event.preventDefault()
    event.stopPropagation()

    this._mouseDown = false

    if (!isTouch && !this._mouseDown) return

    const {clientX, clientY} = isTouch ? event.changedTouches[0] : event
    const {swipe_threshold, tap_threshold, tap_timeout} = this._config
    const rawDeltaX = clientX - this._startX
    const rawDeltaY = clientY - this._startY
    const deltaX = Math.abs(rawDeltaX)
    const deltaY = Math.abs(rawDeltaY)

    // Animate circle back to center after gesture completes
    this._circle.style.transition = 'top 0.5s, left 0.5s'
    this._circle.style.left = '50%'
    this._circle.style.top = '50%'

    if (deltaX < tap_threshold && deltaY < tap_threshold) {
      const currentTimestamp = Date.now()
      clearTimeout(this._timeout)
      if (currentTimestamp - this._lastTouch < tap_timeout) {
        this._fireEvent('double_tap')
      } else {
        this._timeout = setTimeout(() => {
          this._fireEvent('tap')
          clearTimeout(this._timeout)
        }, tap_timeout)
      }
      this._lastTouch = currentTimestamp
    } else if (deltaX > deltaY && deltaX > swipe_threshold) {
      this._fireEvent(rawDeltaX > 0 ? 'right' : 'left')
    } else if (deltaY > deltaX && deltaY > swipe_threshold) {
      this._fireEvent(rawDeltaY > 0 ? 'down' : 'up')
    }
  }

  setConfig(config: HaTouchPadConfig) {
    this._config = {
      border_radius: 'var(--ha-card-border-radius, 12px)',
      background_color: 'var(--secondary-background-color, #e5e5e5)',
      cursor_size: '40px',
      cursor_color: 'var(--secondary-text-color, #727272)',
      swipe_threshold: 50,
      tap_threshold: 5,
      tap_timeout: 200,
      ...config,
    }
  }

  updated() {
    this._circle = this.shadowRoot?.querySelector('.circle') || new HTMLElement()
  }

  connectedCallback(): void {
    super.connectedCallback()

    this.addEventListener('touchstart', this._handleStart)
    this.addEventListener('touchmove', this._handleMove)
    this.addEventListener('touchend', this._handleEnd)

    this.addEventListener('mousedown', this._handleStart)
    window.addEventListener('mousemove', this._handleMove)
    window.addEventListener('mouseup', this._handleEnd)
  }

  disconnectedCallback() {
    this.removeEventListener('touchstart', this._handleStart)
    this.removeEventListener('touchmove', this._handleMove)
    this.removeEventListener('touchend', this._handleEnd)

    this.removeEventListener('mousedown', this._handleStart)
    window.removeEventListener('mousemove', this._handleMove)
    window.removeEventListener('mouseup', this._handleEnd)
    super.disconnectedCallback()
  }

  render() {
    const {border_radius, background_color, cursor_size, cursor_color} = this._config

    return html`
      <style>
        .touchpad {
          background-color: ${background_color};
          border-radius: ${border_radius};
        }
        .circle {
          width: ${cursor_size};
          height: ${cursor_size};
          background-color: ${cursor_color};
        }
      </style>
      <div class="touchpad">
        <div class="circle" />
      </div>
    `
  }
}
