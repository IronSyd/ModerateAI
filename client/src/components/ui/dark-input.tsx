import * as React from "react"
import { cn } from "@/lib/utils"

export interface DarkInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const DarkInput = React.forwardRef<HTMLInputElement, DarkInputProps>(
  ({ className, type, style, ...props }, ref) => {
    const inputRef = React.useRef<HTMLInputElement>(null);
    
    React.useEffect(() => {
      const applyStyles = () => {
        const input = inputRef.current || (ref as React.RefObject<HTMLInputElement>)?.current;
        if (input) {
          input.style.setProperty('background-color', '#1e293b', 'important');
          input.style.setProperty('border-color', '#475569', 'important');
          input.style.setProperty('color', 'white', 'important');
          input.style.setProperty('background', '#1e293b', 'important');
        }
      };

      applyStyles();
      
      // Apply styles periodically to override any theme changes
      const interval = setInterval(applyStyles, 100);
      
      return () => clearInterval(interval);
    });

    const darkStyle: React.CSSProperties = {
      backgroundColor: '#1e293b !important',
      borderColor: '#475569 !important',
      color: 'white !important',
      background: '#1e293b !important',
      ...style
    };

    return (
      <input
        type={type}
        style={darkStyle}
        className={cn(
          "dark-input-forced flex h-10 w-full rounded-md border px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={(node) => {
          (inputRef as React.MutableRefObject<HTMLInputElement | null>).current = node;
          if (typeof ref === 'function') {
            ref(node);
          } else if (ref) {
            (ref as React.MutableRefObject<HTMLInputElement | null>).current = node;
          }
        }}
        {...props}
      />
    )
  }
)
DarkInput.displayName = "DarkInput"

export { DarkInput }