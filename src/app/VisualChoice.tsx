import {
  memo,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';

import { renderRasterFrame } from '../raster/render';
import type { RasterSettings } from '../raster/settings';
import type { VisualChoiceOption } from './choice-catalog';
import './visual-choice.css';

const PREVIEW_WIDTH = 144;
const PREVIEW_HEIGHT = 72;
const TYPEAHEAD_RESET_MS = 600;
const previewPixelCache = new WeakMap<RasterSettings, ImageData>();

interface VisualChoiceProps {
  label: 'Pattern' | 'Renderer';
  value: string;
  onChange: (value: string) => void;
  options: readonly VisualChoiceOption[];
}

interface PopupPosition {
  bottom?: number;
  left: number;
  maxHeight: number;
  top?: number;
  width: number;
}

const RasterChoicePreview = memo(function RasterChoicePreview({ settings }: { settings: RasterSettings }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d', { alpha: true, willReadFrequently: true });
    if (!canvas || !context) return;

    context.imageSmoothingEnabled = false;
    const cached = previewPixelCache.get(settings);
    if (cached) {
      context.putImageData(cached, 0, 0);
      return;
    }

    renderRasterFrame(context, {
      width: PREVIEW_WIDTH,
      height: PREVIEW_HEIGHT,
      phase: 0,
      settings,
      source: null,
    });
    previewPixelCache.set(settings, context.getImageData(0, 0, PREVIEW_WIDTH, PREVIEW_HEIGHT));
  }, [settings]);

  return (
    <canvas
      aria-hidden="true"
      height={PREVIEW_HEIGHT}
      ref={canvasRef}
      width={PREVIEW_WIDTH}
    />
  );
});

function ImageChoicePreview() {
  return (
    <span className="visual-choice__image-preview" aria-hidden="true">
      <svg viewBox="0 0 48 32">
        <rect x="5" y="4" width="38" height="24" rx="2" />
        <circle cx="33.5" cy="11.5" r="3" />
        <path d="m8 25 10-10 7 7 5-5 10 8" />
      </svg>
    </span>
  );
}

function getPopupPosition(trigger: HTMLButtonElement): PopupPosition {
  const viewportPadding = 8;
  const gap = 6;
  const rect = trigger.getBoundingClientRect();
  const availableWidth = Math.max(0, window.innerWidth - viewportPadding * 2);
  const width = Math.min(Math.max(rect.width, Math.min(320, availableWidth)), availableWidth);
  const left = Math.max(
    viewportPadding,
    Math.min(rect.left, window.innerWidth - viewportPadding - width),
  );
  const roomBelow = window.innerHeight - rect.bottom - gap - viewportPadding;
  const roomAbove = rect.top - gap - viewportPadding;
  const openAbove = roomBelow < Math.min(360, roomAbove) && roomAbove > roomBelow;

  return {
    left,
    width,
    maxHeight: Math.max(88, openAbove ? roomAbove : roomBelow),
    ...(openAbove
      ? { bottom: window.innerHeight - rect.top + gap }
      : { top: rect.bottom + gap }),
  };
}

function nextEnabledIndex(current: number, step: number, length: number) {
  if (length === 0) return -1;
  return (current + step + length) % length;
}

