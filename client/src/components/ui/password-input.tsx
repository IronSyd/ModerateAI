import * as React from "react"
import { Eye, EyeOff } from "lucide-react"

import { cn } from "@/lib/utils"
import { Input, type InputProps } from "@/components/ui/input"

type PasswordInputProps = Omit<InputProps, "type"> & {
  defaultVisible?: boolean
}

const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, defaultVisible = false, disabled, ...props }, ref) => {
    const [isVisible, setIsVisible] = React.useState(defaultVisible)
    const inputRef = React.useRef<HTMLInputElement | null>(null)
    const pointerHandledRef = React.useRef(false)

    const setRefs = React.useCallback(
      (node: HTMLInputElement | null) => {
        inputRef.current = node

        if (typeof ref === "function") {
          ref(node)
          return
        }

        if (ref) {
          ;(ref as React.MutableRefObject<HTMLInputElement | null>).current = node
        }
      },
      [ref],
    )

    return (
      <div className="relative">
        <Input
          ref={setRefs}
          type={isVisible ? "text" : "password"}
          className={cn("pr-10", className)}
          disabled={disabled}
          {...props}
        />
        <button
          type="button"
          className={cn(
            "absolute right-1 top-1/2 z-10 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center rounded-md border border-border/40 bg-background/35 backdrop-blur-sm",
            "text-foreground/70 transition-colors hover:text-foreground hover:bg-background/55",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background",
            disabled && "pointer-events-none opacity-60",
          )}
          data-micro="false"
          data-tactile="false"
          aria-label={isVisible ? "Hide password" : "Show password"}
          aria-pressed={isVisible}
          onPointerDown={(event) => {
            // Some browsers can drop the click when `preventDefault()` is used on mouse down.
            // Toggling on pointer down makes the behavior consistent while keeping focus in the input.
            event.preventDefault()
            pointerHandledRef.current = true
            setIsVisible((current) => !current)
            inputRef.current?.focus({ preventScroll: true })
          }}
          onClick={() => {
            // Keyboard activation triggers click without a pointer event.
            if (pointerHandledRef.current) {
              pointerHandledRef.current = false
              return
            }

            setIsVisible((current) => !current)
            inputRef.current?.focus({ preventScroll: true })
          }}
          onPointerUp={() => {
            pointerHandledRef.current = false
          }}
          onPointerCancel={() => {
            pointerHandledRef.current = false
          }}
          disabled={disabled}
        >
          {isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    )
  }
)
PasswordInput.displayName = "PasswordInput"

export { PasswordInput }
