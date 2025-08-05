import * as React from "react"
import { cn } from "@/lib/utils"

export interface DarkInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const DarkInput = React.forwardRef<HTMLInputElement, DarkInputProps>(
  ({ className, type, style, ...props }, ref) => {
    const darkStyle: React.CSSProperties = {
      backgroundColor: '#1e293b',
      borderColor: '#475569',
      color: 'white',
      ...style
    };

    return (
      <input
        type={type}
        style={darkStyle}
        className={cn(
          "flex h-10 w-full rounded-md border px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
DarkInput.displayName = "DarkInput"

export { DarkInput }