export function VisualChoice({ label, value, onChange, options }: VisualChoiceProps) {
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Array<HTMLDivElement | null>>([]);
  const typeaheadRef = useRef({ query: '', timeout: 0 });
  const [isOpen, setIsOpen] = useState(false);
  const selectedIndex = Math.max(0, options.findIndex(option => option.value === value));
  const [activeIndex, setActiveIndex] = useState(selectedIndex);
  const [popupPosition, setPopupPosition] = useState<PopupPosition | null>(null);
  const current = options[selectedIndex] ?? options[0];
  const descriptionId = `${id}-current-description`;
  const listboxId = `${id}-listbox`;

  const popupStyle = useMemo(() => popupPosition ? ({
    bottom: popupPosition.bottom,
    left: popupPosition.left,
    maxHeight: popupPosition.maxHeight,
    top: popupPosition.top,
    width: popupPosition.width,
  } satisfies CSSProperties) : undefined, [popupPosition]);

  const focusOption = (index: number) => {
    if (index < 0) return;
    setActiveIndex(index);
    requestAnimationFrame(() => {
      const option = optionRefs.current[index];
      option?.focus({ preventScroll: true });
      option?.scrollIntoView({ block: 'nearest' });
    });
  };

  const close = (restoreFocus: boolean) => {
    setIsOpen(false);
    setPopupPosition(null);
    window.clearTimeout(typeaheadRef.current.timeout);
    typeaheadRef.current = { query: '', timeout: 0 };
    if (restoreFocus) requestAnimationFrame(() => triggerRef.current?.focus({ preventScroll: true }));
  };

  const open = () => {
    const trigger = triggerRef.current;
    if (!trigger || options.length === 0) return;
    setActiveIndex(selectedIndex);
    setPopupPosition(getPopupPosition(trigger));
    setIsOpen(true);
  };

  useLayoutEffect(() => {
    if (!isOpen || !popupPosition) return;
    const option = optionRefs.current[activeIndex];
    option?.focus({ preventScroll: true });
    option?.scrollIntoView({ block: 'nearest' });
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const repositionOrClose = () => {
      const trigger = triggerRef.current;
      if (!trigger) {
        close(false);
        return;
      }
      const rect = trigger.getBoundingClientRect();
      const isVisible = rect.bottom > 0
        && rect.top < window.innerHeight
        && rect.right > 0
        && rect.left < window.innerWidth;
      if (!isVisible) {
        close(false);
        return;
      }
      setPopupPosition(getPopupPosition(trigger));
    };
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || popupRef.current?.contains(target)) return;
      close(false);
    };
    const handleScroll = (event: Event) => {
      if (event.target instanceof Node && popupRef.current?.contains(event.target)) return;
      repositionOrClose();
    };
    const handleResize = () => repositionOrClose();

    document.addEventListener('pointerdown', handlePointerDown, true);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleResize);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleResize);
    };
  }, [isOpen]);

  useEffect(() => () => {
    window.clearTimeout(typeaheadRef.current.timeout);
  }, []);

  const selectOption = (index: number) => {
    const option = options[index];
    if (!option) return;
    onChange(option.value);
    close(true);
  };

  const handleTypeahead = (key: string) => {
    window.clearTimeout(typeaheadRef.current.timeout);
    const query = `${typeaheadRef.current.query}${key.toLocaleLowerCase()}`;
    const start = nextEnabledIndex(activeIndex, 1, options.length);
    const index = Array.from({ length: options.length }, (_, offset) => (start + offset) % options.length)
      .find(candidate => options[candidate].label.toLocaleLowerCase().startsWith(query));
    typeaheadRef.current = {
      query,
      timeout: window.setTimeout(() => {
        typeaheadRef.current = { query: '', timeout: 0 };
      }, TYPEAHEAD_RESET_MS),
    };
    if (index !== undefined) focusOption(index);
  };

  const handleOptionKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      focusOption(nextEnabledIndex(activeIndex, event.key === 'ArrowDown' ? 1 : -1, options.length));
      return;
    }
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      focusOption(event.key === 'Home' ? 0 : options.length - 1);
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      selectOption(activeIndex);
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      close(true);
      return;
    }
    if (event.key === 'Tab') {
      setIsOpen(false);
      setPopupPosition(null);
      triggerRef.current?.focus({ preventScroll: true });
      return;
    }
    if (event.key.length === 1 && !event.altKey && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      handleTypeahead(event.key);
    }
  };

  if (!current) return null;

  return (
    <div className="visual-choice">
      <span className="visual-choice__field-label">{label}</span>
      <button
        aria-controls={isOpen ? listboxId : undefined}
        aria-describedby={descriptionId}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={`${label} ${current.label}`}
        className="visual-choice__trigger"
        onClick={() => isOpen ? close(false) : open()}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Home' || event.key === 'End') {
            event.preventDefault();
            open();
          }
        }}
        ref={triggerRef}
        type="button"
      >
        <span>{current.label}</span>
        <svg aria-hidden="true" viewBox="0 0 16 16"><path d="m4 6 4 4 4-4" /></svg>
      </button>
      <small className="visual-choice__helper" id={descriptionId}>{current.description}</small>

      {isOpen && popupStyle && createPortal(
        <div
          aria-label={label}
          className="visual-choice__popup"
          id={listboxId}
          ref={popupRef}
          role="listbox"
          style={popupStyle}
        >
          {options.map((option, index) => {
            const optionDescriptionId = `${id}-option-${index}-description`;
            return (
              <div
                aria-describedby={optionDescriptionId}
                aria-label={option.label}
                aria-selected={option.value === value}
                className="visual-choice__option"
                data-active={index === activeIndex ? '' : undefined}
                key={option.value}
                onClick={() => selectOption(index)}
                onFocus={() => setActiveIndex(index)}
                onKeyDown={handleOptionKeyDown}
                ref={(node) => { optionRefs.current[index] = node; }}
                role="option"
                tabIndex={index === activeIndex ? 0 : -1}
              >
                <span className="visual-choice__preview">
                  {option.preview
                    ? <RasterChoicePreview settings={option.preview} />
                    : <ImageChoicePreview />}
                </span>
                <span className="visual-choice__option-copy" aria-hidden="true">
                  <strong>{option.label}</strong>
                  <small id={optionDescriptionId}>{option.description}</small>
                </span>
                <span className="visual-choice__check" aria-hidden="true">
                  {option.value === value ? '\u2713' : ''}
                </span>
              </div>
            );
          })}
        </div>,
        document.body,
      )}
    </div>
  );
}
